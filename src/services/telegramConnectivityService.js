const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();

async function testTelegramApiConnectivity() {
  if (!botToken) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN_MISSING' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload.ok) {
      return {
        ok: false,
        error: 'TELEGRAM_API_ERROR',
        status: response.status,
        description: payload.description || null,
      };
    }

    return {
      ok: true,
      bot: payload.result,
    };
  } catch (err) {
    return {
      ok: false,
      error: String(err?.name || err?.code || 'NETWORK_ERROR'),
      message: err?.message || String(err),
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  testTelegramApiConnectivity,
};
