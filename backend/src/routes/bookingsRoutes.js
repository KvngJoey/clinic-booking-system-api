import { Router } from 'express';
import { requireApiKey } from '../middleware/authMiddleware.js';
import emailRateLimiter from '../middleware/rateLimitMiddleware.js';
import {
  validateBookingInput,
  validateListBookingsQuery
} from '../middleware/validationMiddleware.js';
import {
  handleCreateBooking,
  handleListBookings,
  handleGetBookingById,
  handleCancelBooking
} from '../controllers/bookingsController.js';

const router = Router();

// POST /bookings (Levels 1-5: Auth, Rate Limit, Validation, Concurrency, Idempotency)
router.post(
  '/',
  requireApiKey,
  emailRateLimiter.middleware(),
  validateBookingInput,
  handleCreateBooking
);

// GET /bookings (Level 4: List person's bookings with pagination)
router.get(
  '/',
  requireApiKey,
  validateListBookingsQuery,
  handleListBookings
);

// GET /bookings/:id (Level 1: Lookup booking)
router.get(
  '/:id',
  requireApiKey,
  handleGetBookingById
);

// DELETE /bookings/:id (Level 3: Cancel booking)
router.delete(
  '/:id',
  requireApiKey,
  handleCancelBooking
);

export default router;

