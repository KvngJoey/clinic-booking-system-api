import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from './testHelper.js';

describe('Level 2 — API Key Authentication and Validation', () => {
  let client;

  before(async () => {
    client = await createTestServer();

    // Reset with one future slot and one past slot
    const slots = [
      {
        id: 's_future',
        provider: 'Dr Ade',
        start: '2026-12-15T10:00:00Z',
        end: '2026-12-15T10:30:00Z'
      },
      {
        id: 's_past',
        provider: 'Dr Ade',
        start: '2020-01-01T09:00:00Z',
        end: '2020-01-01T09:30:00Z'
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

  test('Reject request when X-API-Key is missing (401)', async () => {
    const res = await client.request('/slots', {
      omitApiKey: true
    });
    assert.equal(res.status, 401);
    assert.equal(res.data.error, 'Unauthorized');
  });

  test('Reject request when X-API-Key is invalid (401)', async () => {
    const res = await client.request('/slots', {
      headers: {
        'X-API-Key': 'completely-wrong-key'
      }
    });
    assert.equal(res.status, 401);
    assert.equal(res.data.error, 'Unauthorized');
  });

  test('Reject booking when slot_id is missing or empty (400)', async () => {
    const res = await client.request('/bookings', {
      method: 'POST',
      body: {
        name: 'John Doe',
        email: 'john@example.com'
      }
    });
    assert.equal(res.status, 400);
    assert(res.data.error);
  });

  test('Reject booking when name is missing or empty (400)', async () => {
    const res = await client.request('/bookings', {
      method: 'POST',
      body: {
        slot_id: 's_future',
        name: '   ',
        email: 'john@example.com'
      }
    });
    assert.equal(res.status, 400);
    assert(res.data.error);
  });

  test('Reject booking when email is missing or empty (400)', async () => {
    const res = await client.request('/bookings', {
      method: 'POST',
      body: {
        slot_id: 's_future',
        name: 'John Doe',
        email: ''
      }
    });
    assert.equal(res.status, 400);
    assert(res.data.error);
  });

  test('Reject booking when email format is invalid (400)', async () => {
    const res = await client.request('/bookings', {
      method: 'POST',
      body: {
        slot_id: 's_future',
        name: 'John Doe',
        email: 'not-an-email-address'
      }
    });
    assert.equal(res.status, 400);
    assert(res.data.error);
  });

  test('Reject booking when slot does not exist (404)', async () => {
    const res = await client.request('/bookings', {
      method: 'POST',
      body: {
        slot_id: 'non-existent-slot-999',
        name: 'John Doe',
        email: 'john@example.com'
      }
    });
    assert.equal(res.status, 404);
    assert.equal(res.data.error, 'slot not found');
  });

  test('Reject booking when slot has already started (400)', async () => {
    const res = await client.request('/bookings', {
      method: 'POST',
      body: {
        slot_id: 's_past',
        name: 'John Doe',
        email: 'john@example.com'
      }
    });
    assert.equal(res.status, 400);
    assert.equal(res.data.error, 'slot has already started');
  });

  test('Trim name & email and lowercase email upon saving', async () => {
    const res = await client.request('/bookings', {
      method: 'POST',
      body: {
        slot_id: 's_future',
        name: '   Jane Doe   ',
        email: '  Jane.Doe@EXAMPLE.COM  '
      }
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.name, 'Jane Doe');
    assert.equal(res.data.email, 'jane.doe@example.com');
  });
});
