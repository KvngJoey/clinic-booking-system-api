import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from './testHelper.js';

describe('Level 1 — Basic Booking Functionality', () => {
  let client;

  before(async () => {
    client = await createTestServer();
  });

  after(async () => {
    await client.close();
  });

  test('POST /reset replaces all slots and clears bookings', async () => {
    const slots = [
      {
        id: 's_lvl1_2',
        provider: 'Dr Ade',
        start: '2026-12-10T10:00:00Z',
        end: '2026-12-10T10:30:00Z'
      },
      {
        id: 's_lvl1_1',
        provider: 'Dr Chioma',
        start: '2026-12-10T09:00:00Z',
        end: '2026-12-10T09:30:00Z'
      }
    ];

    const res = await client.request('/reset', {
      method: 'POST',
      body: { slots }
    });

    assert.equal(res.status, 200);
  });

  test('GET /slots returns slots earliest start first with available: true', async () => {
    const res = await client.request('/slots');
    assert.equal(res.status, 200);
    assert(Array.isArray(res.data.slots));
    assert.equal(res.data.slots.length, 2);

    // Earliest start first: s_lvl1_1 (09:00) before s_lvl1_2 (10:00)
    assert.equal(res.data.slots[0].id, 's_lvl1_1');
    assert.equal(res.data.slots[0].available, true);
    assert.equal(res.data.slots[1].id, 's_lvl1_2');
    assert.equal(res.data.slots[1].available, true);
  });

  test('GET /slots?provider=Dr Ade filters correctly', async () => {
    const res = await client.request('/slots?provider=Dr%20Ade');
    assert.equal(res.status, 200);
    assert.equal(res.data.slots.length, 1);
    assert.equal(res.data.slots[0].provider, 'Dr Ade');
  });

  test('POST /bookings successfully books an available slot', async () => {
    const payload = {
      slot_id: 's_lvl1_1',
      name: 'Ada Obi',
      email: 'ada@example.com'
    };

    const res = await client.request('/bookings', {
      method: 'POST',
      body: payload
    });

    assert.equal(res.status, 201);
    assert(res.data.id, 'Expected generated booking id');
    assert.equal(res.data.slot_id, 's_lvl1_1');
    assert.equal(res.data.name, 'Ada Obi');
    assert.equal(res.data.email, 'ada@example.com');
    assert.equal(res.data.status, 'confirmed');
    assert(res.data.created_at, 'Expected created_at timestamp');

    // Slot should now have available: false
    const slotsRes = await client.request('/slots');
    const bookedSlot = slotsRes.data.slots.find(s => s.id === 's_lvl1_1');
    assert.equal(bookedSlot.available, false);
  });

  test('GET /bookings/{id} retrieves the created booking', async () => {
    // First book s_lvl1_2
    const createRes = await client.request('/bookings', {
      method: 'POST',
      body: {
        slot_id: 's_lvl1_2',
        name: 'Koya Patient',
        email: 'patient@example.com'
      }
    });
    assert.equal(createRes.status, 201);
    const bookingId = createRes.data.id;

    // Retrieve by ID
    const getRes = await client.request(`/bookings/${bookingId}`);
    assert.equal(getRes.status, 200);
    assert.equal(getRes.data.id, bookingId);
    assert.equal(getRes.data.name, 'Koya Patient');
    assert.equal(getRes.data.email, 'patient@example.com');
    assert.equal(getRes.data.status, 'confirmed');
  });

  test('GET /bookings/{id} returns 404 for nonexistent id', async () => {
    const res = await client.request('/bookings/non-existent-id-12345');
    assert.equal(res.status, 404);
    assert.equal(res.data.error, 'booking not found');
  });
});
