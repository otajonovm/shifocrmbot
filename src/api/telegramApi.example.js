/**
 * ShifoCRM uchun Telegram API client misoli
 * Bu faylni shifocrm/src/api/telegramApi.js ga nusxalang
 */

const TELEGRAM_API_URL = import.meta.env.VITE_TELEGRAM_API_URL;
const TELEGRAM_API_KEY = import.meta.env.VITE_TELEGRAM_API_KEY;

/**
 * Telegram orqali xabar yuborish
 * @param {Object} params
 * @param {string} params.patientId
 * @param {string} params.message
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function sendTelegramNotification({ patientId, message }) {
  if (!TELEGRAM_API_URL) {
    console.warn('TELEGRAM_API_URL sozlanmagan');
    return { ok: false, error: 'NOT_CONFIGURED' };
  }
  try {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (TELEGRAM_API_KEY) {
      headers['X-API-KEY'] = TELEGRAM_API_KEY;
    }
    const response = await fetch(`${TELEGRAM_API_URL}/api/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        patient_id: String(patientId),
        message,
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'UNKNOWN_ERROR' }));
      console.error('Telegram API error:', error);
      return { ok: false, error: error.error || 'HTTP_ERROR' };
    }
    return { ok: true };
  } catch (error) {
    console.error('Telegram API exception:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Qabul eslatmasi yuborish
 * @param {Object} params
 * @param {string} params.patientId
 * @param {string} params.appointmentDate
 * @param {string} params.doctorName
 * @returns {Promise<{ok: boolean}>}
 */
export async function sendAppointmentReminder({ patientId, appointmentDate, doctorName }) {
  const message = `📅 Qabul eslatmasi:\n\n` +
    `Sana: ${appointmentDate}\n` +
    `Shifokor: ${doctorName}\n\n` +
    `Iltimos, vaqtida keling.`;
  return await sendTelegramNotification({ patientId, message });
}

/**
 * Qarz eslatmasi yuborish
 * @param {Object} params
 * @param {string} params.patientId
 * @param {number} params.amount
 * @param {string} params.dueDate
 * @returns {Promise<{ok: boolean}>}
 */
export async function sendDebtReminder({ patientId, amount, dueDate }) {
  const message = `💰 Qarz eslatmasi:\n\n` +
    `Miqdor: ${amount} so'm\n` +
    `Muddat: ${dueDate}\n\n` +
    `Iltimos, to'lovni amalga oshiring.`;
  return await sendTelegramNotification({ patientId, message });
}
