const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validation for POST /bookings (Level 2).
 * 400 if slot_id, name or email is missing or empty, or email isn't valid.
 */
export function validateBookingInput(req, res, next) {
  const { slot_id, name, email } = req.body || {};

  if (!slot_id || typeof slot_id !== 'string' || !slot_id.trim()) {
    return res.status(400).json({ error: 'slot_id is required' });
  }

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'email is required' });
  }

  const trimmedEmail = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  next();
}

/**
 * Validation for GET /bookings (Level 4).
 * email is required query param.
 * limit must be between 1 and 50 if provided.
 */
export function validateListBookingsQuery(req, res, next) {
  const { email, limit } = req.query;

  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'email query parameter is required' });
  }

  if (limit !== undefined) {
    const parsedLimit = Number(limit);
    // Must be integer, >= 1, <= 50
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
      return res.status(400).json({ error: 'limit must be an integer between 1 and 50' });
    }
  }

  next();
}

/**
 * Validation for POST /reset (Level 1).
 * slots array is required.
 */
export function validateResetInput(req, res, next) {
  const { slots } = req.body || {};

  if (!Array.isArray(slots)) {
    return res.status(400).json({ error: 'slots must be an array' });
  }

  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (!s || typeof s !== 'object' || !s.id || !s.provider || !s.start || !s.end) {
      return res.status(400).json({ error: `Invalid slot at index ${i}` });
    }
  }

  next();
}
