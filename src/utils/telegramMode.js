const DEFAULT_WEBHOOK_PATH = '/telegram/webhook';

function getWebhookPath() {
  const raw = String(process.env.TELEGRAM_WEBHOOK_PATH || DEFAULT_WEBHOOK_PATH).trim();
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function isWebhookMode() {
  if (process.env.TELEGRAM_USE_WEBHOOK === 'true') {
    return true;
  }
  if (process.env.TELEGRAM_USE_WEBHOOK === 'false') {
    return false;
  }
  return !!(process.env.TELEGRAM_WEBHOOK_URL?.trim() || process.env.PUBLIC_APP_URL?.trim());
}

function getWebhookUrl() {
  const explicit = process.env.TELEGRAM_WEBHOOK_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }

  const baseUrl = process.env.PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim();
  if (!baseUrl) {
    return null;
  }

  return `${baseUrl.replace(/\/$/, '')}${getWebhookPath()}`;
}

module.exports = {
  DEFAULT_WEBHOOK_PATH,
  getWebhookPath,
  getWebhookUrl,
  isWebhookMode,
};
