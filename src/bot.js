const TelegramBot = require('node-telegram-bot-api');
const { isValidPatientId, normalizePhone, isValidPhone } = require('./utils/validators');
const { getTelegramChatIdByPhone, saveTelegramChatId } = require('./repository/telegramChatRepo');
const { getPatientById, getPatientByPhone } = require('./repository/patientRepo');

const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();

if (!botToken) {
  console.error('❌ TELEGRAM_BOT_TOKEN topilmadi!');
  console.error('   Environment variable: TELEGRAM_BOT_TOKEN');
  console.error('   Railway dashboard → Variables → TELEGRAM_BOT_TOKEN qo\'shing');
  throw new Error('TELEGRAM_BOT_TOKEN .env faylda ko\'rsatilgan bo\'lishi kerak');
}

const bot = new TelegramBot(botToken, { polling: true });

// FSM state (oddiy object bilan)
const userStates = {};

/**
 * Foydalanuvchi state ni o'chirish
 */
function clearUserState(chatId) {
  delete userStates[chatId];
}

/**
 * Foydalanuvchi state ni olish
 */
function getUserState(chatId) {
  return userStates[chatId] || null;
}

/**
 * Foydalanuvchi state ni saqlash
 */
function setUserState(chatId, state) {
  userStates[chatId] = state;
}

// /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const text = `Xush kelibsiz! ShifoCRM botiga.\n\n` +
    `Bu bot orqali sizga qabul eslatmalari va xabarlar yuboriladi.\n\n` +
    `Ro'yxatdan o'tish uchun /register buyrug'ini yuboring.`;
  await bot.sendMessage(chatId, text);
});

// /help
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const text = `📋 Bot buyruqlari:\n\n` +
    `/start - Botni boshlash\n` +
    `/register - Ro'yxatdan o'tish (telefon raqam)\n` +
    `/help - Yordam\n\n` +
    `Telefon raqamingizni yuborsangiz, ShifoCRM tizimida tekshiriladi.\n` +
    `Ro'yxatdan o'tganingizdan keyin sizga qabul eslatmalari va xabarlar yuboriladi.`;
  await bot.sendMessage(chatId, text);
});

// /register
bot.onText(/\/register/, async (msg) => {
  const chatId = msg.chat.id;
  const text = `Ro'yxatdan o'tish:\n\n` +
    `Iltimos, pastdagi tugma orqali kontakt yuboring yoki telefon raqamingizni yozing:\n` +
    `Masalan: +998901234567 yoki 901234567\n\n` +
    `Telefon raqamingiz ShifoCRM tizimida tekshiriladi.`;
  setUserState(chatId, { step: 'waiting_phone' });
  await bot.sendMessage(chatId, text, {
    reply_markup: {
      keyboard: [[{ text: '📱 Kontaktni yuborish', request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
});

async function registerUserByPhone({ chatId, phoneRaw, msg }) {
  if (!isValidPhone(phoneRaw)) {
    await bot.sendMessage(
      chatId,
      'Noto\'g\'ri telefon raqam format.\n\n' +
      'Iltimos, kontakt yuboring yoki telefon raqamingizni kiriting:\n' +
      'Masalan: +998901234567 yoki 901234567'
    );
    return;
  }

  const phone = normalizePhone(phoneRaw);

  // ShifoCRM'dan telefon bo'yicha qidirish
  const patient = await getPatientByPhone(phone);

  if (!patient) {
    clearUserState(chatId);
    await bot.sendMessage(
      chatId,
      '❌ Bu telefon raqam ShifoCRM tizimida topilmadi.\n\n' +
      'Iltimos, to\'g\'ri telefon raqamingizni kiriting yoki administrator bilan bog\'laning.',
      { reply_markup: { remove_keyboard: true } }
    );
    return;
  }

  // Patient topildi, saqlash
  try {
    const patientId = String(patient.id);
    console.log(`📝 Patient topildi, saqlash boshlandi:`, {
      patientId,
      chatId: String(chatId),
      patientName: patient.full_name,
      phone
    });

    const saved = await saveTelegramChatId({
      patientId: patientId,
      chatId: String(chatId),
      username: msg.from.username || null,
      firstName: msg.from.first_name || null,
      phone: phone,
    });

    if (saved) {
      clearUserState(chatId);
      const patientName = patient.full_name || 'Bemor';
      await bot.sendMessage(
        chatId,
        `✅ Ro'yxatdan o'tgansiz, ${patientName}!\n\n` +
        `Patient ID: ${patientId}\n` +
        `Telefon: ${phone}\n\n` +
        `Endi sizga qabul eslatmalari va xabarlar yuboriladi.`,
        { reply_markup: { remove_keyboard: true } }
      );
    } else {
      console.error('❌ saveTelegramChatId false qaytdi');
      console.error('   Patient ID:', patientId);
      console.error('   Chat ID:', chatId);
      console.error('   Phone:', phone);
      await bot.sendMessage(
        chatId,
        '❌ Xatolik yuz berdi. Qayta urinib ko\'ring yoki administrator bilan bog\'laning.\n\n' +
        'Iltimos, terminal loglarini tekshiring.'
      );
    }
  } catch (err) {
    console.error('❌ Exception patient saqlashda:', err);
    await bot.sendMessage(
      chatId,
      '❌ Xatolik yuz berdi: ' + err.message + '\n\n' +
      'Iltimos, administrator bilan bog\'laning.'
    );
  }
}

// Matn xabarlarini qayta ishlash (telefon raqam tekshirish)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const contact = msg.contact;
  const state = getUserState(chatId);
  
  // Agar /register holatida bo'lsa
  if (state && state.step === 'waiting_phone') {
    // Komandalarni qayta ishlamaslik (/register, /help va h.k.)
    if (text && text.startsWith('/')) {
      return;
    }

    // Kontakt yuborilgan bo'lsa
    if (contact && contact.phone_number) {
      if (contact.user_id && msg.from?.id && contact.user_id !== msg.from.id) {
        await bot.sendMessage(
          chatId,
          '❌ Iltimos, o\'zingizning kontaktingizni yuboring.\n' +
          'Pastdagi "📱 Kontaktni yuborish" tugmasini bosing.'
        );
        return;
      }

      await registerUserByPhone({ chatId, phoneRaw: contact.phone_number, msg });
      return;
    }

    if (!text) {
      await bot.sendMessage(chatId, 'Iltimos, kontakt yoki telefon raqam yuboring.');
      return;
    }

    await registerUserByPhone({ chatId, phoneRaw: text.trim(), msg });
    return;
  }
  
  // Agar oddiy xabar bo'lsa va telefon raqam formatida bo'lsa, avtomatik tekshirish
  if (text && isValidPhone(text.trim()) && !text.startsWith('/')) {
    const phone = normalizePhone(text.trim());
    const patient = await getPatientByPhone(phone);
    
    if (patient) {
      await bot.sendMessage(
        chatId,
        `✅ Bu telefon raqam ShifoCRM tizimida mavjud.\n\n` +
        `Bemor: ${patient.full_name || 'Noma\'lum'}\n` +
        `Patient ID: ${patient.id}\n\n` +
        `Ro'yxatdan o'tish uchun /register buyrug'ini yuboring.`
      );
    } else {
      await bot.sendMessage(
        chatId,
        `❌ Bu telefon raqam ShifoCRM tizimida topilmadi.\n\n` +
        `Iltimos, to'g'ri telefon raqam kiriting yoki administrator bilan bog'laning.`
      );
    }
  }
});

module.exports = bot;
