const WEBHOOK_URL = process.env.CRM_APPOINTMENT_RESPONSE_WEBHOOK;
const WEBHOOK_API_KEY = process.env.CRM_APPOINTMENT_RESPONSE_API_KEY;

async function sendAppointmentResponseWebhook(payload) {
  if (!WEBHOOK_URL) {
    return { ok: false, error: 'WEBHOOK_NOT_CONFIGURED' };
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (WEBHOOK_API_KEY) {
      headers['X-API-KEY'] = WEBHOOK_API_KEY;
    }

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'UNKNOWN_ERROR' }));
      console.error('❌ CRM webhook xatolik:', response.status, error);
      return { ok: false, error: error.error || 'HTTP_ERROR' };
    }

    return { ok: true };
  } catch (err) {
    console.error('❌ CRM webhook exception:', err);
    return { ok: false, error: err.message || 'NETWORK_ERROR' };
  }
}

module.exports = {
  sendAppointmentResponseWebhook,
};
