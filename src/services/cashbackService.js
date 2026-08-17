const cashbackRepo = require('../repository/cashbackRepo');
const { getTelegramChatId } = require('../repository/telegramChatRepo');

const CASHBACK_PERCENT = Number(process.env.CASHBACK_PERCENT || 5);
const REFERRAL_BONUS_AMOUNT = Number(process.env.REFERRAL_BONUS_AMOUNT || 10000);
const BOT_USERNAME = String(process.env.TELEGRAM_BOT_USERNAME || process.env.VITE_TELEGRAM_BOT_USERNAME || '')
  .replace(/^@/, '')
  .trim();

let cachedBotUsername = BOT_USERNAME;

async function resolveBotUsername() {
  if (cachedBotUsername) {
    return cachedBotUsername;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const payload = await response.json().catch(() => ({}));
    if (payload?.ok && payload?.result?.username) {
      cachedBotUsername = String(payload.result.username).replace(/^@/, '');
      console.log(`ℹ️ Bot username Telegram dan olindi: @${cachedBotUsername}`);
      return cachedBotUsername;
    }
  } catch (err) {
    console.warn('⚠️ Bot username olishda xatolik:', err?.message || err);
  }

  return null;
}

function buildReferralLink(patientId, usernameOverride) {
  const username = usernameOverride || cachedBotUsername || BOT_USERNAME;
  if (!username || !patientId) {
    return null;
  }
  return `https://t.me/${username}?start=ref_${patientId}`;
}
function formatMoney(amount) {
  const value = cashbackRepo.toMoney(amount);
  return value.toLocaleString('uz-UZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function resolvePercent(override) {
  const percent = override != null ? Number(override) : CASHBACK_PERCENT;
  if (!Number.isFinite(percent) || percent <= 0) {
    return CASHBACK_PERCENT;
  }
  return percent;
}

async function notifyPatient(bot, patientId, message) {
  if (!bot || !patientId || !message) {
    return { sent: false, reason: 'MISSING_ARGS' };
  }

  try {
    const chatId = await getTelegramChatId(String(patientId));
    if (!chatId) {
      return { sent: false, reason: 'CHAT_ID_NOT_FOUND' };
    }

    await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
    return { sent: true, chatId };
  } catch (err) {
    console.error('❌ Cashback Telegram notify xatolik:', err?.message || err);
    return { sent: false, reason: err?.message || 'SEND_FAILED' };
  }
}

async function earnCashback({
  bot,
  patientId,
  paymentAmount,
  paymentId = null,
  cashbackPercent = null,
  notify = true,
  metadata = {},
}) {
  const amountBase = cashbackRepo.toMoney(paymentAmount);
  if (!patientId || amountBase <= 0) {
    const err = new Error('PATIENT_ID_AND_POSITIVE_PAYMENT_REQUIRED');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const percent = resolvePercent(cashbackPercent);
  const cashbackAmount = cashbackRepo.toMoney((amountBase * percent) / 100);

  if (cashbackAmount <= 0) {
    const balance = await cashbackRepo.getBalance(patientId);
    return {
      ok: true,
      skipped: true,
      reason: 'CASHBACK_AMOUNT_ZERO',
      balance,
      cashback_amount: 0,
      percent,
    };
  }

  const result = await cashbackRepo.applyBalanceChange({
    patientId,
    type: 'earn',
    amount: cashbackAmount,
    paymentId,
    paymentAmount: amountBase,
    note: `To'lovdan ${percent}% keshbek`,
    metadata: {
      ...metadata,
      percent,
    },
  });

  let notification = { sent: false };
  if (notify && !result.duplicate) {
    notification = await notifyPatient(
      bot,
      patientId,
      `💰 <b>Keshbek qo'shildi!</b>\n\n` +
        `To'lov: ${formatMoney(amountBase)} so'm\n` +
        `Keshbek (${percent}%): +${formatMoney(cashbackAmount)} so'm\n` +
        `Joriy balans: <b>${formatMoney(result.balance.balance)} so'm</b>\n\n` +
        `Balans: /balance`
    );
  }

  return {
    ok: true,
    duplicate: result.duplicate,
    cashback_amount: cashbackAmount,
    percent,
    balance: result.balance,
    transaction: result.transaction,
    notification,
  };
}

async function spendCashback({
  bot,
  patientId,
  amount,
  paymentId = null,
  notify = true,
  metadata = {},
}) {
  const spendAmount = cashbackRepo.toMoney(amount);
  if (!patientId || spendAmount <= 0) {
    const err = new Error('PATIENT_ID_AND_POSITIVE_AMOUNT_REQUIRED');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  try {
    const result = await cashbackRepo.applyBalanceChange({
      patientId,
      type: 'spend',
      amount: spendAmount,
      paymentId,
      note: 'To\'lovda keshbekdan yechish',
      metadata,
    });

    let notification = { sent: false };
    if (notify && !result.duplicate) {
      notification = await notifyPatient(
        bot,
        patientId,
        `🎁 <b>Keshbek ishlatildi</b>\n\n` +
          `Yechilgan: −${formatMoney(spendAmount)} so'm\n` +
          `Qolgan balans: <b>${formatMoney(result.balance.balance)} so'm</b>`
      );
    }

    return {
      ok: true,
      duplicate: result.duplicate,
      spent_amount: spendAmount,
      balance: result.balance,
      transaction: result.transaction,
      notification,
    };
  } catch (err) {
    if (err?.code === 'INSUFFICIENT_BALANCE' || err?.message === 'INSUFFICIENT_BALANCE') {
      const balance = await cashbackRepo.getBalance(patientId);
      const error = new Error('INSUFFICIENT_BALANCE');
      error.code = 'INSUFFICIENT_BALANCE';
      error.balance = balance;
      throw error;
    }
    throw err;
  }
}

async function processReferralRegistration({
  bot,
  referrerPatientId,
  referredPatientId,
  referredChatId = null,
}) {
  if (!referrerPatientId || !referredPatientId) {
    return { ok: false, skipped: true, reason: 'MISSING_IDS' };
  }

  if (String(referrerPatientId) === String(referredPatientId)) {
    return { ok: false, skipped: true, reason: 'SELF_REFERRAL' };
  }

  const bonus = cashbackRepo.toMoney(REFERRAL_BONUS_AMOUNT);
  const linkResult = await cashbackRepo.createReferralLink({
    referrerPatientId,
    referredPatientId,
    referredChatId,
    bonusAmount: bonus,
  });

  if (linkResult.duplicate) {
    return {
      ok: true,
      duplicate: true,
      referral: linkResult.referral,
      bonus_paid: linkResult.referral?.status === 'bonus_paid',
    };
  }

  let bonusResult = null;
  if (bonus > 0) {
    bonusResult = await cashbackRepo.applyBalanceChange({
      patientId: referrerPatientId,
      type: 'referral_bonus',
      amount: bonus,
      relatedPatientId: referredPatientId,
      note: 'Do\'stni taklif qilish bonusi',
      metadata: {
        referral_id: linkResult.referral?.id,
      },
    });

    await cashbackRepo.markReferralBonusPaid(linkResult.referral.id);

    await notifyPatient(
      bot,
      referrerPatientId,
      `🎁 <b>Referral bonus!</b>\n\n` +
        `Do'stingiz botga ulandi.\n` +
        `Bonus: +${formatMoney(bonus)} so'm\n` +
        `Balans: <b>${formatMoney(bonusResult.balance.balance)} so'm</b>`
    );

    await notifyPatient(
      bot,
      referredPatientId,
      `✅ Siz do'st taklifi orqali ulandingiz.\n` +
        `Taklif qiluvchiga bonus berildi. Rahmat!`
    );
  }

  return {
    ok: true,
    duplicate: false,
    referral: linkResult.referral,
    bonus_amount: bonus,
    bonus_result: bonusResult,
  };
}

async function getPatientCashbackSummary(patientId) {
  const balance = await cashbackRepo.getBalance(patientId);
  const referralsCount = balance.setup_required
    ? 0
    : await cashbackRepo.countReferrals(patientId);
  const username = await resolveBotUsername();

  return {
    ...balance,
    referrals_count: referralsCount,
    referral_link: buildReferralLink(patientId, username),
    bot_username: username,
    cashback_percent: CASHBACK_PERCENT,
    referral_bonus_amount: cashbackRepo.toMoney(REFERRAL_BONUS_AMOUNT),
  };
}

async function checkCashbackSetup() {
  try {
    const probe = await cashbackRepo.getBalance('__setup_probe__');
    if (probe.setup_required) {
      return {
        ok: false,
        reason: probe.setup_reason || 'TABLES_MISSING',
        message: probe.setup_reason === 'PERMISSION_DENIED'
          ? 'SUPABASE_SERVICE_KEY service_role emas yoki RLS ruxsat bermaydi'
          : 'migrations/007_cashback_system.sql Supabase da ishga tushiring',
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: 'CHECK_FAILED',
      message: err?.message || String(err),
    };
  }
}

module.exports = {
  BOT_USERNAME,
  CASHBACK_PERCENT,
  REFERRAL_BONUS_AMOUNT,
  buildReferralLink,
  checkCashbackSetup,
  earnCashback,
  formatMoney,
  getPatientCashbackSummary,
  processReferralRegistration,
  resolveBotUsername,
  spendCashback,
};
