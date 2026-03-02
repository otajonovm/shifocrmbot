const express = require('express');
const { recordPatientCompletion, getPatientLastCompletion } = require('../repository/patientCompletionRepo');
const { scheduleFollowUpMessages } = require('../repository/scheduledMessagesRepo');
const { getTelegramChatIdByPhone } = require('../repository/telegramChatRepo');
const TelegramBot = require('node-telegram-bot-api');

const router = express.Router();
const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
const bot = botToken ? new TelegramBot(botToken, { polling: false }) : null;

// Default follow-up messages (oxirida o'zgartirilishi mumkin)
const DEFAULT_FOLLOW_UP_MESSAGES = [
  {
    delayHours: 24,
    text: `<b>📋 Bemor yakunlash sondan keyin eslatma</b>\n\n` +
          `Sizning tibbiy ko'rik yakunlandi.\n\n` +
          `Agar sizda savollar yoki muammolar bo'lsa, iltimos biz bilan bog'laning.\n\n` +
          `Sizning sog'lig'ingiz bizga muhim! 💚`
  },
  {
    delayHours: 72, // 3 kun keyin
    text: `<b>⚕️ Yo'lni davom etishing haqida</b>\n\n` +
          `Sizning umumiy holatiz qandaydir?\n\n` +
          `Agar tavsiyalarni amal qilishda qiyinchilik bo'lsa, biz yordam bera olamiz.`
  }
];

/**
 * POST /api/patients/complete
 * Bemorni yakunlash va follow-up xabarlarni rejalashtirish
 */
router.post('/complete', async (req, res) => {
  try {
    const { patientId, patientName, phone, notes, customMessages } = req.body;

    if (!patientId || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Patient ID va telefon raqam kerak'
      });
    }

    // Bemor ma'lumotini Telegram chat ID bilan topish
    let chatInfo = await getTelegramChatIdByPhone(phone);

    if (!chatInfo) {
      return res.status(404).json({
        success: false,
        error: 'Bu telefon raqam bilan ro\'yxatdan o\'tgan foydalanuvchi topilmadi'
      });
    }

    // Bemor yakunlashni saqlash
    const completion = await recordPatientCompletion({
      patientId: String(chatInfo.patient_id),
      chatId: String(chatInfo.chat_id),
      patientName: patientName || 'Bemor',
      phone: phone,
      notes: notes || null
    });

    if (!completion) {
      return res.status(500).json({
        success: false,
        error: 'Bemor yakunlashni saqlashda xatolik'
      });
    }

    // Follow-up xabarlarni rejalashtirish
    const messagesToSchedule = customMessages || DEFAULT_FOLLOW_UP_MESSAGES;
    const scheduledMessages = await scheduleFollowUpMessages({
      patientId: String(chatInfo.patient_id),
      patientName: patientName || 'Bemor',
      phone: phone,
      messages: messagesToSchedule
    });

    // Darhol Telegram'da xabar yuborish
    if (bot) {
      try {
        const welcomeMessage = `<b>✅ Yakunlash tasdiqlandi</b>\n\n` +
          `Sizning tibbiy ko'rik yakunlandi!\n\n` +
          `Tez orada sizga follow-up eslatmalari yuboriladi.\n\n` +
          `Sog'lig'ingiz uchun tilaklarimiz! 🙏`;

        await bot.sendMessage(chatInfo.chat_id, welcomeMessage, {
          parse_mode: 'HTML'
        });
      } catch (err) {
        console.error('❌ Darhol xabarni yuborishda xatolik:', err.message);
      }
    }

    res.json({
      success: true,
      message: 'Bemor yakunlandi va follow-up xabarlar rejalashtiryldi',
      completion: completion,
      scheduledMessages: scheduledMessages.length,
      chatId: chatInfo.chat_id
    });

  } catch (err) {
    console.error('❌ Bemor yakunlashda xatolik:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET /api/patients/:patientId/last-completion
 * Bemorning oxirgi yakunlash ma'lumotini olish
 */
router.get('/:patientId/last-completion', async (req, res) => {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        error: 'Patient ID kerak'
      });
    }

    const completion = await getPatientLastCompletion(patientId);

    res.json({
      success: true,
      completion: completion
    });

  } catch (err) {
    console.error('❌ Bemor yakunlash ma\'lumotini olishda xatolik:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
