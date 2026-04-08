const express = require('express');
const { recordPatientCompletion, getPatientLastCompletion } = require('../repository/patientCompletionRepo');
const { scheduleFollowUpMessages } = require('../repository/scheduledMessagesRepo');
const { getTelegramChatIdByPhone } = require('../repository/telegramChatRepo');
const TelegramBot = require('node-telegram-bot-api');

const router = express.Router();
const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
const bot = botToken ? new TelegramBot(botToken, { polling: false }) : null;

const DEFAULT_FOLLOW_UP_MESSAGES = {
  uz: [
    {
      delayHours: 24,
      text: `<b>📋 Yakuniy ko'rikdan keyingi eslatma</b>\n\n` +
            `Sizning ko'rigingiz yakunlandi.\n\n` +
            `Agar savol yoki muammo bo'lsa, biz bilan bog'laning.\n\n` +
            `Sog'lig'ingiz biz uchun muhim! 💚`
    },
    {
      delayHours: 72,
      text: `<b>⚕️ Holatingiz qanday?</b>\n\n` +
            `O'zingizni qanday his qilyapsiz?\n\n` +
            `Tavsiyalar bo'yicha savol bo'lsa, sizga yordam beramiz.`
    }
  ],
  ru: [
    {
      delayHours: 24,
      text: `<b>📋 Напоминание после завершения приёма</b>\n\n` +
            `Ваш приём завершён.\n\n` +
            `Если у вас есть вопросы или дискомфорт — свяжитесь с нами.\n\n` +
            `Ваше здоровье важно для нас! 💚`
    },
    {
      delayHours: 72,
      text: `<b>⚕️ Как ваше самочувствие?</b>\n\n` +
            `Как вы себя чувствуете после приёма?\n\n` +
            `Если есть вопросы по рекомендациям — мы поможем.`
    }
  ]
};

function getLocale(locale) {
  return locale === 'ru' ? 'ru' : 'uz';
}

function getDefaultFollowUps(locale) {
  const normalizedLocale = getLocale(locale);
  return DEFAULT_FOLLOW_UP_MESSAGES[normalizedLocale];
}

function getCompletionMessage(locale) {
  const normalizedLocale = getLocale(locale);
  if (normalizedLocale === 'ru') {
    return `<b>✅ Завершение подтверждено</b>\n\n` +
      `Ваш медицинский приём завершён!\n\n` +
      `Скоро вам будут отправлены follow-up сообщения.\n\n` +
      `Желаем вам крепкого здоровья! 🙏`;
  }

  return `<b>✅ Yakunlash tasdiqlandi</b>\n\n` +
    `Sizning tibbiy ko'rigingiz yakunlandi!\n\n` +
    `Tez orada sizga follow-up eslatmalari yuboriladi.\n\n` +
    `Sog'lig'ingiz uchun tilaklarimiz! 🙏`;
}

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
    const chatInfo = await getTelegramChatIdByPhone(phone);

    if (!chatInfo) {
      return res.status(404).json({
        success: false,
        error: 'Bu telefon raqam bilan ro\'yxatdan o\'tgan foydalanuvchi topilmadi'
      });
    }

    // patientId request'da berilgan bo'lsa undan foydalanamiz,
    // aks holda telegram_chat_ids dagi patient_id ni olamiz.
    const resolvedPatientId = String(patientId || chatInfo.patient_id);

    // Bemor yakunlashni saqlash
    const completion = await recordPatientCompletion({
      patientId: resolvedPatientId,
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
    const locale = getLocale(chatInfo.locale);
    const messagesToSchedule = Array.isArray(customMessages) && customMessages.length > 0
      ? customMessages
      : getDefaultFollowUps(locale);

    const scheduledMessages = await scheduleFollowUpMessages({
      patientId: resolvedPatientId,
      patientName: patientName || 'Bemor',
      phone: phone,
      messages: messagesToSchedule
    });

    // Darhol Telegram'da xabar yuborish
    if (bot) {
      try {
        const welcomeMessage = getCompletionMessage(locale);

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
