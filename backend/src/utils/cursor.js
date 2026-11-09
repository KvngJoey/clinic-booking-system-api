/**
 * Helpers for opaque cursor pagination.
 */
export function encodeCursor(offset) {
  if (offset === null || offset === undefined) return null;
  return Buffer.from(JSON.stringify({ offset })).toString('base64url');
}

export function decodeCursor(cursorString) {
  if (!cursorString) return 0;
  try {
    const json = Buffer.from(cursorString, 'base64url').toString('utf8');
    const parsed = JSON.parse(json);
    if (typeof parsed.offset === 'number' && parsed.offset >= 0) {
      return parsed.offset;
    }
    return 0;
  } catch {
    return 0;
  }
}

