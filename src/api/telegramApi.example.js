/**
 * ShifoCRM frontend uchun to'liq Telegram API client (namuna).
 * Bu faylni ShifoCRM loyihasida src/api/telegramApi.js ga nusxalang.
 */

const TELEGRAM_API_URL = import.meta.env.VITE_TELEGRAM_API_URL;
const TELEGRAM_API_KEY = import.meta.env.VITE_TELEGRAM_API_KEY;

function buildHeaders() {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (TELEGRAM_API_KEY) {
    headers['X-API-KEY'] = TELEGRAM_API_KEY;
  }

  return headers;
}

function resolveApiUrl(path) {
  if (!TELEGRAM_API_URL) {
    return null;
  }

  if (import.meta.env.DEV && path.startsWith('/api/telegram/')) {
    return path;
  }

  return `${TELEGRAM_API_URL.replace(/\/$/, '')}${path}`;
}

async function postJson(path, body) {
  const url = resolveApiUrl(path);
  if (!url) {
    console.warn('TELEGRAM_API_URL sozlanmagan');
    return { ok: false, error: 'NOT_CONFIGURED' };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'UNKNOWN_ERROR' }));
      console.error('Telegram API error:', error);
      return { ok: false, error: error.error || 'HTTP_ERROR', details: error };
    }

    return { ok: true, data: await response.json().catch(() => ({})) };
  } catch (error) {
    console.error('Telegram API exception:', error);
    return { ok: false, error: error.message || 'NETWORK_ERROR' };
  }
}

export async function sendTelegramNotification({ patientId, message, parseMode = 'HTML' }) {
  return postJson('/api/send', {
    patient_id: String(patientId),
    message,
    parse_mode: parseMode,
  });
}

export async function schedulePatientFollowUps({
  patientId,
  patientName,
  phone,
  notes = null,
  customMessages = null,
}) {
  return postJson('/api/patients/complete', {
    patientId: String(patientId),
    patientName,
    phone,
    notes,
    customMessages,
  });
}

export async function scheduleLeadFollowUps({
  leadId,
  patientId,
  phone,
  patientName,
  notes = null,
  customMessages = null,
}) {
  return postJson('/api/patients/leads/complete', {
    leadId,
    patientId: patientId ? String(patientId) : undefined,
    phone,
    patientName,
    notes,
    customMessages,
  });
}

export async function sendAppointmentReminder({ patientId, appointmentDate, doctorName }) {
  const message =
    `🗓 <b>Qabul eslatmasi</b>\n\n` +
    `📅 Sana: ${appointmentDate}\n` +
    `👨‍⚕️ Shifokor: ${doctorName}\n\n` +
    `Iltimos, vaqtida keling.`;

  return sendTelegramNotification({ patientId, message });
}

export async function sendAppointmentConfirmed({ patientId, appointmentDate, doctorName }) {
  const message =
    `✅ <b>Qabulingiz tasdiqlandi</b>\n\n` +
    `📅 Sana: ${appointmentDate}\n` +
    `👨‍⚕️ Shifokor: ${doctorName}`;

  return sendTelegramNotification({ patientId, message });
}

export async function sendAppointmentCanceled({ patientId, reason }) {
  const message =
    `❌ <b>Qabulingiz bekor qilindi</b>\n\n` +
    `${reason || 'Sabab ko\'rsatilmagan'}`;

  return sendTelegramNotification({ patientId, message });
}

export async function sendDebtReminder({ patientId, amount, dueDate }) {
  const message =
    `💰 <b>Qarz eslatmasi</b>\n\n` +
    `Miqdor: ${amount} so'm\n` +
    `Muddat: ${dueDate}\n\n` +
    `Iltimos, to'lovni amalga oshiring.`;

  return sendTelegramNotification({ patientId, message });
}

export {
  applyPaymentCashback,
  buildReferralDeepLink,
  earnCashback,
  getCashbackBalance,
  spendCashback,
} from './cashbackApi.example.js';

export function buildTelegramLeadDeepLink({ botUsername, leadId }) {
  const username = String(botUsername || '').replace(/^@/, '');
  if (!username || !leadId) {
    return null;
  }

  return `https://t.me/${username}?start=lead_${leadId}`;
}
