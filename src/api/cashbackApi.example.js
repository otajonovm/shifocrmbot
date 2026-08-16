/**
 * ShifoCRM frontend uchun cashback API client qo'shimchalari.
 * telegramApi.js ga qo'shing yoki alohida cashbackApi.js sifatida saqlang.
 */

const TELEGRAM_API_URL = import.meta.env.VITE_TELEGRAM_API_URL;
const TELEGRAM_API_KEY = import.meta.env.VITE_TELEGRAM_API_KEY;

function buildHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (TELEGRAM_API_KEY) {
    headers['X-API-KEY'] = TELEGRAM_API_KEY;
  }
  return headers;
}

function resolveUrl(path) {
  if (!TELEGRAM_API_URL) {
    return null;
  }
  return `${String(TELEGRAM_API_URL).replace(/\/$/, '')}${path}`;
}

async function requestJson(path, { method = 'GET', body } = {}) {
  const url = resolveUrl(path);
  if (!url) {
    return { ok: false, error: 'NOT_CONFIGURED' };
  }

  try {
    const response = await fetch(url, {
      method,
      headers: buildHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        error: data.error || 'HTTP_ERROR',
        status: response.status,
        details: data,
      };
    }

    return { ok: true, ...data };
  } catch (error) {
    console.error('Cashback API exception:', error);
    return { ok: false, error: error?.message || 'NETWORK_ERROR' };
  }
}

/** Bemor keshbek balansi */
export async function getCashbackBalance(patientId) {
  if (!patientId) {
    return { ok: false, error: 'PATIENT_ID_REQUIRED' };
  }
  return requestJson(`/api/cashback/balance/${encodeURIComponent(String(patientId))}`);
}

/**
 * To'lovdan 5% keshbek qo'shish + Telegram notification
 * @param {{ patientId: string|number, paymentAmount: number, paymentId?: string, cashbackPercent?: number }} params
 */
export async function earnCashback({
  patientId,
  paymentAmount,
  paymentId = null,
  cashbackPercent = undefined,
}) {
  return requestJson('/api/cashback/earn', {
    method: 'POST',
    body: {
      patient_id: String(patientId),
      payment_amount: Number(paymentAmount),
      payment_id: paymentId ? String(paymentId) : undefined,
      cashback_percent: cashbackPercent,
      notify: true,
    },
  });
}

/**
 * To'lovda keshbekdan yechish
 * @param {{ patientId: string|number, amount: number, paymentId?: string }} params
 */
export async function spendCashback({ patientId, amount, paymentId = null }) {
  return requestJson('/api/cashback/spend', {
    method: 'POST',
    body: {
      patient_id: String(patientId),
      amount: Number(amount),
      payment_id: paymentId ? String(paymentId) : undefined,
      notify: true,
    },
  });
}

/**
 * To'lov saqlangach chaqirish:
 * 1) agar cashbackUsed > 0 → spend
 * 2) cashAmount (to'lov − cashback) dan earn
 */
export async function applyPaymentCashback({
  patientId,
  paymentId,
  totalAmount,
  cashbackUsed = 0,
}) {
  const total = Number(totalAmount) || 0;
  const used = Math.max(0, Number(cashbackUsed) || 0);
  const cashPortion = Math.max(0, total - used);

  const result = {
    ok: true,
    spend: null,
    earn: null,
  };

  if (used > 0) {
    result.spend = await spendCashback({
      patientId,
      amount: used,
      paymentId: paymentId ? `${paymentId}:spend` : undefined,
    });
    if (!result.spend.ok) {
      return { ok: false, stage: 'spend', ...result };
    }
  }

  if (cashPortion > 0) {
    result.earn = await earnCashback({
      patientId,
      paymentAmount: cashPortion,
      paymentId: paymentId ? `${paymentId}:earn` : undefined,
    });
    if (!result.earn.ok) {
      return { ok: false, stage: 'earn', ...result };
    }
  }

  return result;
}

export function buildReferralDeepLink(botUsername, patientId) {
  const username = String(botUsername || '').replace(/^@/, '');
  if (!username || !patientId) {
    return null;
  }
  return `https://t.me/${username}?start=ref_${patientId}`;
}
