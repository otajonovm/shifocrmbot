const supabase = require('../supabase');
const { getTelegramChatIdByPhone } = require('../repository/telegramChatRepo');
const { createScheduledMessageUnique } = require('../repository/scheduledMessagesRepo');

const LOOK_AHEAD_DAYS = 3;
const REMINDER_OFFSETS_HOURS = [24, 2];
const DEFAULT_TIMEZONE = 'Asia/Tashkent';
const DEFAULT_TIME = '09:00';

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

function buildReminderMessage(locale, patientName, appointmentInfo, offsetHours) {
  const name = patientName || 'Bemor';
  const datePart = appointmentInfo.date;
  const timePart = appointmentInfo.time;

  if (locale === 'ru') {
    return `🗓 <b>Напоминание о приёме</b>\n\n` +
      `👤 Пациент: ${name}\n` +
      `📅 Дата: ${datePart}\n` +
      `⏰ Время: ${timePart}\n\n` +
      (offsetHours === 24
        ? `Через 24 часа у вас запись. Пожалуйста, приходите вовремя.`
        : `Через 2 часа у вас запись. Пожалуйста, подготовьтесь заранее.`);
  }

  return `🗓 <b>Qabul eslatmasi</b>\n\n` +
    `👤 Bemor: ${name}\n` +
    `📅 Sana: ${datePart}\n` +
    `⏰ Vaqt: ${timePart}\n\n` +
    (offsetHours === 24
      ? `24 soatdan keyin qabulingiz bor. Iltimos, vaqtida keling.`
      : `2 soatdan keyin qabulingiz bor. Iltimos, oldindan tayyor bo'ling.`);
}

function isCancelledStatus(value) {
  const status = String(value || '').toLowerCase();
  if (!status) {
    return false;
  }

  return [
    'cancel', 'canceled', 'cancelled', 'rejected', 'closed', 'archived', 'deleted'
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

async function scheduleUpcomingLeadAppointmentReminders({ lookAheadDays = LOOK_AHEAD_DAYS } = {}) {
  const now = new Date();
  const until = new Date(now.getTime() + lookAheadDays * 24 * 60 * 60 * 1000);

  const leads = await fetchLeadRows();

  let scanned = 0;
  let skipped = 0;
  let created = 0;
  let deduped = 0;

  for (const row of leads) {
    scanned += 1;

    if (isCancelledStatus(row.status || row.state)) {
      skipped += 1;
      continue;
    }

    const rawDate = pickFirst(row, ['preferred_date', 'appointment_date', 'date']);
    const rawTime = pickFirst(row, ['preferred_time', 'appointment_time', 'time']);
    const timezone = pickFirst(row, ['appointment_timezone', 'preferred_timezone', 'timezone']) || DEFAULT_TIMEZONE;
    const appointmentInfo = parseAppointmentDateTime({ dateValue: rawDate, timeValue: rawTime, timezone });

    if (!appointmentInfo) {
      skipped += 1;
      continue;
    }

    if (appointmentInfo.utcDate < now || appointmentInfo.utcDate > until) {
      skipped += 1;
      continue;
    }

    const phone = pickFirst(row, ['phone', 'phone_number', 'mobile', 'telephone']);
    const digits = toDigits(phone);
    if (!digits || digits.length < 9) {
      skipped += 1;
      continue;
    }

    const chatInfo = await getTelegramChatIdByPhone(String(phone));
    if (!chatInfo || !chatInfo.patient_id) {
      skipped += 1;
      continue;
    }

    const patientId = String(chatInfo.patient_id);
    const locale = chatInfo.locale === 'ru' ? 'ru' : 'uz';
    const leadName = pickFirst(row, ['full_name', 'name', 'patient_name']) || 'Bemor';
    const leadId = String(row.id || row.lead_id || digits);

    for (const offsetHours of REMINDER_OFFSETS_HOURS) {
      const scheduledTime = new Date(appointmentInfo.utcDate.getTime() - offsetHours * 60 * 60 * 1000);

      if (scheduledTime <= now) {
        continue;
      }

      const message = buildReminderMessage(locale, leadName, appointmentInfo, offsetHours);
      const reminderKey = `lead:${leadId}:appt:${appointmentInfo.isoWithOffset}:offset:${offsetHours}`;

      const result = await createScheduledMessageUnique({
        patientId,
        message,
        scheduledTime,
        reminderKey,
      });

      if (result && result._deduped) {
        deduped += 1;
      } else if (result) {
        created += 1;
      }
    }
  }

  return {
    scanned,
    skipped,
    created,
    deduped,
    lookAheadDays,
    offsets: REMINDER_OFFSETS_HOURS,
  };
}

module.exports = {
  scheduleUpcomingLeadAppointmentReminders,
};
