import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from './testHelper.js';

describe('Level 5 — Rate Limiting', () => {
  let client;

  before(async () => {
    client = await createTestServer();

    // Prepare 10 slots
    const slots = [];
    for (let i = 1; i <= 10; i++) {
      slots.push({
        id: `s_rate_${i}`,
        provider: 'Dr Ade',
        start: `2026-12-28T${String(8 + i).padStart(2, '0')}:00:00Z`,
        end: `2026-12-28T${String(8 + i).padStart(2, '0')}:30:00Z`
      });
    }

    await client.request('/reset', {
      method: 'POST',
      body: { slots }
    });
  });

  after(async () => {
    await client.close();
  });

  test('At most 5 attempts per email per minute; 6th returns 429 with Retry-After header', async () => {
    const spamEmail = 'rate.test@example.com';

    // 5 attempts (both valid or invalid attempts count)
    for (let i = 1; i <= 5; i++) {
      const res = await client.request('/bookings', {
        method: 'POST',
        body: {
          slot_id: `s_rate_${i}`,
          name: 'Rate Tester',
          email: spamEmail
        }
      });
      // First 5 attempts should not be rate limited
      assert.notEqual(res.status, 429, `Attempt ${i} should not be rate limited`);
    }

    // 6th attempt should be blocked with 429
    const blockedRes = await client.request('/bookings', {
      method: 'POST',
      body: {
        slot_id: 's_rate_6',
        name: 'Rate Tester',
        email: spamEmail
      }
    });

    assert.equal(blockedRes.status, 429);
    assert.equal(blockedRes.data.error, 'Too many attempts for this email');

    const retryAfter = blockedRes.headers.get('retry-after');
    assert(retryAfter, 'Expected Retry-After header to be present');
    const retrySeconds = parseInt(retryAfter, 10);
    assert(retrySeconds > 0 && retrySeconds <= 60, `Expected whole seconds between 1 and 60, got ${retrySeconds}`);
  });

  test('Other emails are not affected by rate limit', async () => {
    const cleanEmail = 'other.clean@example.com';

    const res = await client.request('/bookings', {
      method: 'POST',
      body: {
        slot_id: 's_rate_6',
        name: 'Clean User',
        email: cleanEmail
      }
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.email, cleanEmail);
  });
});
