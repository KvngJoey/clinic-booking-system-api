import crypto from 'node:crypto';
import storageService from './storageService.js';
import slotsService from './slotsService.js';
import idempotencyService from './idempotencyService.js';
import { writeLock } from '../utils/asyncLock.js';
import { encodeCursor, decodeCursor } from '../utils/cursor.js';

class BookingsService {
  /**
   * Create a booking with concurrency locking and optional idempotency.
   */
  async createBooking({ slot_id, name, email }, idempotencyKey = null) {
    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedBody = {
      slot_id,
      name: trimmedName,
      email: normalizedEmail
    };

    return await writeLock.runExclusive(async () => {
      // 1. Check idempotency if key is present
      if (idempotencyKey) {
        const record = await idempotencyService.getRecord(idempotencyKey);
        if (record) {
          if (idempotencyService.isSameBody(record.body, normalizedBody)) {
            return {
              statusCode: record.statusCode,
              data: record.response,
              isReplay: true
            };
          } else {
            const err = new Error('Idempotency-Key reused with a different body');
            err.statusCode = 422;
            throw err;
          }
        }
      }

      // 2. Validate slot exists
      const slot = await slotsService.getSlotById(slot_id);
      if (!slot) {
        const err = new Error('slot not found');
        err.statusCode = 404;
        throw err;
      }

      // 3. Validate slot has not started
      const now = Date.now();
      const slotStartTime = new Date(slot.start).getTime();
      if (slotStartTime <= now) {
        const err = new Error('slot has already started');
        err.statusCode = 400;
        throw err;
      }

      // 4. Concurrency check: verify slot does not have a confirmed booking
      const bookings = await storageService.getBookings();
      const isAlreadyBooked = bookings.some(
        b => b.slot_id === slot_id && b.status === 'confirmed'
      );
      if (isAlreadyBooked) {
        const err = new Error('slot already booked');
        err.statusCode = 409;
        throw err;
      }

      // 5. Create new booking
      const newBooking = {
        id: crypto.randomUUID(),
        slot_id,
        name: trimmedName,
        email: normalizedEmail,
        status: 'confirmed',
        created_at: new Date().toISOString()
      };

      bookings.push(newBooking);
      await storageService.saveBookings(bookings);

      // 6. Save idempotency record if key was provided
      if (idempotencyKey) {
        await idempotencyService.saveRecord(idempotencyKey, normalizedBody, 201, newBooking);
      }

      return {
        statusCode: 201,
        data: newBooking,
        isReplay: false
      };
    });
  }

  /**
   * Get booking by id
   */
  async getBookingById(id) {
    const bookings = await storageService.getBookings();
    const booking = bookings.find(b => b.id === id);
    if (!booking) {
      const err = new Error('booking not found');
      err.statusCode = 404;
      throw err;
    }
    return booking;
  }

  /**
   * Cancel booking (Level 3)
   */
  async cancelBooking(id) {
    return await writeLock.runExclusive(async () => {
      const bookings = await storageService.getBookings();
      const booking = bookings.find(b => b.id === id);
      if (!booking) {
        const err = new Error('booking not found');
        err.statusCode = 404;
        throw err;
      }

      if (booking.status === 'cancelled') {
        const err = new Error('already cancelled');
        err.statusCode = 409;
        throw err;
      }

      booking.status = 'cancelled';
      await storageService.saveBookings(bookings);
      return booking;
    });
  }

  /**
   * List person's bookings with cursor pagination (Level 4)
   * Oldest first.
   */
  async listBookingsByEmail(email, limit = 10, cursor = null) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const bookings = await storageService.getBookings();

    // Filter by email (case-insensitive)
    const personBookings = bookings.filter(
      b => b.email.toLowerCase() === normalizedEmail
    );

    // Sort oldest first
    personBookings.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const offset = decodeCursor(cursor);
    const page = personBookings.slice(offset, offset + limit);
    const nextOffset = offset + limit < personBookings.length ? offset + limit : null;
    const next_cursor = encodeCursor(nextOffset);

    return {
      bookings: page,
      next_cursor
    };
  }
}

export const bookingsService = new BookingsService();
export default bookingsService;
