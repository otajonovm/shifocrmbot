const supabase = require('../supabase');
const { getTelegramChatIdByPhone } = require('../repository/telegramChatRepo');
const { createScheduledMessageUnique } = require('../repository/scheduledMessagesRepo');

const LOOK_AHEAD_DAYS = 3;
const REMINDER_OFFSETS_HOURS = [24, 2];
const DEFAULT_TIMEZONE = 'Asia/Tashkent';
const DEFAULT_TIME = '09:00';
const IMMEDIATE_REMINDER_DELAY_MINUTES = 1;
const TWO_HOUR_WINDOW_MINUTES = 2 * 60;

function toDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function timezoneToOffset(timezone) {
  const tz = String(timezone || DEFAULT_TIMEZONE).trim();

  if (/^[+-]\d{2}:\d{2}$/.test(tz)) {
    return tz;
  }

  const map = {
    'Asia/Tashkent': '+05:00',
    'Asia/Samarkand': '+05:00',
    UTC: '+00:00',
    GMT: '+00:00',
    'Europe/Moscow': '+03:00',
  };

  return map[tz] || '+05:00';
}

function normalizeTime(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return DEFAULT_TIME;
  }

  const matched = raw.match(/^(\d{1,2}):(\d{1,2})/);
  if (!matched) {
    return DEFAULT_TIME;
  }

  const hours = String(Math.min(23, Number(matched[1]))).padStart(2, '0');
  const minutes = String(Math.min(59, Number(matched[2]))).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const raw = String(value).trim();

  const isoDateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDateMatch) {
    return `${isoDateMatch[1]}-${isoDateMatch[2]}-${isoDateMatch[3]}`;
  }

  const dotDateMatch = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dotDateMatch) {
    return `${dotDateMatch[3]}-${dotDateMatch[2]}-${dotDateMatch[1]}`;
  }

  const slashDateMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashDateMatch) {
    return `${slashDateMatch[3]}-${slashDateMatch[2]}-${slashDateMatch[1]}`;
  }

  return null;
}

function parseAppointmentDateTime({ dateValue, timeValue, timezone }) {
  const normalizedDate = normalizeDate(dateValue);
  if (!normalizedDate) {
    return null;
  }

  const normalizedTime = normalizeTime(timeValue);
  const offset = timezoneToOffset(timezone);

  const appointmentIso = `${normalizedDate}T${normalizedTime}:00${offset}`;
  const parsed = new Date(appointmentIso);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return {
    date: normalizedDate,
    time: normalizedTime,
    timezone: timezone || DEFAULT_TIMEZONE,
    isoWithOffset: appointmentIso,
    utcDate: parsed,
  };
}

function pickFirst(row, fieldNames) {
  for (const field of fieldNames) {
    if (row[field] !== undefined && row[field] !== null && String(row[field]).trim() !== '') {
      return row[field];
    }
  }
  return null;
}

function buildReminderMessage(locale, patientName, appointmentInfo, offsetHours, options = {}) {
  const deliveryMode = options.deliveryMode || 'scheduled';
  const name = patientName || 'Bemor';
  const datePart = appointmentInfo.date;
  const timePart = appointmentInfo.time;
  const isLateDelivery = deliveryMode === 'late';

  if (locale === 'ru') {
    if (offsetHours === 24 && isLateDelivery) {
      return `🗓 <b>Напоминание о приёме</b>\n\n` +
        `👤 Пациент: ${name}\n` +
        `📅 Дата: ${datePart}\n` +
        `⏰ Время: ${timePart}\n\n` +
        `Ваш приём уже скоро. Пожалуйста, будьте готовы вовремя.`;
    }

    if (offsetHours === 2 && isLateDelivery) {
      return `🗓 <b>Напоминание о приёме</b>\n\n` +
        `👤 Пациент: ${name}\n` +
        `📅 Дата: ${datePart}\n` +
        `⏰ Время: ${timePart}\n\n` +
        `Ваш приём уже совсем скоро. Пожалуйста, подтвердите, сможете ли прийти.`;
    }

    return `🗓 <b>Напоминание о приёме</b>\n\n` +
      `👤 Пациент: ${name}\n` +
      `📅 Дата: ${datePart}\n` +
      `⏰ Время: ${timePart}\n\n` +
      (offsetHours === 24
        ? `Через 24 часа у вас запись. Пожалуйста, приходите вовремя.`
        : `Через 2 часа у вас запись. Пожалуйста, подготовьтесь заранее.\n\nПодтвердите, пожалуйста, сможете ли прийти.`);
  }

  return `🗓 <b>Qabul eslatmasi</b>\n\n` +
    `👤 Bemor: ${name}\n` +
    `📅 Sana: ${datePart}\n` +
    `⏰ Vaqt: ${timePart}\n\n` +
    (offsetHours === 24
      ? (isLateDelivery
        ? `Qabulingiz yaqinlashmoqda. Iltimos, tayyor bo'ling.`
        : `24 soatdan keyin qabulingiz bor. Iltimos, vaqtida keling.`)
      : (isLateDelivery
        ? `Qabulingiz juda yaqinlashmoqda. Iltimos, kelishingizni tasdiqlang.`
        : `2 soatdan keyin qabulingiz bor. Iltimos, oldindan tayyor bo'ling.\n\nKelishingizni tasdiqlaysizmi?`));
}

function getMinutesUntilAppointment(appointmentInfo, now = new Date()) {
  if (!appointmentInfo?.utcDate || Number.isNaN(appointmentInfo.utcDate.getTime())) {
    return null;
  }

  return Math.floor((appointmentInfo.utcDate.getTime() - now.getTime()) / 60000);
}

function getReminderDeliveryPlan(offsetHours, minutesUntilAppointment, now = new Date()) {
  if (minutesUntilAppointment === null || minutesUntilAppointment <= 0) {
    return null;
  }

  const offsetMinutes = offsetHours * 60;

  if (minutesUntilAppointment > offsetMinutes) {
    return {
      scheduledTime: new Date(now.getTime() + (minutesUntilAppointment - offsetMinutes) * 60 * 1000),
      deliveryMode: 'scheduled',
    };
  }

  if (offsetHours === 24) {
    return null;
  }

  return {
    scheduledTime: new Date(now.getTime() + IMMEDIATE_REMINDER_DELAY_MINUTES * 60 * 1000),
    deliveryMode: 'late',
  };
}

function isCancelledStatus(value) {
  const status = String(value || '').toLowerCase();
  if (!status) {
    return false;
  }

  return [
    'cancel',
    'canceled',
    'cancelled',
    'rejected',
    'rad etilgan',
    'rad_etilgan',
    'closed',
    'archived',
    'deleted'
  ].some(token => status.includes(token));
}

async function fetchLeadRows() {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3000);

  if (error) {
    console.error('❌ leads jadvalidan appointmentlarni olishda xatolik:', error.message);
    return [];
  }

  return data || [];
}

async function scheduleRemindersForRows(rows, options = {}) {
  const {
    lookAheadDays = LOOK_AHEAD_DAYS,
    sourceType = 'lead',
    resolveContext,
  } = options;

  const now = new Date();
  const until = new Date(now.getTime() + lookAheadDays * 24 * 60 * 60 * 1000);

  let scanned = 0;
  let skipped = 0;
  let created = 0;
  let deduped = 0;

  for (const row of rows) {
    scanned += 1;

    if (isCancelledStatus(row.status || row.state)) {
      skipped += 1;
      continue;
    }

    const context = await resolveContext(row, { now, until });
    if (!context) {
      skipped += 1;
      continue;
    }

    const {
      patientId,
      locale,
      patientName,
      sourceId,
      appointmentInfo,
      minutesUntilAppointment,
    } = context;

    for (const offsetHours of REMINDER_OFFSETS_HOURS) {
      const deliveryPlan = getReminderDeliveryPlan(offsetHours, minutesUntilAppointment, now);
      if (!deliveryPlan) {
        continue;
      }

      const message = buildReminderMessage(locale, patientName, appointmentInfo, offsetHours, {
        deliveryMode: deliveryPlan.deliveryMode,
      });
      const reminderKey = `${sourceType}:${sourceId}:appt:${appointmentInfo.isoWithOffset}:offset:${offsetHours}`;

      const result = await createScheduledMessageUnique({
        patientId,
        message,
        scheduledTime: deliveryPlan.scheduledTime,
        reminderKey,
      });

      if (result && result._deduped) {
        deduped += 1;
      } else if (result) {
        created += 1;
      }
    }
  }

  return { scanned, skipped, created, deduped, lookAheadDays, offsets: REMINDER_OFFSETS_HOURS };
}

async function resolveLeadReminderContext(row, { now, until }) {
  const rawDate = pickFirst(row, ['preferred_date', 'appointment_date', 'date']);
  const rawTime = pickFirst(row, ['preferred_time', 'appointment_time', 'time']);
  const timezone = pickFirst(row, ['appointment_timezone', 'preferred_timezone', 'timezone']) || DEFAULT_TIMEZONE;
  const appointmentInfo = parseAppointmentDateTime({ dateValue: rawDate, timeValue: rawTime, timezone });

  if (!appointmentInfo || appointmentInfo.utcDate > until) {
    return null;
  }

  const minutesUntilAppointment = getMinutesUntilAppointment(appointmentInfo, now);
  if (minutesUntilAppointment === null || minutesUntilAppointment <= 0) {
    return null;
  }

  const phone = pickFirst(row, ['phone', 'phone_number', 'mobile', 'telephone']);
  const digits = toDigits(phone);
  if (!digits || digits.length < 9) {
    return null;
  }

  const chatInfo = await getTelegramChatIdByPhone(String(phone));
  if (!chatInfo || !chatInfo.patient_id) {
    return null;
  }

  return {
    patientId: String(chatInfo.patient_id),
    locale: chatInfo.locale === 'ru' ? 'ru' : 'uz',
    patientName: pickFirst(row, ['full_name', 'name', 'patient_name']) || 'Bemor',
    sourceId: String(row.id || row.lead_id || digits),
    appointmentInfo,
    minutesUntilAppointment,
  };
}

async function resolveAppointmentReminderContext(row, { now, until }) {
  const scheduledAt = pickFirst(row, ['scheduled_at', 'appointment_time', 'start_at', 'starts_at']);
  if (!scheduledAt) {
    return null;
  }

  const parsedDate = new Date(scheduledAt);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate > until) {
    return null;
  }

  const minutesUntilAppointment = Math.floor((parsedDate.getTime() - now.getTime()) / 60000);
  if (minutesUntilAppointment <= 0) {
    return null;
  }

  const patientId = pickFirst(row, ['patient_id', 'patientId']);
  if (!patientId) {
    return null;
  }

  const { getTelegramChatId, getLocaleByChatId } = require('../repository/telegramChatRepo');
  const chatId = await getTelegramChatId(String(patientId));
  if (!chatId) {
    return null;
  }

  const persistedLocale = await getLocaleByChatId(chatId);
  const locale = persistedLocale === 'ru' ? 'ru' : 'uz';

  const timezone = pickFirst(row, ['appointment_timezone', 'timezone']) || DEFAULT_TIMEZONE;
  const appointmentInfo = {
    date: parsedDate.toISOString().slice(0, 10),
    time: `${String(parsedDate.getHours()).padStart(2, '0')}:${String(parsedDate.getMinutes()).padStart(2, '0')}`,
    timezone,
    isoWithOffset: parsedDate.toISOString(),
    utcDate: parsedDate,
  };

  return {
    patientId: String(patientId),
    locale,
    patientName: pickFirst(row, ['patient_name', 'full_name', 'name']) || 'Bemor',
    sourceId: String(row.id),
    appointmentInfo,
    minutesUntilAppointment,
  };
}

async function fetchAppointmentRows(until) {
  const nowIso = new Date().toISOString();
  const untilIso = until.toISOString();

  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .gte('scheduled_at', nowIso)
    .lte('scheduled_at', untilIso)
    .order('scheduled_at', { ascending: true })
    .limit(1000);

  if (error) {
    if (!String(error.message || '').toLowerCase().includes('appointments')) {
      console.warn('⚠️ appointments jadvalidan olishda xatolik:', error.message);
    }
    return [];
  }

  return data || [];
}

async function scheduleUpcomingLeadAppointmentReminders(options = {}) {
  const lookAheadDays = options.lookAheadDays || LOOK_AHEAD_DAYS;
  const until = new Date(Date.now() + lookAheadDays * 24 * 60 * 60 * 1000);
  const leads = await fetchLeadRows();

  return scheduleRemindersForRows(leads, {
    lookAheadDays,
    sourceType: 'lead',
    resolveContext: resolveLeadReminderContext,
  });
}

async function scheduleUpcomingPatientAppointmentReminders(options = {}) {
  const lookAheadDays = options.lookAheadDays || LOOK_AHEAD_DAYS;
  const until = new Date(Date.now() + lookAheadDays * 24 * 60 * 60 * 1000);
  const appointments = await fetchAppointmentRows(until);

  if (appointments.length === 0) {
    return { scanned: 0, skipped: 0, created: 0, deduped: 0, lookAheadDays, offsets: REMINDER_OFFSETS_HOURS };
  }

  return scheduleRemindersForRows(appointments, {
    lookAheadDays,
    sourceType: 'appointment',
    resolveContext: resolveAppointmentReminderContext,
  });
}

async function scheduleUpcomingAppointmentReminders(options = {}) {
  const leadStats = await scheduleUpcomingLeadAppointmentReminders(options);
  const appointmentStats = await scheduleUpcomingPatientAppointmentReminders(options);

  return {
    leads: leadStats,
    appointments: appointmentStats,
    scanned: (leadStats.scanned || 0) + (appointmentStats.scanned || 0),
    skipped: (leadStats.skipped || 0) + (appointmentStats.skipped || 0),
    created: (leadStats.created || 0) + (appointmentStats.created || 0),
    deduped: (leadStats.deduped || 0) + (appointmentStats.deduped || 0),
    lookAheadDays: options.lookAheadDays || LOOK_AHEAD_DAYS,
  };
}

module.exports = {
  scheduleUpcomingLeadAppointmentReminders,
  scheduleUpcomingPatientAppointmentReminders,
  scheduleUpcomingAppointmentReminders,
};
