import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import app from '../backend/src/app.js';
import config from '../backend/src/config/index.js';
import storageService from '../backend/src/services/storageService.js';
import emailRateLimiter from '../backend/src/middleware/rateLimitMiddleware.js';

export async function createTestServer(options = {}) {
  // Create isolated temp dir for this test server to prevent cross-test collisions
  const tempDir = options.tempDir || await fs.mkdtemp(path.join(os.tmpdir(), 'clinic-test-'));
  await storageService.setCustomDataDir(tempDir);
  emailRateLimiter.reset();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://localhost:${port}`;

  return {
    server,
    baseUrl,
    tempDir,
    apiKey: config.apiKey,
    async close(preserveTempDir = false) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise((resolve) => server.close(resolve));
      if (!preserveTempDir) {
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch (_) {}
      }
    },
    async request(urlPath, reqOptions = {}) {
      const url = `${baseUrl}${urlPath}`;
      const headers = {
        Connection: 'close',
        ...reqOptions.headers
      };

      // Default X-API-Key unless explicitly omitted
      if (!('X-API-Key' in headers) && !reqOptions.omitApiKey) {
        headers['X-API-Key'] = config.apiKey;
      }
      if (reqOptions.body && typeof reqOptions.body === 'object') {
        headers['Content-Type'] = 'application/json';
        reqOptions.body = JSON.stringify(reqOptions.body);
      }

      const res = await fetch(url, { ...reqOptions, headers });
      let data = null;
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      return {
        status: res.status,
        headers: res.headers,
        data
      };
    }
  };
}
