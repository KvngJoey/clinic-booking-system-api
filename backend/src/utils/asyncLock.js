/**
 * Async Mutex for serializing asynchronous critical sections.
 * Guarantees that concurrent requests execute atomic read-modify-write
 * sequences without race conditions.
 */
class AsyncLock {
  constructor() {
    this._queue = [];
    this._isLocked = false;
  }

  async acquire() {
    return new Promise((resolve) => {
      if (!this._isLocked) {
        this._isLocked = true;
        resolve();
      } else {
        this._queue.push(resolve);
      }
    });
  }

  release() {
    if (this._queue.length > 0) {
      const nextResolve = this._queue.shift();
      nextResolve();
    } else {
      this._isLocked = false;
    }
  }

  async runExclusive(fn) {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

export const writeLock = new AsyncLock();
export default AsyncLock;

