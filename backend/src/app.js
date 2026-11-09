import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import resetRoutes from './routes/resetRoutes.js';
import slotsRoutes from './routes/slotsRoutes.js';
import bookingsRoutes from './routes/bookingsRoutes.js';
import clientProxyRoutes from './routes/clientProxyRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Cross-Origin Resource Sharing
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Health check endpoint for deployment monitoring
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Official Assessment API Endpoints (Level 1-5, requires X-API-Key)
app.use('/reset', resetRoutes);
app.use('/slots', slotsRoutes);
app.use('/bookings', bookingsRoutes);

// Safe Same-Origin Client API (used by frontend without exposing X-API-Key)
app.use('/client-api', clientProxyRoutes);

// Serve frontend static files
const frontendPath = path.resolve(__dirname, '../../frontend');
app.use(express.static(frontendPath));

// Centralized error handling
app.use(errorHandler);

export default app;
