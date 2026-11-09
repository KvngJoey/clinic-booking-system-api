import path from 'node:path';
import config from '../config/index.js';
import { readJsonFile, writeJsonFile, ensureDirectoryExists } from '../utils/atomicFile.js';
import { writeLock } from '../utils/asyncLock.js';

class StorageService {
  constructor() {
    this.slotsPath = path.join(config.dataDir, 'slots.json');
    this.bookingsPath = path.join(config.dataDir, 'bookings.json');
    this.idempotencyPath = path.join(config.dataDir, 'idempotency.json');
    this.initialized = false;
  }

  initStoragePaths(dir = config.dataDir) {
    this.slotsPath = path.join(dir, 'slots.json');
    this.bookingsPath = path.join(dir, 'bookings.json');
    this.idempotencyPath = path.join(dir, 'idempotency.json');
    this.currentDir = dir;
    this.initialized = false;
  }

  async setCustomDataDir(dir) {
    this.initStoragePaths(dir);
    await this.initStorage();
  }

  async initStorage() {
    if (this.initialized) return;
    await ensureDirectoryExists(this.currentDir || config.dataDir);

    // Initialize files if they don't exist
    await readJsonFile(this.slotsPath, this.getDefaultSlots());
    await readJsonFile(this.bookingsPath, []);
    await readJsonFile(this.idempotencyPath, {});
    this.initialized = true;
  }

  getDefaultSlots() {
    // Standard initial seed slots
    return [
      {
        id: 's1',
        provider: 'Dr Ade',
        start: '2026-12-10T09:00:00Z',
        end: '2026-12-10T09:30:00Z'
      },
      {
        id: 's2',
        provider: 'Dr Ade',
        start: '2026-12-10T10:00:00Z',
        end: '2026-12-10T10:30:00Z'
      },
      {
        id: 's3',
        provider: 'Dr Chioma',
        start: '2026-12-10T11:00:00Z',
        end: '2026-12-10T11:30:00Z'
      },
      {
        id: 's4',
        provider: 'Dr Chioma',
        start: '2026-12-10T14:00:00Z',
        end: '2026-12-10T14:30:00Z'
      },
      {
        id: 's5',
        provider: 'Dr Ibrahim',
        start: '2026-12-11T09:00:00Z',
        end: '2026-12-11T09:30:00Z'
      }
    ];
  }

  async getSlots() {
    await this.initStorage();
    return await readJsonFile(this.slotsPath, []);
  }

  async saveSlots(slots) {
    await this.initStorage();
    await writeJsonFile(this.slotsPath, slots);
  }

  async getBookings() {
    await this.initStorage();
    return await readJsonFile(this.bookingsPath, []);
  }

  async saveBookings(bookings) {
    await this.initStorage();
    await writeJsonFile(this.bookingsPath, bookings);
  }

  async getIdempotencyRecords() {
    await this.initStorage();
    return await readJsonFile(this.idempotencyPath, {});
  }

  async saveIdempotencyRecords(records) {
    await this.initStorage();
    await writeJsonFile(this.idempotencyPath, records);
  }

  /**
   * Level 1 / Reset endpoint:
   * Atomically deletes every booking and replaces all slots with new slots.
   * Also clears idempotency cache.
   */
  async reset(newSlots) {
    await this.initStorage();
    return await writeLock.runExclusive(async () => {
      await writeJsonFile(this.slotsPath, newSlots);
      await writeJsonFile(this.bookingsPath, []);
      await writeJsonFile(this.idempotencyPath, {});
      return true;
    });
  }
}

export const storageService = new StorageService();
export default storageService;
