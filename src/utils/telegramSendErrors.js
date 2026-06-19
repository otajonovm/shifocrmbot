function isPermanentTelegramSendError(error) {
  const text = String(error?.message || error || '').toLowerCase();

  return (
    text.includes('403') ||
    text.includes('blocked') ||
    text.includes('bot was blocked') ||
    text.includes('user is deactivated') ||
    text.includes('chat not found') ||
    text.includes('400') ||
    text.includes('bad request')
  );
}

function isRetryableTelegramSendError(error) {
  if (isPermanentTelegramSendError(error)) {
    return false;
  }

  const text = String(error?.message || error || '').toLowerCase();

  return (
    text.includes('etimedout') ||
    text.includes('econnreset') ||
    text.includes('econnrefused') ||
    text.includes('efatal') ||
    text.includes('429') ||
    text.includes('too many requests') ||
    text.includes('fetch failed') ||
    text.includes('socket hang up')
  );
}

function parseRetryCount(failureReason) {
  const match = String(failureReason || '').match(/^retry:(\d+):/);
  if (!match) {
    return 0;
  }

  return Number(match[1]) || 0;
}

function buildRetryFailureReason(retryCount, errorMessage) {
  const safeMessage = String(errorMessage || 'unknown').slice(0, 150);
  return `retry:${retryCount}:${safeMessage}`;
}

module.exports = {
  buildRetryFailureReason,
  isPermanentTelegramSendError,
  isRetryableTelegramSendError,
  parseRetryCount,
};
