import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory or root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
const defaultDataDir = isVercel ? '/tmp' : path.resolve(__dirname, '../data');

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiKey: process.env.API_KEY || 'koya_clinic_secret_key_2026',
  dataDir: process.env.DATA_DIR
    ? path.isAbsolute(process.env.DATA_DIR)
      ? process.env.DATA_DIR
      : path.resolve(__dirname, '../../', process.env.DATA_DIR)
    : defaultDataDir
};

export default config;

