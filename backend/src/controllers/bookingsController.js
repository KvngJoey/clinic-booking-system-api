import bookingsService from '../services/bookingsService.js';

export async function handleCreateBooking(req, res, next) {
  try {
    const idempotencyKey = req.headers['idempotency-key'];
    const result = await bookingsService.createBooking(req.body, idempotencyKey);
    res.status(result.statusCode).json(result.data);
  } catch (err) {
    next(err);
  }
}

export async function handleListBookings(req, res, next) {
  try {
    const email = req.query.email;
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit, 10) : 10;
    const cursor = req.query.cursor || null;

    const result = await bookingsService.listBookingsByEmail(email, limit, cursor);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleGetBookingById(req, res, next) {
  try {
    const { id } = req.params;
    const booking = await bookingsService.getBookingById(id);
    res.status(200).json(booking);
  } catch (err) {
    next(err);
  }
}

export async function handleCancelBooking(req, res, next) {
  try {
    const { id } = req.params;
    const booking = await bookingsService.cancelBooking(id);
    res.status(200).json(booking);
  } catch (err) {
    next(err);
  }
}

