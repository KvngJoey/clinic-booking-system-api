import config from '../config/index.js';

/**
 * Authentication middleware (Level 2).
 * Verifies the X-API-Key header against configured API_KEY.
 * Missing or invalid key returns HTTP 401.
 */
export function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== config.apiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}
