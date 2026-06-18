/**
 * Telegram polling xatolarini o'qilishi oson formatga keltirish.
 * EFATAL: AggregateError ichidagi haqiqiy sababni ko'rsatadi.
 */
function unwrapTelegramError(error, depth = 0) {
  if (!error || depth > 5) {
    return 'unknown';
  }

  const parts = [];

  if (error.code) {
    parts.push(String(error.code));
  }

  const message = String(error.message || '').trim();
  if (message && message !== 'AggregateError') {
    parts.push(message);
  }

  if (Array.isArray(error.errors) && error.errors.length > 0) {
    const nested = error.errors
      .map((item) => unwrapTelegramError(item, depth + 1))
      .filter(Boolean)
      .join('; ');
    if (nested) {
      parts.push(nested);
    }
  }

  if (error.cause) {
    const causeText = unwrapTelegramError(error.cause, depth + 1);
    if (causeText && causeText !== 'unknown') {
      parts.push(`cause: ${causeText}`);
    }
  }

  return parts.join(' — ') || String(error);
}

function isPollingConflictError(errorText) {
  const normalized = String(errorText || '').toLowerCase();
  return normalized.includes('409') || normalized.includes('conflict');
}

function isPollingNetworkError(errorText) {
  const normalized = String(errorText || '').toLowerCase();
  return (
    normalized.includes('efatal') ||
    normalized.includes('aggregateerror') ||
    normalized.includes('econnrefused') ||
    normalized.includes('etimedout') ||
    normalized.includes('enotfound') ||
    normalized.includes('eai_again') ||
    normalized.includes('fetch failed') ||
    normalized.includes('socket hang up')
  );
}

function getPollingErrorHint(errorText) {
  if (isPollingConflictError(errorText)) {
    return 'Faqat BITTA instance polling qilishi kerak (local + DigitalOcean + K8s replicas=1).';
  }

  if (isPollingNetworkError(errorText)) {
    return 'api.telegram.org ga ulanish muammosi. Pod outbound internet, DNS yoki IPv6 ni tekshiring.';
  }

  return null;
}

module.exports = {
  unwrapTelegramError,
  isPollingConflictError,
  isPollingNetworkError,
  getPollingErrorHint,
};
