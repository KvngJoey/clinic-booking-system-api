/**
 * Rate Limiter for Level 5.
 * "at most 5 attempts per email per minute, failed attempts included.
 *  The 6th returns 429 with a Retry-After header in whole seconds.
 *  Other emails aren't affected."
 */
class EmailRateLimiter {
  constructor(windowMs = 60 * 1000, maxAttempts = 5) {
    this.windowMs = windowMs;
    this.maxAttempts = maxAttempts;
    this.attempts = new Map(); // email -> [timestamp, timestamp, ...]
  }

  middleware() {
    return (req, res, next) => {
      const emailRaw = req.body && req.body.email;
      if (!emailRaw || typeof emailRaw !== 'string') {
        // If email is not present or not string, let validation middleware handle 400
        return next();
      }

      const email = emailRaw.trim().toLowerCase();
      const now = Date.now();

      // Get or initialize timestamps
      let timestamps = this.attempts.get(email) || [];

      // Filter out attempts older than windowMs
      timestamps = timestamps.filter(ts => now - ts < this.windowMs);

      if (timestamps.length >= this.maxAttempts) {
        // Exceeded limit
        const oldest = timestamps[0];
        const msRemaining = (oldest + this.windowMs) - now;
        const retryAfterSeconds = Math.max(1, Math.ceil(msRemaining / 1000));

        res.setHeader('Retry-After', retryAfterSeconds.toString());
        return res.status(429).json({
          error: 'Too many attempts for this email'
        });
      }

      // Record this attempt (failed and successful attempts both count)
      timestamps.push(now);
      this.attempts.set(email, timestamps);

      next();
    };
  }

  reset() {
    this.attempts.clear();
  }
}

export const emailRateLimiter = new EmailRateLimiter();
export default emailRateLimiter;

