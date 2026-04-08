const TelegramBot = require('node-telegram-bot-api');
const { normalizePhone, isValidPhone } = require('./utils/validators');
const { saveTelegramChatId, getLocaleByChatId } = require('./repository/telegramChatRepo');
const { getPatientByPhone } = require('./repository/patientRepo');

const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();

if (!botToken) {
  console.error('❌ TELEGRAM_BOT_TOKEN topilmadi!');
  console.error('   Environment variable: TELEGRAM_BOT_TOKEN');
  console.error('   Railway dashboard → Variables → TELEGRAM_BOT_TOKEN qo\'shing');
  throw new Error('TELEGRAM_BOT_TOKEN .env faylda ko\'rsatilgan bo\'lishi kerak');
}

const bot = new TelegramBot(botToken, { polling: true });

const LANG_UZ = "🇺🇿 O'zbekcha";
const LANG_RU = '🇷🇺 Русский';

// FSM state (oddiy object bilan)
const userStates = {};
const userLocales = {};

const messages = {
  uz: {
    languageAsk: 'Tilni tanlang / Выберите язык:',
    languageSelected: '✅ Til tanlandi: O\'zbekcha',
    languageInvalid: 'Iltimos, quyidagi tugmalardan birini tanlang:',
    startWelcome:
      `Xush kelibsiz! ShifoCRM botiga.\n\n` +
      `Bu bot orqali sizga qabul eslatmalari va xabarlar yuboriladi.\n\n` +
      `Ro'yxatdan o'tish uchun /register buyrug'ini yuboring.`,
    help:
      `📋 Bot buyruqlari:\n\n` +
      `/start - Botni boshlash\n` +
      `/register - Ro'yxatdan o'tish (telefon raqam)\n` +
      `/help - Yordam\n\n` +
      `Telefon raqamingizni yuborsangiz, ShifoCRM tizimida tekshiriladi.\n` +
      `Ro'yxatdan o'tganingizdan keyin sizga qabul eslatmalari va xabarlar yuboriladi.`,
    registerPrompt:
      `Ro'yxatdan o'tish:\n\n` +
      `Iltimos, pastdagi tugma orqali kontakt yuboring yoki telefon raqamingizni yozing:\n` +
      `Masalan: +998901234567 yoki 901234567\n\n` +
      `Telefon raqamingiz ShifoCRM tizimida tekshiriladi.`,
    sendContactBtn: '📱 Kontaktni yuborish',
    invalidPhone:
      `Noto'g'ri telefon raqam format.\n\n` +
      `Iltimos, kontakt yuboring yoki telefon raqamingizni kiriting:\n` +
      `Masalan: +998901234567 yoki 901234567`,
    notFound:
      `❌ Bu telefon raqam ShifoCRM tizimida (bemorlar yoki leadlar orasida) topilmadi.\n\n` +
      `Iltimos, to'g'ri telefon raqamingizni kiriting yoki administrator bilan bog'laning.`,
    successRegistration:
      `✅ Ro'yxatdan o'tgansiz, {patientName}!\n\n` +
      `Holat: {roleName}\n` +
      `ID: {patientId}\n` +
      `Telefon: {phone}\n\n` +
      `Endi sizga qabul eslatmalari va xabarlar yuboriladi.`,
    roleLead: 'Potensial mijoz (Lead)',
    rolePatient: 'Bemor',
    unknownCustomer: 'Mijoz',
    genericError:
      `❌ Xatolik yuz berdi. Qayta urinib ko'ring yoki administrator bilan bog'laning.\n\n` +
      `Iltimos, terminal loglarini tekshiring.`,
    genericErrorWithDetails:
      `❌ Xatolik yuz berdi: {error}\n\n` +
      `Iltimos, administrator bilan bog'laning.`,
    ownContactOnly:
      `❌ Iltimos, o'zingizning kontaktingizni yuboring.\n` +
      `Pastdagi "📱 Kontaktni yuborish" tugmasini bosing.`,
    sendContactOrPhone: 'Iltimos, kontakt yoki telefon raqam yuboring.',
    phoneFound:
      `✅ Bu telefon raqam ShifoCRM tizimida mavjud.\n\n` +
      `Mijoz: {name}\n` +
      `Holat: {roleName}\n` +
      `ID: {id}\n\n` +
      `Ro'yxatdan o'tish uchun /register buyrug'ini yuboring.`,
    phoneNotFound:
      `❌ Bu telefon raqam ShifoCRM tizimida topilmadi.\n\n` +
      `Iltimos, to'g'ri telefon raqam kiriting yoki administrator bilan bog'laning.`,
  },
  ru: {
    languageAsk: 'Выберите язык / Tilni tanlang:',
    languageSelected: '✅ Язык выбран: Русский',
    languageInvalid: 'Пожалуйста, выберите одну из кнопок ниже:',
    startWelcome:
      `Добро пожаловать в ShifoCRM бот!\n\n` +
      `Через этого бота вы будете получать напоминания о приёмах и сообщения.\n\n` +
      `Для регистрации отправьте команду /register.`,
    help:
      `📋 Команды бота:\n\n` +
      `/start - Начать работу с ботом\n` +
      `/register - Регистрация (номер телефона)\n` +
      `/help - Помощь\n\n` +
      `Если отправите номер телефона, он будет проверен в системе ShifoCRM.\n` +
      `После регистрации вы будете получать напоминания о приёмах и сообщения.`,
    registerPrompt:
      `Регистрация:\n\n` +
      `Пожалуйста, отправьте контакт через кнопку ниже или введите номер телефона:\n` +
      `Например: +998901234567 или 901234567\n\n` +
      `Ваш номер будет проверен в системе ShifoCRM.`,
    sendContactBtn: '📱 Отправить контакт',
    invalidPhone:
      `Неверный формат номера телефона.\n\n` +
      `Пожалуйста, отправьте контакт или введите номер телефона:\n` +
      `Например: +998901234567 или 901234567`,
    notFound:
      `❌ Этот номер не найден в системе ShifoCRM (среди пациентов или лидов).\n\n` +
      `Пожалуйста, введите правильный номер телефона или обратитесь к администратору.`,
    successRegistration:
      `✅ Вы зарегистрированы, {patientName}!\n\n` +
      `Статус: {roleName}\n` +
      `ID: {patientId}\n` +
      `Телефон: {phone}\n\n` +
      `Теперь вы будете получать напоминания о приёмах и сообщения.`,
    roleLead: 'Потенциальный клиент (Lead)',
    rolePatient: 'Пациент',
    unknownCustomer: 'Клиент',
    genericError:
      `❌ Произошла ошибка. Попробуйте снова или обратитесь к администратору.\n\n` +
      `Пожалуйста, проверьте логи в терминале.`,
    genericErrorWithDetails:
      `❌ Произошла ошибка: {error}\n\n` +
      `Пожалуйста, обратитесь к администратору.`,
    ownContactOnly:
      `❌ Пожалуйста, отправьте свой контакт.\n` +
      `Нажмите кнопку "📱 Отправить контакт" ниже.`,
    sendContactOrPhone: 'Пожалуйста, отправьте контакт или номер телефона.',
    phoneFound:
      `✅ Этот номер есть в системе ShifoCRM.\n\n` +
      `Клиент: {name}\n` +
      `Статус: {roleName}\n` +
      `ID: {id}\n\n` +
      `Для регистрации отправьте команду /register.`,
    phoneNotFound:
      `❌ Этот номер не найден в системе ShifoCRM.\n\n` +
      `Пожалуйста, введите правильный номер телефона или обратитесь к администратору.`,
  },
};

function formatMessage(template, params = {}) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''));
}

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

function setUserLocale(chatId, locale) {
  userLocales[chatId] = locale === 'ru' ? 'ru' : 'uz';
}

function hasUserLocale(chatId) {
  return Object.prototype.hasOwnProperty.call(userLocales, chatId);
}

function getUserLocale(chatId) {
  return userLocales[chatId] || 'uz';
}

async function ensureUserLocale(chatId) {
  if (hasUserLocale(chatId)) {
    return getUserLocale(chatId);
  }

  const persistedLocale = await getLocaleByChatId(chatId);
  if (persistedLocale) {
    setUserLocale(chatId, persistedLocale);
    return persistedLocale;
  }

  return null;
}

function t(chatId, key, params) {
  const locale = getUserLocale(chatId);
  const dict = messages[locale] || messages.uz;
  const value = dict[key] || messages.uz[key] || '';
  if (!params) {
    return value;
  }
  return formatMessage(value, params);
}

async function sendLanguagePicker(chatId, localeMaybe = 'uz') {
  const locale = localeMaybe === 'ru' ? 'ru' : 'uz';
  await bot.sendMessage(chatId, messages[locale].languageAsk, {
    reply_markup: {
      keyboard: [[{ text: LANG_UZ }, { text: LANG_RU }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

async function sendHelp(chatId) {
  await bot.sendMessage(chatId, t(chatId, 'help'));
}

async function sendStartWelcome(chatId) {
  await bot.sendMessage(chatId, t(chatId, 'startWelcome'));
}

async function startRegister(chatId) {
  setUserState(chatId, { step: 'waiting_phone' });
  await bot.sendMessage(chatId, t(chatId, 'registerPrompt'), {
    reply_markup: {
      keyboard: [[{ text: t(chatId, 'sendContactBtn'), request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

// /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  const existingLocale = await ensureUserLocale(chatId);
  if (existingLocale) {
    await sendStartWelcome(chatId);
    return;
  }

  setUserState(chatId, { step: 'waiting_language', pendingCommand: 'start' });
  await sendLanguagePicker(chatId, getUserLocale(chatId));
});

// /help
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  await ensureUserLocale(chatId);
  if (!hasUserLocale(chatId)) {
    setUserState(chatId, { step: 'waiting_language', pendingCommand: 'help' });
    await sendLanguagePicker(chatId, 'uz');
    return;
  }
  await sendHelp(chatId);
});

// /register
bot.onText(/\/register/, async (msg) => {
  const chatId = msg.chat.id;
  await ensureUserLocale(chatId);
  if (!hasUserLocale(chatId)) {
    setUserState(chatId, { step: 'waiting_language', pendingCommand: 'register' });
    await sendLanguagePicker(chatId, 'uz');
    return;
  }
  await startRegister(chatId);
});

async function registerUserByPhone({ chatId, phoneRaw, msg }) {
  if (!isValidPhone(phoneRaw)) {
    await bot.sendMessage(chatId, t(chatId, 'invalidPhone'));
    return;
  }

  const phone = normalizePhone(phoneRaw);

  // ShifoCRM'dan telefon bo'yicha qidirish
  const patient = await getPatientByPhone(phone);

  if (!patient) {
    clearUserState(chatId);
    await bot.sendMessage(
      chatId,
      t(chatId, 'notFound'),
      { reply_markup: { remove_keyboard: true } }
    );
    return;
  }

  // Patient/Lead topildi, saqlash
  try {
    const patientId = String(patient.id);
    const isLead = patient._table === 'leads';
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
      locale: getUserLocale(chatId),
    });

    if (saved) {
      clearUserState(chatId);
      const patientName = patient.full_name || t(chatId, 'unknownCustomer');
      const roleName = isLead ? t(chatId, 'roleLead') : t(chatId, 'rolePatient');
      await bot.sendMessage(
        chatId,
        t(chatId, 'successRegistration', { patientName, roleName, patientId, phone }),
        { reply_markup: { remove_keyboard: true } }
      );
    } else {
      console.error('❌ saveTelegramChatId false qaytdi');
      console.error('   Patient ID:', patientId);
      console.error('   Chat ID:', chatId);
      console.error('   Phone:', phone);
      await bot.sendMessage(chatId, t(chatId, 'genericError'));
    }
  } catch (err) {
    console.error('❌ Exception patient saqlashda:', err);
    await bot.sendMessage(
      chatId,
      t(chatId, 'genericErrorWithDetails', { error: err.message || 'unknown' })
    );
  }
}

// Matn xabarlarini qayta ishlash (telefon raqam tekshirish)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const contact = msg.contact;
  const state = getUserState(chatId);

  await ensureUserLocale(chatId);

  if (state && state.step === 'waiting_language') {
    if (text === LANG_UZ || text === LANG_RU) {
      const selectedLocale = text === LANG_RU ? 'ru' : 'uz';
      setUserLocale(chatId, selectedLocale);

      const pendingCommand = state.pendingCommand;
      clearUserState(chatId);

      await bot.sendMessage(chatId, messages[selectedLocale].languageSelected, {
        reply_markup: { remove_keyboard: true },
      });

      if (pendingCommand === 'help') {
        await sendHelp(chatId);
      } else if (pendingCommand === 'register') {
        await startRegister(chatId);
      } else {
        await sendStartWelcome(chatId);
      }
      return;
    }

    if (text === '/help') {
      setUserState(chatId, { step: 'waiting_language', pendingCommand: 'help' });
      await sendLanguagePicker(chatId, 'uz');
      return;
    }

    if (text === '/register') {
      setUserState(chatId, { step: 'waiting_language', pendingCommand: 'register' });
      await sendLanguagePicker(chatId, 'uz');
      return;
    }

    await bot.sendMessage(chatId, t(chatId, 'languageInvalid'));
    await sendLanguagePicker(chatId, getUserLocale(chatId));
    return;
  }
  
  // Agar /register holatida bo'lsa
  if (state && state.step === 'waiting_phone') {
    // Komandalarni qayta ishlamaslik (/register, /help va h.k.)
    if (text && text.startsWith('/')) {
      return;
    }
    // Kontakt yuborilgan bo'lsa
    if (contact && contact.phone_number) {
      if (contact.user_id && msg.from?.id && contact.user_id !== msg.from.id) {
        await bot.sendMessage(chatId, t(chatId, 'ownContactOnly'));
        return;
      }

      await registerUserByPhone({ chatId, phoneRaw: contact.phone_number, msg });
      return;
    }

    if (!text) {
      await bot.sendMessage(chatId, t(chatId, 'sendContactOrPhone'));
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
      const isLead = patient._table === 'leads';
      const roleName = isLead ? t(chatId, 'roleLead') : t(chatId, 'rolePatient');
      await bot.sendMessage(
        chatId,
        t(chatId, 'phoneFound', {
          name: patient.full_name || t(chatId, 'unknownCustomer'),
          roleName,
          id: patient.id,
        })
      );
    } else {
      await bot.sendMessage(chatId, t(chatId, 'phoneNotFound'));
    }
  }
});

module.exports = bot;
