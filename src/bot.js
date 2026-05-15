const TelegramBot = require('node-telegram-bot-api');
const { normalizePhone, isValidPhone } = require('./utils/validators');
const { saveTelegramChatId, getLocaleByChatId, updateLocaleByChatId } = require('./repository/telegramChatRepo');
const { getPatientByPhone } = require('./repository/patientRepo');
const { getScheduledMessageById } = require('./repository/scheduledMessagesRepo');
const { upsertAppointmentResponse } = require('./repository/appointmentResponseRepo');
const { sendAppointmentResponseWebhook } = require('./services/appointmentResponseWebhook');
const { updateLeadStatus } = require('./repository/leadRepo');
const { upsertDoctorProfile, updateDoctorNotificationPreference, normalizeNotificationPreference } = require('./repository/doctorProfileRepo');
const { getDoctorReminderById, recordDoctorReminderAction } = require('./repository/doctorReminderRepo');

const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID?.trim();
const pollingEnabled = process.env.TELEGRAM_POLLING_ENABLED !== 'false';
const pollingAutoRecover = process.env.TELEGRAM_POLLING_AUTO_RECOVER === 'true';
const pollingRecoverDelayMs = Number(process.env.TELEGRAM_POLLING_RECOVER_DELAY_MS || 30000);

if (!botToken) {
  console.error('❌ TELEGRAM_BOT_TOKEN topilmadi!');
  console.error('   Environment variable: TELEGRAM_BOT_TOKEN');
  console.error('   Railway dashboard → Variables → TELEGRAM_BOT_TOKEN qo\'shing');
  throw new Error('TELEGRAM_BOT_TOKEN .env faylda ko\'rsatilgan bo\'lishi kerak');
}

const bot = new TelegramBot(botToken, { polling: pollingEnabled });

if (!pollingEnabled) {
  console.log('ℹ️ Telegram polling o\'chirilgan (TELEGRAM_POLLING_ENABLED=false)');
}

let pollingConflictLock = false;
let pollingRecoverTimer = null;

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
      `/language - Tilni o'zgartirish\n` +
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
    doctorWelcome:
      `🧑‍⚕️ Doktor rejimi faol.\n\n` +
      `Doktor sifatida ro'yxatdan o'tish uchun /doctorregister buyrug'ini yuboring.\n\n` +
      `Sozlamalar uchun /doctorprefs buyrug'ini ishlating.`,
    doctorRegisterPrompt:
      `🧑‍⚕️ Doktor ro'yxatdan o'tishi:\n\n` +
      `Telefon raqamingizni kontakt orqali yuboring yoki qo'lda kiriting.\n` +
      `Masalan: +998901234567 yoki 901234567`,
    doctorPrefsPrompt:
      `🔔 Doktor uchun bildirishnoma sozlamasini tanlang:`,
    doctorPrefsSaved:
      `✅ Doktor sozlamasi yangilandi: {preference}`,
    doctorPrefAllAppointments: '📋 Barcha qabullar',
    doctorPrefUrgentOnly: '⚡ Faqat shoshilinch',
    doctorPrefDailySummaryOnly: '🗓 Faqat kunlik hisobot',
    doctorPrefMute: '🔕 Bildirishnomani o\'chirish',
    doctorRegistrationSuccess:
      `✅ Doktor sifatida bog'landingiz!\n\n` +
      `Ism: {doctorName}\n` +
      `Telefon: {phone}\n` +
      `Rol: {roleName}\n` +
      `Bildirishnoma sozlamasi: {preference}`,
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
      `/language - Сменить язык\n` +
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
    doctorWelcome:
      `🧑‍⚕️ Режим доктора активен.\n\n` +
      `Для регистрации как доктор отправьте команду /doctorregister.\n\n` +
      `Для настроек используйте /doctorprefs.`,
    doctorRegisterPrompt:
      `🧑‍⚕️ Регистрация доктора:\n\n` +
      `Отправьте номер телефона через контакт или введите его вручную.\n` +
      `Например: +998901234567 или 901234567`,
    doctorPrefsPrompt:
      `🔔 Выберите preference для уведомлений доктора:`,
    doctorPrefsSaved:
      `✅ Preference доктора обновлена: {preference}`,
    doctorPrefAllAppointments: '📋 Все приёмы',
    doctorPrefUrgentOnly: '⚡ Только срочные',
    doctorPrefDailySummaryOnly: '🗓 Только дневная сводка',
    doctorPrefMute: '🔕 Отключить уведомления',
    doctorRegistrationSuccess:
      `✅ Вы подключены как доктор!\n\n` +
      `Имя: {doctorName}\n` +
      `Телефон: {phone}\n` +
      `Role: {roleName}\n` +
      `Preference: {preference}`,
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

function parseLeadIdFromReminderKey(reminderKey) {
  const match = String(reminderKey || '').match(/^lead:([^:]+):/);
  return match ? match[1] : null;
}

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

function getDoctorPreferenceLabel(chatId, preference) {
  const normalized = normalizeNotificationPreference(preference);
  if (normalized === 'urgent_only') {
    return t(chatId, 'doctorPrefUrgentOnly');
  }
  if (normalized === 'daily_summary_only') {
    return t(chatId, 'doctorPrefDailySummaryOnly');
  }
  if (normalized === 'mute') {
    return t(chatId, 'doctorPrefMute');
  }
  return t(chatId, 'doctorPrefAllAppointments');
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

function parseSelectedLocale(text) {
  const normalized = String(text || '').trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (
    normalized === LANG_RU.toLowerCase() ||
    normalized.includes('рус') ||
    normalized === 'ru' ||
    normalized === 'russian'
  ) {
    return 'ru';
  }

  if (
    normalized === LANG_UZ.toLowerCase() ||
    normalized.includes('o\'zbek') ||
    normalized.includes('uzbek') ||
    normalized.includes('ўзбек') ||
    normalized === 'uz' ||
    normalized === 'uzbek'
  ) {
    return 'uz';
  }

  return null;
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

async function notifyAdminError(title, context = {}) {
  if (!ADMIN_CHAT_ID) {
    return;
  }

  try {
    const lines = [
      `⚠️ ${title}`,
      `Time: ${new Date().toISOString()}`,
    ];

    for (const [key, value] of Object.entries(context)) {
      if (value === undefined || value === null || value === '') {
        continue;
      }

      const displayValue = typeof value === 'string'
        ? value
        : JSON.stringify(value, null, 2);

      lines.push(`${key}: ${displayValue}`);
    }

    const text = lines.join('\n').slice(0, 3900);
    await bot.sendMessage(ADMIN_CHAT_ID, text);
  } catch (adminErr) {
    console.error('❌ Admin xabari yuborilmadi:', adminErr?.message || adminErr);
  }
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

async function startDoctorRegister(chatId) {
  setUserState(chatId, { step: 'waiting_doctor_phone' });
  await bot.sendMessage(chatId, t(chatId, 'doctorRegisterPrompt'), {
    reply_markup: {
      keyboard: [[{ text: t(chatId, 'sendContactBtn'), request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

function buildDoctorPrefsKeyboard(chatId) {
  return {
    inline_keyboard: [
      [
        { text: t(chatId, 'doctorPrefUrgentOnly'), callback_data: 'doctorpref:urgent_only' },
        { text: t(chatId, 'doctorPrefAllAppointments'), callback_data: 'doctorpref:all_appointments' },
      ],
      [
        { text: t(chatId, 'doctorPrefDailySummaryOnly'), callback_data: 'doctorpref:daily_summary_only' },
        { text: t(chatId, 'doctorPrefMute'), callback_data: 'doctorpref:mute' },
      ],
    ],
  };
}

async function sendDoctorPrefs(chatId) {
  await bot.sendMessage(chatId, t(chatId, 'doctorPrefsPrompt'), {
    reply_markup: buildDoctorPrefsKeyboard(chatId),
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

// /doctor
bot.onText(/\/doctor$/, async (msg) => {
  const chatId = msg.chat.id;
  await ensureUserLocale(chatId);
  if (!hasUserLocale(chatId)) {
    setUserState(chatId, { step: 'waiting_language', pendingCommand: 'doctor' });
    await sendLanguagePicker(chatId, 'uz');
    return;
  }
  await bot.sendMessage(chatId, t(chatId, 'doctorWelcome'));
});

// /doctorregister
bot.onText(/\/doctorregister/, async (msg) => {
  const chatId = msg.chat.id;
  await ensureUserLocale(chatId);
  if (!hasUserLocale(chatId)) {
    setUserState(chatId, { step: 'waiting_language', pendingCommand: 'doctorregister' });
    await sendLanguagePicker(chatId, 'uz');
    return;
  }
  await startDoctorRegister(chatId);
});

// /doctorprefs
bot.onText(/\/doctorprefs/, async (msg) => {
  const chatId = msg.chat.id;
  await ensureUserLocale(chatId);
  if (!hasUserLocale(chatId)) {
    setUserState(chatId, { step: 'waiting_language', pendingCommand: 'doctorprefs' });
    await sendLanguagePicker(chatId, 'uz');
    return;
  }
  await sendDoctorPrefs(chatId);
});

// /language
bot.onText(/\/language/, async (msg) => {
  const chatId = msg.chat.id;
  setUserState(chatId, { step: 'waiting_language', pendingCommand: 'language' });
  await sendLanguagePicker(chatId, getUserLocale(chatId));
});

async function registerUserByPhone({ chatId, phoneRaw, msg }) {
  if (!isValidPhone(phoneRaw)) {
    await bot.sendMessage(chatId, t(chatId, 'invalidPhone'));
    return;
  }

  const phone = normalizePhone(phoneRaw);
  let patient = null;

  // ShifoCRM'dan telefon bo'yicha qidirish
  patient = await getPatientByPhone(phone);

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
      console.error('   Last save error:', saveTelegramChatId.lastError);
      await notifyAdminError('saveTelegramChatId failed', {
        patientId,
        chatId,
        phone,
        patientName: patient.full_name || patient.name || null,
        table: patient._table || null,
        lastError: saveTelegramChatId.lastError,
      });
      await bot.sendMessage(chatId, t(chatId, 'genericError'));
    }
  } catch (err) {
    console.error('❌ Exception patient saqlashda:', err);
    await notifyAdminError('Registration exception', {
      patientId: patient?.id || null,
      chatId,
      phone,
      patientName: patient?.full_name || patient?.name || null,
      table: patient?._table || null,
      stack: err?.stack || err?.message || String(err),
    });
    await bot.sendMessage(
      chatId,
      t(chatId, 'genericErrorWithDetails', { error: err.message || 'unknown' })
    );
  }
}

async function registerDoctorByPhone({ chatId, phoneRaw, msg }) {
  if (!isValidPhone(phoneRaw)) {
    await bot.sendMessage(chatId, t(chatId, 'invalidPhone'));
    return;
  }

  const phone = normalizePhone(phoneRaw);

  try {
    const doctorName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ').trim()
      || t(chatId, 'unknownCustomer');

    const saved = await upsertDoctorProfile({
      phone,
      chatId: String(chatId),
      username: msg.from?.username || null,
      firstName: msg.from?.first_name || null,
      fullName: doctorName,
      role: 'doctor',
      notificationPreference: 'all_appointments',
    });

    if (!saved?.success) {
      console.error('❌ doctor profile save failed:', saved);
      await notifyAdminError('Doctor registration failed', {
        chatId,
        phone,
        message: saved?.message || 'unknown',
      });
      await bot.sendMessage(chatId, t(chatId, 'genericError'));
      return;
    }

    clearUserState(chatId);
    const roleName = 'Doktor';
    const preference = getDoctorPreferenceLabel(chatId, saved.data?.notification_preference || 'all_appointments');

    await bot.sendMessage(
      chatId,
      t(chatId, 'doctorRegistrationSuccess', {
        doctorName,
        phone,
        roleName,
        preference,
      }),
      { reply_markup: { remove_keyboard: true } }
    );

    await sendDoctorPrefs(chatId);
  } catch (err) {
    console.error('❌ Exception doctor saqlashda:', err);
    await notifyAdminError('Doctor registration exception', {
      chatId,
      phone: phoneRaw,
      error: err?.message || String(err),
    });
    await bot.sendMessage(
      chatId,
      t(chatId, 'genericErrorWithDetails', { error: err.message || 'unknown' })
    );
  }
}

bot.on('polling_error', async (error) => {
  const errorText = String(error?.message || error || '');
  const isConflict = errorText.includes('409') || errorText.toLowerCase().includes('conflict');

  if (!isConflict) {
    console.error('❌ Telegram polling xatoligi:', errorText);
    return;
  }

  if (pollingConflictLock) {
    return;
  }

  pollingConflictLock = true;
  console.error('❌ Telegram polling 409 Conflict: bir vaqtning o\'zida bir nechta instance ishlayapti.');

  try {
    await bot.stopPolling();
    console.warn('🛑 Polling vaqtincha to\'xtatildi.');
  } catch (stopError) {
    console.error('❌ Pollingni to\'xtatishda xatolik:', stopError?.message || stopError);
  }

  if (!pollingAutoRecover || !pollingEnabled) {
    console.warn('ℹ️ Auto-recover o\'chiq. Faqat bitta polling instance qoldiring.');
    return;
  }

  if (pollingRecoverTimer) {
    clearTimeout(pollingRecoverTimer);
  }

  pollingRecoverTimer = setTimeout(async () => {
    try {
      console.log(`🔁 Polling qayta ishga tushirilmoqda (${pollingRecoverDelayMs}ms dan keyin)...`);
      await bot.startPolling();
      pollingConflictLock = false;
      console.log('✅ Polling qayta ishga tushdi.');
    } catch (restartError) {
      console.error('❌ Pollingni qayta ishga tushirishda xatolik:', restartError?.message || restartError);
    }
  }, pollingRecoverDelayMs);
});

bot.on('callback_query', async (query) => {
  const data = String(query?.data || '');

  if (data.startsWith('doctorpref:')) {
    const preference = normalizeNotificationPreference(data.split(':')[1]);
    const preferenceLabel = getDoctorPreferenceLabel(query?.message?.chat?.id, preference);
    const chatId = String(query?.message?.chat?.id || query?.from?.id || '');

    if (chatId) {
      const profileResult = await updateDoctorNotificationPreference(chatId, preference);
      if (!profileResult?.success) {
        await bot.answerCallbackQuery(query.id, { text: 'Preference saqlanmadi' });
        return;
      }
    }

    try {
      await bot.answerCallbackQuery(query.id, { text: '✅ Sozlama saqlandi' });
      await bot.sendMessage(query.message.chat.id, t(query.message.chat.id, 'doctorPrefsSaved', { preference: preferenceLabel }));
    } catch (err) {
      console.warn('⚠️ Doctor preference callback xatolik:', err?.message || err);
    }

    return;
  }

  if (data.startsWith('docrem:')) {
    const parts = data.split(':');
    const reminderId = parts[1];
    const actionKey = parts[2] || 'ack';
    const reminder = await getDoctorReminderById(reminderId);

    if (!reminder) {
      await bot.answerCallbackQuery(query.id, { text: 'Reminder topilmadi' });
      return;
    }

    const action = (reminder.action_payload?.actions || []).find(item => item.actionKey === actionKey);
    const actionText = action?.text || actionKey;

    await recordDoctorReminderAction(reminderId, actionKey, actionText);

    try {
      await bot.answerCallbackQuery(query.id, { text: `✅ ${actionText}` });
      await bot.sendMessage(query.message.chat.id, `✅ ${actionText} qabul qilindi.`);
    } catch (err) {
      console.warn('⚠️ Doctor reminder action xatolik:', err?.message || err);
    }

    return;
  }

  if (!data.startsWith('apptresp:')) {
    return;
  }

  const parts = data.split(':');
  const scheduledMessageId = parts[1];
  const responseValue = parts[2] === 'yes' ? 'yes' : 'no';

  if (!scheduledMessageId) {
    await bot.answerCallbackQuery(query.id, { text: 'Xatolik: ID topilmadi' });
    return;
  }

  const scheduledMessage = await getScheduledMessageById(scheduledMessageId);
  if (!scheduledMessage) {
    await bot.answerCallbackQuery(query.id, { text: 'Xabar topilmadi' });
    return;
  }

  const reminderKey = scheduledMessage.reminder_key || null;
  const leadId = parseLeadIdFromReminderKey(reminderKey);
  const patientId = scheduledMessage.patient_id;
  const respondedAt = new Date().toISOString();

  await upsertAppointmentResponse({
    scheduledMessageId: scheduledMessageId,
    patientId,
    leadId,
    reminderKey,
    response: responseValue,
    respondedAt,
  });

  await sendAppointmentResponseWebhook({
    scheduledMessageId,
    patientId,
    leadId,
    reminderKey,
    response: responseValue,
    respondedAt,
    chatId: String(query?.message?.chat?.id || ''),
  });

  const confirmText = responseValue === 'yes'
    ? '✅ Qabulingiz tasdiqlandi'
    : '❌ Qabulga borolmasligingiz qayd etildi';

  try {
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: query.message.chat.id, message_id: query.message.message_id }
    );
  } catch (editError) {
    console.warn('⚠️ Inline tugmalarni olib tashlashda xatolik:', editError?.message || editError);
  }

  await bot.answerCallbackQuery(query.id, { text: confirmText, show_alert: false });
  await bot.sendMessage(query.message.chat.id, confirmText);

  // Agar lead bo'lsa, statusni javobga qarab yangilash
  if (leadId) {
    try {
      const nextLeadStatus = responseValue === 'yes' ? 'Band qilingan' : 'Rad etilgan';
      console.log(`🔄 Lead status yangilash jarayoni boshlandi: leadId=${leadId}, status=${nextLeadStatus}`);
      const conversionResult = await updateLeadStatus(leadId, nextLeadStatus);
      
      if (conversionResult.success) {
        console.log(`✅ Lead status yangilandi: ${conversionResult.message}`);

        const statusMessage = responseValue === 'yes'
          ? '🎉 Qabulga borishingiz tasdiqlandi. Status: Band qilingan.'
          : '📝 Qabulga bora olmasligingiz qayd etildi. Status: Rad etilgan.';

        try {
          await bot.sendMessage(query.message.chat.id, statusMessage);
        } catch (msgErr) {
          console.warn('Status xabari yuborilmadi:', msgErr?.message || msgErr);
        }
      } else {
        console.warn(`⚠️ Lead status update muvaffaqiyatsiz: ${conversionResult.message}`);
        await notifyAdminError('Lead status update failed', {
          leadId,
          patientId,
          reason: conversionResult.message,
        });
      }
    } catch (conversionErr) {
      console.error('❌ Lead status update exception:', conversionErr);
      await notifyAdminError('Lead status update exception', {
        leadId,
        patientId,
        error: conversionErr?.message || String(conversionErr),
      });
    }
  }
});

// Matn xabarlarini qayta ishlash (telefon raqam tekshirish)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const contact = msg.contact;
  const state = getUserState(chatId);

  await ensureUserLocale(chatId);

  if (state && state.step === 'waiting_language') {
    const selectedLocale = parseSelectedLocale(text);
    if (selectedLocale) {
      setUserLocale(chatId, selectedLocale);

      try {
        await updateLocaleByChatId(chatId, selectedLocale);
      } catch (persistLocaleError) {
        console.warn('⚠️ Locale saqlashda ogohlantirish:', persistLocaleError?.message || persistLocaleError);
      }

      const pendingCommand = state.pendingCommand;
      clearUserState(chatId);

      await bot.sendMessage(chatId, messages[selectedLocale].languageSelected, {
        reply_markup: { remove_keyboard: true },
      });

      if (pendingCommand === 'help') {
        await sendHelp(chatId);
      } else if (pendingCommand === 'register') {
        await startRegister(chatId);
      } else if (pendingCommand === 'language') {
        await sendStartWelcome(chatId);
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

    if (text === '/language') {
      setUserState(chatId, { step: 'waiting_language', pendingCommand: 'language' });
      await sendLanguagePicker(chatId, getUserLocale(chatId));
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

  if (state && state.step === 'waiting_doctor_phone') {
    if (text && text.startsWith('/')) {
      return;
    }

    if (contact && contact.phone_number) {
      if (contact.user_id && msg.from?.id && contact.user_id !== msg.from.id) {
        await bot.sendMessage(chatId, t(chatId, 'ownContactOnly'));
        return;
      }

      await registerDoctorByPhone({ chatId, phoneRaw: contact.phone_number, msg });
      return;
    }

    if (!text) {
      await bot.sendMessage(chatId, t(chatId, 'sendContactOrPhone'));
      return;
    }

    await registerDoctorByPhone({ chatId, phoneRaw: text.trim(), msg });
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
