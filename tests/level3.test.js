import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from './testHelper.js';

describe('Level 3 — Concurrency and Cancellation', () => {
  let client;

  before(async () => {
    client = await createTestServer();

    const slots = [
      {
        id: 's_single',
        provider: 'Dr Ade',
        start: '2026-12-20T09:00:00Z',
        end: '2026-12-20T09:30:00Z'
      },
      {
        id: 's_concurrent',
        provider: 'Dr Chioma',
        start: '2026-12-20T10:00:00Z',
        end: '2026-12-20T10:30:00Z'
      }
    ];

    await client.request('/reset', {
      method: 'POST',
      body: { slots }
    });
  });

  after(async () => {
    await client.close();
  });

  test('Booking an already booked slot returns 409', async () => {
    // 1st booking succeeds
    const firstRes = await client.request('/bookings', {
      method: 'POST',
      body: {
        slot_id: 's_single',
        name: 'Patient One',
        email: 'patient1@example.com'
      }
    });
    assert.equal(firstRes.status, 201);

    // 2nd booking for same slot returns 409
    const secondRes = await client.request('/bookings', {
      method: 'POST',
      body: {
        slot_id: 's_single',
        name: 'Patient Two',
        email: 'patient2@example.com'
      }
    });
    assert.equal(secondRes.status, 409);
    assert.equal(secondRes.data.error, 'slot already booked');
  });

  test('Simultaneous booking requests for the same slot: only one succeeds, others get 409', async () => {
    const concurrentCount = 10;
    const promises = [];

    for (let i = 0; i < concurrentCount; i++) {
      promises.push(
        client.request('/bookings', {
          method: 'POST',
          body: {
            slot_id: 's_concurrent',
            name: `Concurrent Patient ${i}`,
            email: `concurrent_${i}@example.com`
          }
        })
      );
    }

    const results = await Promise.all(promises);

    const successful = results.filter(r => r.status === 201);
    const conflicts = results.filter(r => r.status === 409);

    assert.equal(successful.length, 1, 'Exactly one concurrent request must succeed with 201');
    assert.equal(conflicts.length, concurrentCount - 1, 'All other concurrent requests must receive 409');

    conflicts.forEach(c => {
      assert.equal(c.data.error, 'slot already booked');
    });
  });

  test('Cancelling a booking (DELETE /bookings/{id}) sets status to cancelled and frees the slot', async () => {
    // Book s_single slot was already booked. Let's lookup booking id for s_single
    const listRes = await client.request('/bookings?email=patient1@example.com');
    const booking = listRes.data.bookings.find(b => b.slot_id === 's_single');
    assert(booking);

    // Cancel booking
    const cancelRes = await client.request(`/bookings/${booking.id}`, {
      method: 'DELETE'
    });
    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.data.id, booking.id);
    assert.equal(cancelRes.data.status, 'cancelled');

    // Slot is now freed (available: true)
    const slotsRes = await client.request('/slots');
    const slot = slotsRes.data.slots.find(s => s.id === 's_single');
    assert.equal(slot.available, true);

    // A patient can now book s_single again!
    const rebookRes = await client.request('/bookings', {
      method: 'POST',
      body: {
        slot_id: 's_single',
        name: 'New Patient',
        email: 'newpatient@example.com'
      }
    });
    assert.equal(rebookRes.status, 201);
  });

  test('Cancelling an already cancelled booking returns 409', async () => {
    // Re-cancel the previously cancelled booking
    const listRes = await client.request('/bookings?email=patient1@example.com');
    const booking = listRes.data.bookings.find(b => b.status === 'cancelled');
    assert(booking);

    const reCancelRes = await client.request(`/bookings/${booking.id}`, {
      method: 'DELETE'
    });
    assert.equal(reCancelRes.status, 409);
    assert.equal(reCancelRes.data.error, 'already cancelled');
  });

  test('Cancelling non-existent booking returns 404', async () => {
    const res = await client.request('/bookings/non-existent-id-999', {
      method: 'DELETE'
    });
    assert.equal(res.status, 404);
    assert.equal(res.data.error, 'booking not found');
  });
});

