const TelegramBot = require('node-telegram-bot-api');
const { normalizePhone, isValidPhone } = require('./utils/validators');
const { getTelegramBotOptions } = require('./utils/telegramOptions');
const {
  isWebhookMode,
  shouldForceDisablePolling,
  getTelegramModeInfo,
  printCloudWebhookSetupInstructions,
} = require('./utils/telegramMode');
const {
  unwrapTelegramError,
  isPollingConflictError,
  isPollingNetworkError,
  getPollingErrorHint,
} = require('./utils/pollingErrorUtils');
const { saveTelegramChatId, getLocaleByChatId, updateLocaleByChatId, getPatientIdByChatId } = require('./repository/telegramChatRepo');
const { getPatientByPhone } = require('./repository/patientRepo');
const { getScheduledMessageById } = require('./repository/scheduledMessagesRepo');
const { upsertAppointmentResponse } = require('./repository/appointmentResponseRepo');
const { sendAppointmentResponseWebhook } = require('./services/appointmentResponseWebhook');
const { updateLeadStatus, getLeadById, linkOpenLeadsForPatient, linkLeadToTelegram } = require('./repository/leadRepo');
const { upsertDoctorProfile, updateDoctorNotificationPreference, normalizeNotificationPreference } = require('./repository/doctorProfileRepo');
const { getDoctorReminderById, recordDoctorReminderAction } = require('./repository/doctorReminderRepo');
const cashbackService = require('./services/cashbackService');
const { formatMoney, buildReferralLink, getPatientCashbackSummary, processReferralRegistration } = cashbackService;

const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID?.trim();
const webhookMode = isWebhookMode();
const forceDisablePolling = shouldForceDisablePolling();
const pollingEnabled = !webhookMode && !forceDisablePolling && process.env.TELEGRAM_POLLING_ENABLED !== 'false';

const modeInfo = getTelegramModeInfo();
if (modeInfo.cloud && !modeInfo.webhookMode) {
  console.error('❌ Cloud muhit aniqlandi, lekin webhook sozlanmagan — bot xabar qabul qilmaydi.');
  printCloudWebhookSetupInstructions();
}

if (webhookMode) {
  console.log('ℹ️ Telegram webhook rejimi (polling o\'chirilgan)');
} else if (forceDisablePolling) {
  console.log('ℹ️ Telegram polling o\'chirilgan (cloud muhit, webhook kerak)');
} else if (!pollingEnabled) {
  console.log('ℹ️ Telegram polling o\'chirilgan (TELEGRAM_POLLING_ENABLED=false)');
}
const pollingAutoRecover = process.env.TELEGRAM_POLLING_AUTO_RECOVER !== 'false';
const pollingRecoverDelayMs = Number(process.env.TELEGRAM_POLLING_RECOVER_DELAY_MS || 30000);
const pollingErrorLogIntervalMs = Number(process.env.TELEGRAM_POLLING_ERROR_LOG_INTERVAL_MS || 30000);

if (!botToken) {
  console.error('❌ TELEGRAM_BOT_TOKEN topilmadi!');
  console.error('   Environment variable: TELEGRAM_BOT_TOKEN');
  console.error('   Railway dashboard → Variables → TELEGRAM_BOT_TOKEN qo\'shing');
  throw new Error('TELEGRAM_BOT_TOKEN .env faylda ko\'rsatilgan bo\'lishi kerak');
}

const bot = new TelegramBot(botToken, getTelegramBotOptions(pollingEnabled));

bot.on('error', (err) => {
  console.error('❌ Telegram bot error:', err?.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled rejection:', reason?.message || reason);
});

let pollingConflictLock = false;
let pollingRecoverTimer = null;
let lastPollingErrorLogAt = 0;
let consecutivePollingErrors = 0;
let pollingRestartInProgress = false;

const LANG_UZ = "🇺🇿 O'zbekcha";
const LANG_RU = '🇷🇺 Русский';
const BTN_BALANCE_UZ = '💰 Mening balansim';
const BTN_REFERRAL_UZ = "🎁 Do'stni taklif qilish";
const BTN_BALANCE_RU = '💰 Мой баланс';
const BTN_REFERRAL_RU = '🎁 Пригласить друга';

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
      `/balance - Keshbek balansi\n` +
      `/referral - Do'stni taklif qilish\n` +
      `/help - Yordam\n\n` +
      `Telefon raqamingizni yuborsangiz, ShifoCRM tizimida tekshiriladi.\n` +
      `Ro'yxatdan o'tganingizdan keyin sizga qabul eslatmalari va xabarlar yuboriladi.`,
    balanceTitle: '💰 Mening keshbek balansim',
    balanceLine: 'Joriy balans: <b>{balance} so\'m</b>',
    balanceEarned: 'Jami topilgan: {earned} so\'m',
    balanceSpent: 'Jami ishlatilgan: {spent} so\'m',
    balanceNeedRegister: 'Avval /register orqali ro\'yxatdan o\'ting.',
    referralTitle: "🎁 Do'stni taklif qilish",
    referralBody:
      `Do'stingizga ushbu havolani yuboring.\n` +
      `U botga ulansa, sizga <b>{bonus} so'm</b> bonus beriladi.\n\n` +
      `Havola:\n{link}\n\n` +
      `Takliflar soni: {count}`,
    referralNeedRegister: 'Referral havola uchun avval /register qiling.',
    referralNoUsername: 'Bot username sozlanmagan. Administratorga murojaat qiling.',
    referralPendingSaved: "🎁 Taklif kodi saqlandi. Ro'yxatdan o'ting — do'stingizga bonus beriladi.",
    cashbackMenuHint: '\n\nMenyu: 💰 Mening balansim | 🎁 Do\'stni taklif qilish',
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
    doctorRegistrationWarning:
      `ℹ️ Eslatma: {warning}`,
    doctorRegistrationFailed:
      `❌ Doktor sifatida ro'yxatdan o'tishda xatolik: {reason}`,
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
      `/balance - Баланс кэшбэка\n` +
      `/referral - Пригласить друга\n` +
      `/help - Помощь\n\n` +
      `Если отправите номер телефона, он будет проверен в системе ShifoCRM.\n` +
      `После регистрации вы будете получать напоминания о приёмах и сообщения.`,
    balanceTitle: '💰 Мой кэшбэк-баланс',
    balanceLine: 'Текущий баланс: <b>{balance} сум</b>',
    balanceEarned: 'Всего заработано: {earned} сум',
    balanceSpent: 'Всего потрачено: {spent} сум',
    balanceNeedRegister: 'Сначала зарегистрируйтесь через /register.',
    referralTitle: '🎁 Пригласить друга',
    referralBody:
      `Отправьте другу эту ссылку.\n` +
      `Когда он подключится к боту, вы получите бонус <b>{bonus} сум</b>.\n\n` +
      `Ссылка:\n{link}\n\n` +
      `Количество приглашений: {count}`,
    referralNeedRegister: 'Для реферальной ссылки сначала выполните /register.',
    referralNoUsername: 'Username бота не настроен. Обратитесь к администратору.',
    referralPendingSaved: '🎁 Код приглашения сохранён. Зарегистрируйтесь — другу начислят бонус.',
    cashbackMenuHint: '\n\nМеню: 💰 Мой баланс | 🎁 Пригласить друга',
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
    doctorRegistrationWarning:
      `ℹ️ Примечание: {warning}`,
    doctorRegistrationFailed:
      `❌ Ошибка при регистрации доктора: {reason}`,
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
  await bot.sendMessage(chatId, t(chatId, 'help'), {
    reply_markup: buildPatientMenuKeyboard(chatId),
  });
}

async function sendStartWelcome(chatId) {
  await bot.sendMessage(chatId, t(chatId, 'startWelcome') + t(chatId, 'cashbackMenuHint'), {
    reply_markup: buildPatientMenuKeyboard(chatId),
  });
}

function buildPatientMenuKeyboard(chatId) {
  const locale = getUserLocale(chatId);
  const balanceBtn = locale === 'ru' ? BTN_BALANCE_RU : BTN_BALANCE_UZ;
  const referralBtn = locale === 'ru' ? BTN_REFERRAL_RU : BTN_REFERRAL_UZ;
  return {
    keyboard: [[{ text: balanceBtn }, { text: referralBtn }]],
    resize_keyboard: true,
  };
}

function isBalanceButton(text) {
  return text === BTN_BALANCE_UZ || text === BTN_BALANCE_RU || text === '/balance';
}

function isReferralButton(text) {
  return text === BTN_REFERRAL_UZ || text === BTN_REFERRAL_RU || text === '/referral';
}

async function sendBalanceInfo(chatId) {
  try {
    const patientId = await getPatientIdByChatId(chatId);
    if (!patientId) {
      await bot.sendMessage(chatId, t(chatId, 'balanceNeedRegister'));
      return;
    }

    const summary = await getPatientCashbackSummary(patientId);
    const text =
      `${t(chatId, 'balanceTitle')}\n\n` +
      `${t(chatId, 'balanceLine', { balance: formatMoney(summary.balance) })}\n` +
      `${t(chatId, 'balanceEarned', { earned: formatMoney(summary.lifetime_earned) })}\n` +
      `${t(chatId, 'balanceSpent', { spent: formatMoney(summary.lifetime_spent) })}`;

    await bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: buildPatientMenuKeyboard(chatId),
    });
  } catch (err) {
    console.error('❌ Balance xatolik:', err?.message || err);
    await bot.sendMessage(chatId, t(chatId, 'genericError'));
  }
}

async function sendReferralInfo(chatId) {
  try {
    const patientId = await getPatientIdByChatId(chatId);
    if (!patientId) {
      await bot.sendMessage(chatId, t(chatId, 'referralNeedRegister'));
      return;
    }

    const summary = await getPatientCashbackSummary(patientId);
    const link = summary.referral_link || buildReferralLink(patientId);
    if (!link) {
      await bot.sendMessage(chatId, t(chatId, 'referralNoUsername'));
      return;
    }

    await bot.sendMessage(
      chatId,
      `${t(chatId, 'referralTitle')}\n\n` +
        t(chatId, 'referralBody', {
          bonus: formatMoney(summary.referral_bonus_amount),
          link,
          count: summary.referrals_count,
        }),
      {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: buildPatientMenuKeyboard(chatId),
      }
    );
  } catch (err) {
    console.error('❌ Referral xatolik:', err?.message || err);
    await bot.sendMessage(chatId, t(chatId, 'genericError'));
  }
}

async function handleReferralDeepLink({ chatId, referrerPatientId }) {
  if (!referrerPatientId) {
    return;
  }

  const ownPatientId = await getPatientIdByChatId(chatId);
  if (ownPatientId && String(ownPatientId) === String(referrerPatientId)) {
    await bot.sendMessage(chatId, t(chatId, 'startWelcome'), {
      reply_markup: buildPatientMenuKeyboard(chatId),
    });
    return;
  }

  const existing = getUserState(chatId) || {};
  setUserState(chatId, {
    ...existing,
    pendingReferrerId: String(referrerPatientId),
  });

  if (ownPatientId) {
    try {
      await processReferralRegistration({
        bot,
        referrerPatientId,
        referredPatientId: ownPatientId,
        referredChatId: String(chatId),
      });
    } catch (err) {
      console.error('❌ Referral process xatolik:', err?.message || err);
    }
    await sendStartWelcome(chatId);
    return;
  }

  await bot.sendMessage(chatId, t(chatId, 'referralPendingSaved'));
  await startRegister(chatId);
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
  const existing = getUserState(chatId);
  setUserState(chatId, {
    step: 'waiting_phone',
    pendingLeadId: existing?.pendingLeadId || null,
    pendingReferrerId: existing?.pendingReferrerId || null,
  });
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

function parseStartPayload(text) {
  const raw = String(text || '').trim();
  const leadMatch = raw.match(/^lead[_-]?(.+)$/i);
  if (leadMatch) {
    return { type: 'lead', leadId: leadMatch[1] };
  }

  const refMatch = raw.match(/^ref[_-]?(.+)$/i);
  if (refMatch) {
    return { type: 'ref', referrerPatientId: refMatch[1] };
  }

  return null;
}

async function handleLeadDeepLink({ chatId, leadId, msg }) {
  const lead = await getLeadById(leadId);
  if (!lead) {
    await bot.sendMessage(chatId, `❌ Lead topilmadi: ${leadId}`);
    return;
  }

  const state = getUserState(chatId);
  const patientId = state?.pendingPatientId;

  if (patientId) {
    await linkLeadToTelegram(leadId, { patientId, chatId: String(chatId) });
    await bot.sendMessage(chatId, `✅ Lead ${leadId} Telegram bilan bog'landi.`);
    return;
  }

  setUserState(chatId, {
    step: 'waiting_phone',
    pendingLeadId: String(leadId),
  });

  await bot.sendMessage(
    chatId,
    `🔗 Lead topildi (ID: ${leadId}).\n\nRo'yxatdan o'tish uchun telefon raqamingizni yuboring:`,
    {
      reply_markup: {
        keyboard: [[{ text: t(chatId, 'sendContactBtn'), request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    }
  );
}

// /start (deep link: /start lead_123 | /start ref_33410)
bot.onText(/\/start(?:@\w+)?(?:\s+(.+))?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const payload = parseStartPayload(match?.[1]);

  await ensureUserLocale(chatId);

  if (payload?.type === 'lead' && payload.leadId) {
    if (!hasUserLocale(chatId)) {
      setUserState(chatId, {
        step: 'waiting_language',
        pendingCommand: 'start',
        pendingLeadId: String(payload.leadId),
      });
      await sendLanguagePicker(chatId, getUserLocale(chatId));
      return;
    }

    await handleLeadDeepLink({ chatId, leadId: payload.leadId, msg });
    return;
  }

  if (payload?.type === 'ref' && payload.referrerPatientId) {
    if (!hasUserLocale(chatId)) {
      setUserState(chatId, {
        step: 'waiting_language',
        pendingCommand: 'start',
        pendingReferrerId: String(payload.referrerPatientId),
      });
      await sendLanguagePicker(chatId, getUserLocale(chatId));
      return;
    }

    await handleReferralDeepLink({
      chatId,
      referrerPatientId: payload.referrerPatientId,
    });
    return;
  }

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

// /balance
bot.onText(/\/balance/, async (msg) => {
  const chatId = msg.chat.id;
  await ensureUserLocale(chatId);
  if (!hasUserLocale(chatId)) {
    setUserState(chatId, { step: 'waiting_language', pendingCommand: 'balance' });
    await sendLanguagePicker(chatId, 'uz');
    return;
  }
  await sendBalanceInfo(chatId);
});

// /referral
bot.onText(/\/referral/, async (msg) => {
  const chatId = msg.chat.id;
  await ensureUserLocale(chatId);
  if (!hasUserLocale(chatId)) {
    setUserState(chatId, { step: 'waiting_language', pendingCommand: 'referral' });
    await sendLanguagePicker(chatId, 'uz');
    return;
  }
  await sendReferralInfo(chatId);
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
  const stateBeforeRegister = getUserState(chatId);
  const preferredLeadId = stateBeforeRegister?.pendingLeadId || null;
  const pendingReferrerId = stateBeforeRegister?.pendingReferrerId || null;
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
      const linkedLeads = await linkOpenLeadsForPatient({
        patientId,
        phone,
        chatId: String(chatId),
        preferredLeadId,
      });

      clearUserState(chatId);
      const patientName = patient.full_name || t(chatId, 'unknownCustomer');
      const roleName = isLead ? t(chatId, 'roleLead') : t(chatId, 'rolePatient');
      await bot.sendMessage(
        chatId,
        t(chatId, 'successRegistration', { patientName, roleName, patientId, phone }),
        { reply_markup: buildPatientMenuKeyboard(chatId) }
      );

      if (linkedLeads.length > 0) {
        await bot.sendMessage(
          chatId,
          `🔗 Lead(lar) Telegram bilan bog'landi: ${linkedLeads.join(', ')}`
        );
      }

      if (pendingReferrerId && !isLead) {
        try {
          await processReferralRegistration({
            bot,
            referrerPatientId: pendingReferrerId,
            referredPatientId: patientId,
            referredChatId: String(chatId),
          });
        } catch (referralErr) {
          console.error('❌ Referral bonus xatolik:', referralErr?.message || referralErr);
        }
      }
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
      await bot.sendMessage(
        chatId,
        t(chatId, 'doctorRegistrationFailed', {
          reason: saved?.message || 'noma\'lum xatolik',
        })
      );
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

    if (saved?.warningMessage) {
      await bot.sendMessage(
        chatId,
        t(chatId, 'doctorRegistrationWarning', { warning: saved.warningMessage })
      );
    }

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

async function pausePollingWithRecover(reason, delayMs = pollingRecoverDelayMs) {
  if (pollingRestartInProgress) {
    return;
  }

  pollingRestartInProgress = true;

  try {
    await bot.stopPolling({ cancel: true });
    console.warn(`🛑 Polling vaqtincha to'xtatildi: ${reason}`);
  } catch (stopError) {
    console.error('❌ Pollingni to\'xtatishda xatolik:', stopError?.message || stopError);
  }

  if (!pollingAutoRecover || !pollingEnabled) {
    console.warn('ℹ️ Auto-recover o\'chiq. TELEGRAM_POLLING_AUTO_RECOVER=true qo\'ying yoki faqat bitta instance qoldiring.');
    pollingRestartInProgress = false;
    return;
  }

  if (pollingRecoverTimer) {
    clearTimeout(pollingRecoverTimer);
  }

  pollingRecoverTimer = setTimeout(async () => {
    try {
      console.log(`🔁 Polling qayta ishga tushirilmoqda (${delayMs}ms dan keyin)...`);
      await bot.startPolling();
      consecutivePollingErrors = 0;
      pollingConflictLock = false;
      console.log('✅ Polling qayta ishga tushdi.');
    } catch (restartError) {
      console.error('❌ Pollingni qayta ishga tushirishda xatolik:', restartError?.message || restartError);
    } finally {
      pollingRestartInProgress = false;
    }
  }, delayMs);
}

if (pollingEnabled) {
bot.on('polling_error', async (error) => {
  const errorText = unwrapTelegramError(error);
  const isConflict = isPollingConflictError(errorText);
  const isNetworkError = isPollingNetworkError(errorText);
  const now = Date.now();

  consecutivePollingErrors += 1;

  const shouldLog = isConflict
    || now - lastPollingErrorLogAt >= pollingErrorLogIntervalMs
    || consecutivePollingErrors === 1;

  if (!shouldLog) {
    return;
  }

  lastPollingErrorLogAt = now;
  const hint = getPollingErrorHint(errorText);

  if (isConflict) {
    if (pollingConflictLock) {
      return;
    }

    pollingConflictLock = true;
    console.error('❌ Telegram polling 409 Conflict: bir vaqtning o\'zida bir nechta instance ishlayapti.');
    if (hint) {
      console.error(`   💡 ${hint}`);
    }

    await pausePollingWithRecover('409 Conflict');
    return;
  }

  console.error('❌ Telegram polling xatoligi:', errorText);
  if (hint) {
    console.error(`   💡 ${hint}`);
  }

  if (!isNetworkError || consecutivePollingErrors < 3) {
    return;
  }

  const backoffMs = Math.min(
    pollingRecoverDelayMs * consecutivePollingErrors,
    Number(process.env.TELEGRAM_POLLING_MAX_BACKOFF_MS || 300000)
  );

  await pausePollingWithRecover(`tarmoq xatosi (${consecutivePollingErrors} marta)`, backoffMs);
});
}

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
      const pendingLeadId = state.pendingLeadId || null;
      const pendingReferrerId = state.pendingReferrerId || null;
      clearUserState(chatId);

      await bot.sendMessage(chatId, messages[selectedLocale].languageSelected, {
        reply_markup: { remove_keyboard: true },
      });

      if (pendingCommand === 'help') {
        await sendHelp(chatId);
      } else if (pendingCommand === 'register') {
        if (pendingReferrerId) {
          setUserState(chatId, { pendingReferrerId: String(pendingReferrerId) });
        }
        await startRegister(chatId);
      } else if (pendingCommand === 'balance') {
        await sendBalanceInfo(chatId);
      } else if (pendingCommand === 'referral') {
        await sendReferralInfo(chatId);
      } else if (pendingCommand === 'start' && pendingLeadId) {
        await handleLeadDeepLink({ chatId, leadId: pendingLeadId, msg });
      } else if (pendingCommand === 'start' && pendingReferrerId) {
        await handleReferralDeepLink({ chatId, referrerPatientId: pendingReferrerId });
      } else if (pendingCommand === 'language') {
        await sendStartWelcome(chatId);
      } else {
        if (pendingReferrerId) {
          await handleReferralDeepLink({ chatId, referrerPatientId: pendingReferrerId });
        } else {
          await sendStartWelcome(chatId);
        }
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

  // Cashback menyu tugmalari
  if (text && (isBalanceButton(text) || isReferralButton(text))) {
    if (!hasUserLocale(chatId)) {
      setUserState(chatId, {
        step: 'waiting_language',
        pendingCommand: isBalanceButton(text) ? 'balance' : 'referral',
      });
      await sendLanguagePicker(chatId, 'uz');
      return;
    }

    if (isBalanceButton(text)) {
      await sendBalanceInfo(chatId);
      return;
    }

    await sendReferralInfo(chatId);
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
