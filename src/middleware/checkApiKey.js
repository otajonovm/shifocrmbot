function createApiKeyMiddleware(apiKey) {
  return function checkApiKey(req, res, next) {
    if (!apiKey) {
      return next();
    }

    const providedKey = req.headers['x-api-key'];
    if (providedKey !== apiKey) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    return next();
  };
}

module.exports = {
  createApiKeyMiddleware,
};
