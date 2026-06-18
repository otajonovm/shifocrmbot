const TelegramBot = require('node-telegram-bot-api');
const { getTelegramBotOptions } = require('../utils/telegramOptions');
const { getDoctorByPhone } = require('../repository/doctorProfileRepo');
const {
  createDoctorReminderUnique,
  getPendingDoctorReminders,
  normalizeActions,
  updateDoctorReminderStatus,
} = require('../repository/doctorReminderRepo');

const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();

if (!botToken) {
  console.error('❌ TELEGRAM_BOT_TOKEN topilmadi doctorReminderService uchun!');
  throw new Error('TELEGRAM_BOT_TOKEN .env faylda ko\'rsatilgan bo\'lishi kerak');
}

const reminderBot = new TelegramBot(botToken, getTelegramBotOptions(false));
const CHECK_INTERVAL = 30 * 1000;

let schedulerInterval = null;
let reminderProducerRunning = false;
let reminderDeliveryRunning = false;
let schedulerDisabledReason = null;
let missingTableWarningShown = false;

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeEventType(eventType) {
  return String(eventType || 'general').trim().toLowerCase().replace(/\s+/g, '_');
}

function getDefaultDoctorReminderActions(eventType) {
  const normalizedEventType = normalizeEventType(eventType);

  const defaults = {
    upcoming_appointment: [
      { text: '✅ Boshlash', actionKey: 'start' },
      { text: '🔄 Ko‘chirish', actionKey: 'reschedule' },
      { text: '❌ Bekor qilish', actionKey: 'cancel' },
    ],
    follow_up: [
      { text: '📞 Aloqa qilindi', actionKey: 'contacted' },
      { text: '⏰ Ertaga eslat', actionKey: 'remind_tomorrow' },
      { text: '✅ Yopish', actionKey: 'close' },
    ],
    cancellation_alert: [
      { text: '👤 Waiting list', actionKey: 'waiting_list' },
      { text: '📅 Ko‘chirish', actionKey: 'reschedule' },
    ],
    daily_summary: [
      { text: '📋 Ko‘rildi', actionKey: 'reviewed' },
      { text: '✅ Yopish', actionKey: 'close' },
    ],
  };

  return defaults[normalizedEventType] || [
    { text: '✅ Tasdiqlash', actionKey: 'ack' },
    { text: '📝 Izoh', actionKey: 'note' },
  ];
}

function shouldDeliverDoctorReminder(profile, reminder) {
  const preference = String(profile?.notification_preference || 'all_appointments').trim().toLowerCase();
  const eventType = normalizeEventType(reminder?.event_type);
  const metadata = reminder?.metadata || {};

  if (preference === 'mute') {
    return false;
  }

  if (preference === 'daily_summary_only') {
    return eventType === 'daily_summary';
  }

  if (preference === 'urgent_only') {
    return eventType === 'cancellation_alert' || metadata.priority === 'urgent' || metadata.urgent === true;
  }

  return true;
}

function buildDoctorReminderKeyboard(reminder) {
  const actions = normalizeActions(
    reminder?.action_payload?.actions,
    reminder?.event_type
  );

  if (!actions.length) {
    return null;
  }

  return {
    inline_keyboard: [
      actions.map(action => ({
        text: action.text,
        callback_data: `docrem:${reminder.id}:${action.actionKey}`,
      })),
    ],
  };
}

function buildDoctorReminderMessage(reminder) {
  const parts = [];

  if (reminder?.title) {
    parts.push(`<b>${escapeHtml(reminder.title)}</b>`);
  }

  if (reminder?.message) {
    parts.push(escapeHtml(reminder.message));
  }

  const eventType = normalizeEventType(reminder?.event_type);
  if (eventType) {
    parts.push(`\n<code>${escapeHtml(eventType)}</code>`);
  }

  return parts.join('\n\n').trim();
}

async function enqueueDoctorReminderEvent({
  doctorPhone,
  eventType,
  title,
  message,
  scheduledTime,
  actions,
  dedupeKey,
  metadata = {},
}) {
  const normalizedEventType = normalizeEventType(eventType);
  const resolvedActions = normalizeActions(actions, normalizedEventType);

  return createDoctorReminderUnique({
    doctorPhone,
    eventType: normalizedEventType,
    title,
    message,
    scheduledTime,
    actionPayload: {
      actions: resolvedActions,
    },
    dedupeKey,
    metadata,
  });
}

async function processDoctorReminderCycle(botClient = reminderBot) {
  if (reminderDeliveryRunning) {
    return { skipped: true, reason: 'DELIVERY_BUSY' };
  }

  reminderDeliveryRunning = true;
  try {
    const reminders = await getPendingDoctorReminders();
    if (reminders.length === 0) {
      return { processed: 0, sent: 0, failed: 0, skipped: 0 };
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const reminder of reminders) {
      const profile = await getDoctorByPhone(reminder.doctor_phone);

      if (!profile || profile.is_active === false) {
        skipped += 1;
        await updateDoctorReminderStatus(reminder.id, 'skipped', {
          failureReason: 'Doctor profile topilmadi yoki faol emas',
        });
        continue;
      }

      if (!shouldDeliverDoctorReminder(profile, reminder)) {
        skipped += 1;
        await updateDoctorReminderStatus(reminder.id, 'skipped', {
          failureReason: `Preference filtered: ${profile.notification_preference || 'unknown'}`,
        });
        continue;
      }

      if (!profile.chat_id) {
        failed += 1;
        await updateDoctorReminderStatus(reminder.id, 'failed', {
          failureReason: 'Doctor chat_id topilmadi',
        });
        continue;
      }

      try {
        const replyMarkup = buildDoctorReminderKeyboard(reminder);
        const text = buildDoctorReminderMessage(reminder);

        await botClient.sendMessage(profile.chat_id, text, {
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        });

        sent += 1;
        await updateDoctorReminderStatus(reminder.id, 'sent');
      } catch (sendError) {
        failed += 1;
        await updateDoctorReminderStatus(reminder.id, 'failed', {
          failureReason: String(sendError?.message || sendError).slice(0, 200),
        });
      }
    }

    return {
      processed: reminders.length,
      sent,
      failed,
      skipped,
    };
  } catch (err) {
    if (err?.code === 'DOCTOR_REMINDERS_TABLE_MISSING') {
      schedulerDisabledReason = 'DOCTOR_REMINDERS_TABLE_MISSING';

      if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
      }

      if (!missingTableWarningShown) {
        missingTableWarningShown = true;
        console.error('❌ doctor_reminders jadvali topilmadi, doctor scheduler to\'xtatildi.');
        console.error('   Yechim: migrations/006_doctor_reminders.sql ni DB ga qo\'llang.');
      }

      return { error: 'DOCTOR_REMINDERS_TABLE_MISSING' };
    }

    console.error('❌ Doctor reminder cycle xatolik:', err?.message || err);
    return { error: String(err?.message || err) };
  } finally {
    reminderDeliveryRunning = false;
  }
}

async function runDoctorReminderCycle() {
  if (reminderProducerRunning) {
    return { skipped: true, reason: 'PRODUCER_BUSY' };
  }

  reminderProducerRunning = true;
  try {
    return await processDoctorReminderCycle(reminderBot);
  } finally {
    reminderProducerRunning = false;
  }
}

function startDoctorReminderScheduler() {
  if (schedulerDisabledReason === 'DOCTOR_REMINDERS_TABLE_MISSING') {
    console.warn('⚠️ Doctor reminder scheduler ishga tushmadi: doctor_reminders jadvali yo\'q');
    return;
  }

  if (schedulerInterval) {
    console.warn('⚠️ Doctor reminder scheduler allaqachon ishga tushgan');
    return;
  }

  console.log('🧠 Doctor reminder scheduler ishga tushmoqda...');
  runDoctorReminderCycle();
  schedulerInterval = setInterval(runDoctorReminderCycle, CHECK_INTERVAL);
}

function stopDoctorReminderScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('🛑 Doctor reminder scheduler to\'xtadi');
  }
}

module.exports = {
  buildDoctorReminderKeyboard,
  enqueueDoctorReminderEvent,
  getDefaultDoctorReminderActions,
  processDoctorReminderCycle,
  runDoctorReminderCycle,
  startDoctorReminderScheduler,
  stopDoctorReminderScheduler,
  shouldDeliverDoctorReminder,
};