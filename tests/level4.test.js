import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from './testHelper.js';

describe('Level 4 — Idempotency and Pagination', () => {
  let client;
  const targetEmail = 'pagination.user@example.com';

  before(async () => {
    client = await createTestServer();

    // Prepare 8 future slots for testing pagination and idempotency
    const slots = [];
    for (let i = 1; i <= 8; i++) {
      slots.push({
        id: `s_page_${i}`,
        provider: 'Dr Ade',
        start: `2026-12-25T${String(8 + i).padStart(2, '0')}:00:00Z`,
        end: `2026-12-25T${String(8 + i).padStart(2, '0')}:30:00Z`
      });
    }

    await client.request('/reset', {
      method: 'POST',
      body: { slots }
    });

    // Pre-book slots for pagination testing
    await client.request('/bookings', {
      method: 'POST',
      body: { slot_id: 's_page_4', name: 'Page User', email: targetEmail }
    });
    await client.request('/bookings', {
      method: 'POST',
      body: { slot_id: 's_page_5', name: 'Page User', email: targetEmail }
    });
    await client.request('/bookings', {
      method: 'POST',
      body: { slot_id: 's_page_6', name: 'Page User', email: targetEmail }
    });
  });

  after(async () => {
    await client.close();
  });

  test('Successful booking with Idempotency-Key returns 201', async () => {
    const res = await client.request('/bookings', {
      method: 'POST',
      headers: {
        'Idempotency-Key': 'key-unique-123'
      },
      body: {
        slot_id: 's_page_1',
        name: 'Idempotent Patient',
        email: 'idempotent@example.com'
      }
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.slot_id, 's_page_1');
  });

  test('Retrying with identical Idempotency-Key returns original response and does not duplicate', async () => {
    const originalRes = await client.request('/bookings', {
      method: 'POST',
      headers: {
        'Idempotency-Key': 'key-unique-retry'
      },
      body: {
        slot_id: 's_page_2',
        name: 'Retry Patient',
        email: 'retry@example.com'
      }
    });
    assert.equal(originalRes.status, 201);
    const originalId = originalRes.data.id;

    // Retry exact request
    const retryRes = await client.request('/bookings', {
      method: 'POST',
      headers: {
        'Idempotency-Key': 'key-unique-retry'
      },
      body: {
        slot_id: 's_page_2',
        name: 'Retry Patient',
        email: 'retry@example.com'
      }
    });

    assert.equal(retryRes.status, 201);
    assert.equal(retryRes.data.id, originalId);
    assert.equal(retryRes.data.slot_id, 's_page_2');

    // Verify only 1 booking was created for retry@example.com
    const listRes = await client.request('/bookings?email=retry@example.com');
    assert.equal(listRes.data.bookings.length, 1);
  });

  test('Reusing Idempotency-Key with different body returns 422', async () => {
    // Create first booking with key
    await client.request('/bookings', {
      method: 'POST',
      headers: {
        'Idempotency-Key': 'key-reused'
      },
      body: {
        slot_id: 's_page_3',
        name: 'Original Person',
        email: 'original@example.com'
      }
    });

    // Send same key with different slot_id or name
    const conflictRes = await client.request('/bookings', {
      method: 'POST',
      headers: {
        'Idempotency-Key': 'key-reused'
      },
      body: {
        slot_id: 's_page_7',
        name: 'Different Person',
        email: 'different@example.com'
      }
    });

    assert.equal(conflictRes.status, 422);
    assert.equal(conflictRes.data.error, 'Idempotency-Key reused with a different body');
  });

  test('Reject when email query param is missing (400)', async () => {
    const res = await client.request('/bookings');
    assert.equal(res.status, 400);
    assert(res.data.error);
  });

  test('Reject invalid limit (0 or >50 or not integer) with 400', async () => {
    const res0 = await client.request(`/bookings?email=${targetEmail}&limit=0`);
    assert.equal(res0.status, 400);

    const res51 = await client.request(`/bookings?email=${targetEmail}&limit=51`);
    assert.equal(res51.status, 400);

    const resStr = await client.request(`/bookings?email=${targetEmail}&limit=abc`);
    assert.equal(resStr.status, 400);
  });

  test('Email match ignores case', async () => {
    const res = await client.request(`/bookings?email=PAGINATION.USER@EXAMPLE.COM`);
    assert.equal(res.status, 200);
    assert.equal(res.data.bookings.length, 3);
  });

  test('Cursor pagination returns correct pages and next_cursor: null on last page', async () => {
    // Page 1: limit 2
    const page1Res = await client.request(`/bookings?email=${targetEmail}&limit=2`);
    assert.equal(page1Res.status, 200);
    assert.equal(page1Res.data.bookings.length, 2);
    assert(page1Res.data.next_cursor, 'next_cursor should not be null on page 1');

    // Page 2: with cursor from page 1
    const page2Res = await client.request(`/bookings?email=${targetEmail}&limit=2&cursor=${encodeURIComponent(page1Res.data.next_cursor)}`);
    assert.equal(page2Res.status, 200);
    assert.equal(page2Res.data.bookings.length, 1);
    assert.equal(page2Res.data.next_cursor, null, 'Last page must have next_cursor: null');

    // Oldest first verification: page 1 booking 0 created before booking 1
    const t0 = new Date(page1Res.data.bookings[0].created_at).getTime();
    const t1 = new Date(page1Res.data.bookings[1].created_at).getTime();
    const t2 = new Date(page2Res.data.bookings[0].created_at).getTime();
    assert(t0 <= t1 && t1 <= t2, 'Bookings must be ordered oldest first');
  });
});
