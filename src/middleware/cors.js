function parseAllowedOrigins() {
  const raw = String(process.env.CORS_ORIGIN || '').trim();
  if (!raw || raw === '*') {
    return null;
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function corsMiddleware(req, res, next) {
  const allowedOrigins = parseAllowedOrigins();
  const requestOrigin = req.headers.origin;

  if (!allowedOrigins) {
    res.header('Access-Control-Allow-Origin', '*');
  } else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.header('Access-Control-Allow-Origin', requestOrigin);
    res.header('Vary', 'Origin');
  } else if (!requestOrigin) {
    res.header('Access-Control-Allow-Origin', allowedOrigins[0]);
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-API-KEY');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
}

module.exports = {
  corsMiddleware,
};
