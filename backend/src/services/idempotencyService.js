import storageService from './storageService.js';
import { writeLock } from '../utils/asyncLock.js';

class IdempotencyService {
  async getRecord(key) {
    if (!key) return null;
    const records = await storageService.getIdempotencyRecords();
    return records[key] || null;
  }

  async saveRecord(key, body, statusCode, response) {
    if (!key) return;
    const records = await storageService.getIdempotencyRecords();
    records[key] = {
      body,
      statusCode,
      response,
      createdAt: new Date().toISOString()
    };
    await storageService.saveIdempotencyRecords(records);
  }

  isSameBody(storedBody, incomingBody) {
    if (!storedBody || !incomingBody) return false;
    return (
      storedBody.slot_id === incomingBody.slot_id &&
      storedBody.name === incomingBody.name &&
      storedBody.email === incomingBody.email
    );
  }
}

export const idempotencyService = new IdempotencyService();
export default idempotencyService;
