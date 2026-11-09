import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Ensure directory exists.
 */
export async function ensureDirectoryExists(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

/**
 * Reads a JSON file. If it doesn't exist, creates it with defaultValue.
 */
export async function readJsonFile(filePath, defaultValue = []) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    if (!data.trim()) {
      return defaultValue;
    }
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      await writeJsonFile(filePath, defaultValue);
      return defaultValue;
    }
    throw err;
  }
}

/**
 * Atomically writes a JSON file by writing to a temporary file
 * and renaming it over the target file.
 */
export async function writeJsonFile(filePath, data) {
  const dir = path.dirname(filePath);
  await ensureDirectoryExists(dir);

  const tempFilePath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2)}.tmp`;
  const serialized = JSON.stringify(data, null, 2);

  // Write temp file
  await fs.writeFile(tempFilePath, serialized, 'utf8');

  // Rename atomically with retries for Windows file lock tolerance
  const maxRetries = 5;
  let attempt = 0;
  while (true) {
    try {
      await fs.rename(tempFilePath, filePath);
      break;
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) {
        // Clean up temp file on failure
        try { await fs.unlink(tempFilePath); } catch (_) {}
        throw err;
      }
      await new Promise(r => setTimeout(r, 15 * attempt));
    }
  }
}
