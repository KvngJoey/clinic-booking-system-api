/**
 * Centralized error handler.
 * Guarantees every error returns { "error": "<message>" } format.
 */
export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (err.status ? err.status : 500);
  const message = err.message || 'Internal Server Error';

  if (statusCode >= 500) {
    console.error(`[SERVER ERROR] ${req.method} ${req.url}:`, err);
  }

  res.status(statusCode).json({ error: message });
}

