import storageService from '../services/storageService.js';
import emailRateLimiter from '../middleware/rateLimitMiddleware.js';

export async function handleReset(req, res, next) {
  try {
    const { slots } = req.body;
    await storageService.reset(slots);
    emailRateLimiter.reset();
    res.status(200).json({ message: 'Done' });
  } catch (err) {
    next(err);
  }
}
