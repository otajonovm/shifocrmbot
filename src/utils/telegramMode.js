const DEFAULT_WEBHOOK_PATH = '/telegram/webhook';

function getWebhookPath() {
  const raw = String(process.env.TELEGRAM_WEBHOOK_PATH || DEFAULT_WEBHOOK_PATH).trim();
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function isCloudRuntime() {
  return !!(
    process.env.KUBERNETES_SERVICE_HOST ||
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_ENVIRONMENT_NAME ||
    process.env.DO_APP_ID ||
    process.env.DIGITALOCEAN_APP_ID ||
    process.env.FLY_APP_NAME ||
    process.env.RENDER ||
    (process.env.NODE_ENV === 'production' && process.env.PORT)
  );
}

function resolvePublicBaseUrl() {
  const candidates = [
    process.env.PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.DIGITALOCEAN_APP_URL,
  ];

  for (const value of candidates) {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      continue;
    }

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed.replace(/\/$/, '');
    }

    return `https://${trimmed.replace(/\/$/, '')}`;
  }

  return null;
}

function isPrivateOrLocalUrl(url) {
  const text = String(url || '').toLowerCase();
  return (
    text.includes('localhost') ||
    text.includes('127.0.0.1') ||
    text.includes('100.127.') ||
    text.includes('10.') ||
    text.includes('192.168.')
  );
}

function isWebhookMode() {
  if (process.env.TELEGRAM_USE_WEBHOOK === 'true') {
    return true;
  }

  if (process.env.TELEGRAM_USE_WEBHOOK === 'false') {
    return false;
  }

  if (process.env.TELEGRAM_WEBHOOK_URL?.trim()) {
    return true;
  }

  const publicBase = resolvePublicBaseUrl();
  if (publicBase && !isPrivateOrLocalUrl(publicBase)) {
    return true;
  }

  return false;
}

function shouldForceDisablePolling() {
  if (isWebhookMode()) {
    return true;
  }

  if (process.env.TELEGRAM_POLLING_ENABLED === 'true') {
    return false;
  }

  if (process.env.TELEGRAM_POLLING_ENABLED === 'false') {
    return true;
  }

  return isCloudRuntime();
}

function getWebhookUrl() {
  const explicit = process.env.TELEGRAM_WEBHOOK_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }

  const baseUrl = resolvePublicBaseUrl();
  if (!baseUrl) {
    return null;
  }

  return `${baseUrl.replace(/\/$/, '')}${getWebhookPath()}`;
}

function getTelegramModeInfo() {
  const webhookMode = isWebhookMode();
  const cloud = isCloudRuntime();
  const publicBase = resolvePublicBaseUrl();
  const webhookUrl = getWebhookUrl();
  const forceDisablePolling = shouldForceDisablePolling();

  return {
    cloud,
    webhookMode,
    forceDisablePolling,
    publicBaseUrl: publicBase,
    webhookUrl,
    pollingAllowed: !webhookMode && !forceDisablePolling,
  };
}

module.exports = {
  DEFAULT_WEBHOOK_PATH,
  getTelegramModeInfo,
  getWebhookPath,
  getWebhookUrl,
  isCloudRuntime,
  isPrivateOrLocalUrl,
  isWebhookMode,
  resolvePublicBaseUrl,
  shouldForceDisablePolling,
};
