import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createTestServer } from './testHelper.js';

describe('Data Persistence across Server Restart', () => {
  test('Bookings and slots survive server restart', async () => {
    // 1. Start Server 1 with isolated temp dir
    const server1 = await createTestServer();
    const sharedTempDir = server1.tempDir;

    const slots = [
      {
        id: 's_persist_1',
        provider: 'Dr Ade',
        start: '2026-12-30T09:00:00Z',
        end: '2026-12-30T09:30:00Z'
      }
    ];

    await server1.request('/reset', {
      method: 'POST',
      body: { slots }
    });

    // Create a booking on Server 1
    const bookingRes = await server1.request('/bookings', {
      method: 'POST',
      body: {
        slot_id: 's_persist_1',
        name: 'Persistent Patient',
        email: 'persistent@example.com'
      }
    });

    assert.equal(bookingRes.status, 201);
    const bookingId = bookingRes.data.id;

    // Shut down Server 1, preserving disk files
    await server1.close(true);

    // 2. Start new Server 2 pointing to the same disk directory
    const server2 = await createTestServer({ tempDir: sharedTempDir });

    // Verify slot remains booked (available: false)
    const slotsRes = await server2.request('/slots');
    assert.equal(slotsRes.status, 200);
    const persistedSlot = slotsRes.data.slots.find(s => s.id === 's_persist_1');
    assert(persistedSlot);
    assert.equal(persistedSlot.available, false);

    // Verify booking can still be retrieved
    const getBookingRes = await server2.request(`/bookings/${bookingId}`);
    assert.equal(getBookingRes.status, 200);
    assert.equal(getBookingRes.data.id, bookingId);
    assert.equal(getBookingRes.data.name, 'Persistent Patient');
    assert.equal(getBookingRes.data.email, 'persistent@example.com');
    assert.equal(getBookingRes.data.status, 'confirmed');

    // Clean up Server 2 and tempDir
    await server2.close(false);
  });
});
