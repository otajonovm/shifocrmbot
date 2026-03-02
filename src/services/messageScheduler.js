const TelegramBot = require('node-telegram-bot-api');
const { getPendingMessages, updateMessageStatus } = require('../repository/scheduledMessagesRepo');

const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();

if (!botToken) {
  console.error('❌ TELEGRAM_BOT_TOKEN topilmadi messageScheduler uchun!');
  throw new Error('TELEGRAM_BOT_TOKEN .env faylda ko\'rsatilgan bo\'lishi kerak');
}

const schedulerBot = new TelegramBot(botToken, { polling: false });

// Xabarlarni yuborish uchun interval (har 30 soniyada tekshirish)
const CHECK_INTERVAL = 30 * 1000; // 30 sekund
let schedulerInterval = null;

/**
 * Pending xabarlarni tekshirish va yuborish
 */
async function checkAndSendPendingMessages() {
  try {
    const messages = await getPendingMessages();

    if (messages.length === 0) {
      return; // Hech qanday xabar yo'q
    }

    console.log(`📬 ${messages.length} ta pending xabar tekshirilmoqda...`);

    for (const msgRecord of messages) {
      if (!msgRecord.telegram_chat_ids || msgRecord.telegram_chat_ids.length === 0) {
        console.warn(`⚠️ Chat ID topilmadi message ${msgRecord.id} uchun`);
        await updateMessageStatus(msgRecord.id, 'failed', 'Chat ID topilmadi');
        continue;
      }

      const chatInfo = msgRecord.telegram_chat_ids[0];
      const chatId = chatInfo.chat_id;

      try {
        console.log(`📤 Xabar yuborilmoqda: ${chatId}`);
        
        await schedulerBot.sendMessage(chatId, msgRecord.message, {
          parse_mode: 'HTML',
          disable_web_page_preview: true
        });

        await updateMessageStatus(msgRecord.id, 'sent');
        console.log(`✅ Xabar yuborildi: ${msgRecord.id} -> ${chatId}`);
      } catch (err) {
        console.error(`❌ Xabar yuborishda xatolik (${chatId}):`, err.message);
        const failureReason = err.message.substring(0, 200);
        await updateMessageStatus(msgRecord.id, 'failed', failureReason);
      }
    }
  } catch (err) {
    console.error('❌ Pending xabarlarni tekshirishda xatolik:', err);
  }
}

/**
 * Message scheduler ni boshlash
 */
function startScheduler() {
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

module.exports = {
  startScheduler,
  stopScheduler,
  isSchedulerRunning,
  checkAndSendPendingMessages
};
