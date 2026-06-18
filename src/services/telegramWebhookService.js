const { getWebhookPath, getWebhookUrl, isWebhookMode } = require('../utils/telegramMode');

function registerWebhookRoute(app, bot) {
  const path = getWebhookPath();
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

  app.post(path, (req, res) => {
    if (secret) {
      const header = req.headers['x-telegram-bot-api-secret-token'];
      if (header !== secret) {
        return res.sendStatus(403);
      }
    }

    try {
      bot.processUpdate(req.body);
      return res.sendStatus(200);
    } catch (err) {
      console.error('❌ Webhook processUpdate xatolik:', err?.message || err);
      return res.sendStatus(200);
    }
  });

  console.log(`🔗 Telegram webhook route: POST ${path}`);
}

async function setupTelegramWebhook(bot) {
  if (!isWebhookMode()) {
    return { ok: false, skipped: true, reason: 'POLLING_MODE' };
  }

  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    console.error('❌ Webhook URL topilmadi. TELEGRAM_WEBHOOK_URL yoki PUBLIC_APP_URL qo\'ying.');
    return { ok: false, error: 'WEBHOOK_URL_MISSING' };
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  const options = {
    allowed_updates: ['message', 'callback_query'],
  };

  if (secret) {
    options.secret_token = secret;
  }

  try {
    await bot.deleteWebHook({ drop_pending_updates: false });
    const success = await bot.setWebHook(webhookUrl, options);

    if (!success) {
      console.error('❌ Telegram setWebHook false qaytardi');
      return { ok: false, error: 'SET_WEBHOOK_FAILED' };
    }

    console.log(`✅ Telegram webhook o'rnatildi: ${webhookUrl}`);
    return { ok: true, url: webhookUrl };
  } catch (err) {
    console.error('❌ Telegram webhook o\'rnatishda xatolik:', err?.message || err);
    console.error('   💡 Agar pod api.telegram.org ga chiqa olmasa, webhookni local mashinadan o\'rnating:');
    console.error(`   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=${encodeURIComponent(webhookUrl)}"`);
    return { ok: false, error: err?.message || String(err) };
  }
}

async function deleteTelegramWebhook(bot) {
  if (!isWebhookMode()) {
    return;
  }

  try {
    await bot.deleteWebHook({ drop_pending_updates: false });
    console.log('🛑 Telegram webhook o\'chirildi');
  } catch (err) {
    console.warn('⚠️ Webhook o\'chirishda xatolik:', err?.message || err);
  }
}

module.exports = {
  deleteTelegramWebhook,
  registerWebhookRoute,
  setupTelegramWebhook,
};
