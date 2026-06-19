const TelegramBot = require('node-telegram-bot-api');
const { getTelegramBotOptions } = require('../utils/telegramOptions');
const { getPendingMessages, updateMessageStatus, claimMessageForDelivery, scheduleMessageRetry } = require('../repository/scheduledMessagesRepo');
const { getTelegramChatId } = require('../repository/telegramChatRepo');
const { scheduleUpcomingAppointmentReminders } = require('./appointmentReminderService');
const { scheduleDueTreatmentPlanReminders } = require('./treatmentPlanReminderService');
const {
  buildRetryFailureReason,
  isPermanentTelegramSendError,
  isRetryableTelegramSendError,
  parseRetryCount,
} = require('../utils/telegramSendErrors');

const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();

if (!botToken) {
  console.error('❌ TELEGRAM_BOT_TOKEN topilmadi messageScheduler uchun!');
  throw new Error('TELEGRAM_BOT_TOKEN .env faylda ko\'rsatilgan bo\'lishi kerak');
}

const schedulerBot = new TelegramBot(botToken, getTelegramBotOptions(false));

// Xabarlarni yuborish uchun interval (har 30 soniyada tekshirish)
const CHECK_INTERVAL = 30 * 1000; // 30 sekund
let schedulerInterval = null;
let schedulerDisabledReason = null;
let missingTableWarningShown = false;
let reminderProducerRunning = false;
let deliveryRunning = false;

const MAX_SEND_RETRIES = Number(process.env.SCHEDULER_MAX_SEND_RETRIES || 3);
const RETRY_DELAY_MS = Number(process.env.SCHEDULER_RETRY_DELAY_MS || 5 * 60 * 1000);

function isTwoHourLeadReminder(reminderKey) {
  if (!reminderKey || typeof reminderKey !== 'string') {
    return false;
  }
  return reminderKey.includes('lead:') && reminderKey.includes('offset:2');
}

function buildTwoHourReminderKeyboard(messageId) {
  if (!messageId) {
    return null;
  }

  return {
    inline_keyboard: [
      [
        { text: '✅ Ha boraman', callback_data: `apptresp:${messageId}:yes` },
        { text: '❌ Yo\'q borolmayman', callback_data: `apptresp:${messageId}:no` }
      ]
    ]
  };
}

async function runAppointmentReminderCycle() {
  if (reminderProducerRunning) {
    return { skipped: true, reason: 'PRODUCER_BUSY' };
  }

  reminderProducerRunning = true;
  try {
    const stats = await scheduleUpcomingAppointmentReminders();
    const treatmentStats = await scheduleDueTreatmentPlanReminders();

    if (treatmentStats?.created > 0 || treatmentStats?.deduped > 0) {
      console.log(
        `💊 Treatment plan reminders: created=${treatmentStats.created}, deduped=${treatmentStats.deduped}, scanned=${treatmentStats.scanned}`
      );
    }
    if ((stats?.created || 0) > 0 || (stats?.deduped || 0) > 0) {
      console.log(
        `🗓 Appointment reminder cycle: created=${stats.created}, deduped=${stats.deduped}, scanned=${stats.scanned}` +
        (stats.leads ? ` (leads=${stats.leads.created}, appts=${stats.appointments?.created || 0})` : '')
      );
    }
    return stats;
  } catch (err) {
    console.error('❌ Appointment reminder cycle xatolik:', err?.message || err);
    return { error: String(err?.message || err) };
  } finally {
    reminderProducerRunning = false;
  }
}

/**
 * Pending xabarlarni tekshirish va yuborish
 */
async function checkAndSendPendingMessages() {
  if (deliveryRunning) {
    return { skipped: true, reason: 'DELIVERY_BUSY' };
  }

  deliveryRunning = true;

  try {
    await runAppointmentReminderCycle();

    const messages = await getPendingMessages();

    if (messages.length === 0) {
      return { processed: 0, sent: 0, failed: 0, retried: 0 };
    }

    console.log(`📬 ${messages.length} ta pending xabar tekshirilmoqda...`);

    let sent = 0;
    let failed = 0;
    let retried = 0;

    for (const msgRecord of messages) {
      const claimed = await claimMessageForDelivery(msgRecord.id);
      if (!claimed) {
        continue;
      }

      const chatIdFromRelation = Array.isArray(msgRecord.telegram_chat_ids)
        ? msgRecord.telegram_chat_ids?.[0]?.chat_id
        : msgRecord.telegram_chat_ids?.chat_id;

      const chatId = chatIdFromRelation || await getTelegramChatId(msgRecord.patient_id);

      if (!chatId) {
        console.warn(`⚠️ Chat ID topilmadi message ${msgRecord.id} uchun`);
        await updateMessageStatus(msgRecord.id, 'failed', 'Chat ID topilmadi');
        failed += 1;
        continue;
      }

      try {
        console.log(`📤 Xabar yuborilmoqda: ${chatId}`);

        const replyMarkup = isTwoHourLeadReminder(msgRecord.reminder_key)
          ? buildTwoHourReminderKeyboard(msgRecord.id)
          : null;

        await schedulerBot.sendMessage(chatId, msgRecord.message, {
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        });

        const updated = await updateMessageStatus(msgRecord.id, 'sent');
        if (!updated) {
          console.warn(`⚠️ Xabar yuborildi, lekin status yangilanmadi: ${msgRecord.id}`);
        }

        sent += 1;
        console.log(`✅ Xabar yuborildi: ${msgRecord.id} -> ${chatId}`);
      } catch (err) {
        const errorMessage = err?.message || String(err);
        console.error(`❌ Xabar yuborishda xatolik (${chatId}):`, errorMessage);

        const previousRetries = parseRetryCount(msgRecord.failure_reason);
        const nextRetry = previousRetries + 1;

        if (isRetryableTelegramSendError(err) && nextRetry < MAX_SEND_RETRIES) {
          await scheduleMessageRetry(msgRecord.id, {
            retryCount: nextRetry,
            delayMs: RETRY_DELAY_MS * nextRetry,
            reason: errorMessage,
          });
          retried += 1;
          continue;
        }

        const failureReason = isPermanentTelegramSendError(err)
          ? `blocked:${errorMessage.substring(0, 180)}`
          : buildRetryFailureReason(nextRetry, errorMessage);

        await updateMessageStatus(msgRecord.id, 'failed', failureReason.substring(0, 200));
        failed += 1;
      }
    }

    return { processed: messages.length, sent, failed, retried };
  } catch (err) {
    if (err?.code === 'SCHEDULED_MESSAGES_TABLE_MISSING') {
      schedulerDisabledReason = 'SCHEDULED_MESSAGES_TABLE_MISSING';

      if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
      }

      if (!missingTableWarningShown) {
        missingTableWarningShown = true;
        console.error('❌ scheduled_messages jadvali topilmadi, scheduler to\'xtatildi.');
        console.error('   Yechim: migrations/002_create_scheduled_messages.sql ni DB ga qo\'llang.');
        if (err?.details) {
          console.error('   DB xabari:', err.details);
        }
      }
      return;
    }

    console.error('❌ Pending xabarlarni tekshirishda xatolik:', err);
    return { error: String(err?.message || err) };
  } finally {
    deliveryRunning = false;
  }
}

/**
 * Message scheduler ni boshlash
 */
function startScheduler() {
  if (schedulerDisabledReason === 'SCHEDULED_MESSAGES_TABLE_MISSING') {
    console.warn('⚠️ Message scheduler ishga tushmadi: scheduled_messages jadvali yo\'q');
    return;
  }

  if (schedulerInterval) {
    console.warn('⚠️ Message scheduler allaqachon ishga tushgan');
    return;
  }

  console.log('🕐 Message scheduler ishga tushmoqda...');
  console.log(`   Har ${CHECK_INTERVAL / 1000} soniyada tekshirish`);

  // Darhol birinchi marta tekshirish
  checkAndSendPendingMessages();

  // Keyin har 30 soniyada tekshirish
  schedulerInterval = setInterval(checkAndSendPendingMessages, CHECK_INTERVAL);
}

/**
 * Message scheduler ni to'xtatish
 */
function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('🛑 Message scheduler to\'xtadi');
  }
}

/**
 * Scheduler holatini olish
 */
function isSchedulerRunning() {
  return schedulerInterval !== null;
}

function getSchedulerDisabledReason() {
  return schedulerDisabledReason;
}

module.exports = {
  startScheduler,
  stopScheduler,
  isSchedulerRunning,
  getSchedulerDisabledReason,
  checkAndSendPendingMessages,
  runAppointmentReminderCycle
};
