import { createHash } from 'node:crypto';

/**
 * Calculates a SHA-256 hash of a string input and returns hexadecimal format.
 */
export function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Creates a deterministic 16-character hex ID for a job from provider source and source job ID.
 */
export function generateDeterministicId(source: string, sourceJobId: string): string {
  const compositeKey = `${source.trim().toLowerCase()}:${sourceJobId.trim()}`;
  return sha256(compositeKey).substring(0, 16);
}
