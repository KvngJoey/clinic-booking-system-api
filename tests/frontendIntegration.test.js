import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from './testHelper.js';

describe('Frontend & Client Proxy Integration', () => {
  let client;

  before(async () => {
    client = await createTestServer();
  });

  after(async () => {
    await client.close();
  });

  test('Serve index.html at root /', async () => {
    const res = await client.request('/', { omitApiKey: true });
    assert.equal(res.status, 200);
    assert(typeof res.data === 'string');
    assert(res.data.includes('Koya Health Clinic'));
    assert(res.data.includes('Available Appointment Slots'));
  });

  test('Serve bookings.html at /bookings.html', async () => {
    const res = await client.request('/bookings.html', { omitApiKey: true });
    assert.equal(res.status, 200);
    assert(typeof res.data === 'string');
    assert(res.data.includes('My Bookings'));
    assert(res.data.includes('Look Up Bookings'));
  });

  test('Client proxy /client-api/slots works without exposing X-API-Key', async () => {
    const res = await client.request('/client-api/slots', { omitApiKey: true });
    assert.equal(res.status, 200);
    assert(Array.isArray(res.data.slots));
  });

  test('Client proxy /client-api/bookings creates booking without X-API-Key in browser', async () => {
    // Get first available slot
    const slotsRes = await client.request('/client-api/slots', { omitApiKey: true });
    const availableSlot = slotsRes.data.slots.find(s => s.available);
    assert(availableSlot, 'Must have at least one available slot');

    const res = await client.request('/client-api/bookings', {
      method: 'POST',
      omitApiKey: true,
      body: {
        slot_id: availableSlot.id,
        name: 'Browser Visitor',
        email: 'browser@example.com'
      }
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.name, 'Browser Visitor');
    assert.equal(res.data.email, 'browser@example.com');
    assert.equal(res.data.status, 'confirmed');

    // Fetch booking by ID via client proxy
    const getRes = await client.request(`/client-api/bookings/${res.data.id}`, { omitApiKey: true });
    assert.equal(getRes.status, 200);
    assert.equal(getRes.data.id, res.data.id);

    // Cancel booking via client proxy
    const cancelRes = await client.request(`/client-api/bookings/${res.data.id}`, {
      method: 'DELETE',
      omitApiKey: true
    });
    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.data.status, 'cancelled');
  });
});

