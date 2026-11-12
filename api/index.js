import app from '../backend/src/app.js';
import storageService from '../backend/src/services/storageService.js';

let isInitialized = false;

export default async function handler(req, res) {
  if (!isInitialized) {
    try {
      await storageService.initStorage();
      isInitialized = true;
    } catch (err) {
      console.error('Failed to initialize storage on cold start:', err);
    }
  }
  return app(req, res);
}
