/**
 * Telegram API client sozlamalari.
 * DigitalOcean / Kubernetes da IPv4 majburiy qilish EFATAL: AggregateError ni kamaytiradi.
 */
function getTelegramBotOptions(polling = false) {
  const options = {
    request: {
      timeout: Number(process.env.TELEGRAM_REQUEST_TIMEOUT_MS || 30000),
      agentOptions: {
        keepAlive: true,
        family: 4,
      },
    },
  };

  if (polling) {
    options.polling = {
      interval: Number(process.env.TELEGRAM_POLLING_INTERVAL_MS || 1000),
      autoStart: true,
    };
  }

  return options;
}

module.exports = {
  getTelegramBotOptions,
};
