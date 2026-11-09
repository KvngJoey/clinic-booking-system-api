import { Router } from 'express';
import emailRateLimiter from '../middleware/rateLimitMiddleware.js';
import {
  validateBookingInput,
  validateListBookingsQuery
} from '../middleware/validationMiddleware.js';
import {
  handleGetSlots
} from '../controllers/slotsController.js';
import {
  handleCreateBooking,
  handleListBookings,
  handleGetBookingById,
  handleCancelBooking
} from '../controllers/bookingsController.js';

const router = Router();

// Frontend client proxy endpoints (Safe same-origin integration)
router.get('/slots', handleGetSlots);

router.post(
  '/bookings',
  emailRateLimiter.middleware(),
  validateBookingInput,
  handleCreateBooking
);

router.get(
  '/bookings',
  validateListBookingsQuery,
  handleListBookings
);

router.get('/bookings/:id', handleGetBookingById);
router.delete('/bookings/:id', handleCancelBooking);

export default router;
