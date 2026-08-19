const { getWebhookPath, getWebhookUrl, isWebhookMode, isCloudRuntime } = require('../utils/telegramMode');
const { testTelegramApiConnectivity } = require('./telegramConnectivityService');

function registerWebhookRoute(app, bot) {
  const path = getWebhookPath();
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

  app.post(path, (req, res) => {
    if (secret) {
      const header = req.headers['x-telegram-bot-api-secret-token'];
      if (header !== secret) {
        console.warn('⚠️ Webhook secret noto\'g\'ri — 403');
        return res.sendStatus(403);
      }
    }

    const update = req.body;
    const updateKind = update?.message?.text
      || update?.callback_query?.data
      || update?.update_id
      || 'unknown';
    console.log(`📩 Webhook update: ${updateKind}`);

    try {
      bot.processUpdate(update);
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

  const { isHeroku } = require('../utils/telegramMode');
  const heroku = isHeroku();

  if (!heroku && (process.env.TELEGRAM_AUTO_SET_WEBHOOK === 'false' || (isCloudRuntime() && process.env.TELEGRAM_AUTO_SET_WEBHOOK !== 'true'))) {
    console.log('ℹ️ Pod ichidan setWebhook o\'tkazib yuborildi (outbound ETIMEDOUT)');
    console.log('   Webhook route faol — localdan bir marta o\'rnating: npm run set-webhook');
    console.log(`   URL: ${webhookUrl}`);
    return { ok: false, skipped: true, reason: 'AUTO_SET_SKIPPED' };
  }

  const connectivity = await testTelegramApiConnectivity();
  if (!connectivity.ok) {
    console.warn('⚠️ api.telegram.org ga chiqib bo\'lmadi — mavjud webhook saqlanadi');
    console.warn('   Localdan o\'rnating: npm run set-webhook');
    return { ok: false, skipped: true, reason: 'NO_CONNECTIVITY' };
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  const options = {
    allowed_updates: ['message', 'callback_query'],
  };

  if (secret) {
    options.secret_token = secret;
  }

  try {
    const success = await bot.setWebHook(webhookUrl, options);

    if (!success) {
      console.error('❌ Telegram setWebHook false qaytardi');
      return { ok: false, error: 'SET_WEBHOOK_FAILED' };
    }

    console.log(`✅ Telegram webhook o'rnatildi: ${webhookUrl}`);
    return { ok: true, url: webhookUrl };
  } catch (err) {
    console.error('❌ Telegram webhook o\'rnatishda xatolik:', err?.message || err);
    console.error('   💡 Localdan o\'rnating: npm run set-webhook');
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
