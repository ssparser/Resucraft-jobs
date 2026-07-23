import { NormalizedJob } from './types.js';
import { logger } from './logger.js';

export interface DeduplicateResult {
  uniqueJobs: NormalizedJob[];
  duplicatesRemoved: number;
}

/**
 * Removes duplicate jobs from a collection.
 * Deduplicates by unique job ID and applyUrl.
 */
export function deduplicateJobs(jobs: NormalizedJob[]): DeduplicateResult {
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const uniqueJobs: NormalizedJob[] = [];

  let duplicatesRemoved = 0;

  for (const job of jobs) {
    if (seenIds.has(job.id)) {
      duplicatesRemoved++;
      continue;
    }

    const normalizedUrl = job.applyUrl.trim().toLowerCase();
    if (normalizedUrl && seenUrls.has(normalizedUrl)) {
      duplicatesRemoved++;
      continue;
    }

    seenIds.add(job.id);
    if (normalizedUrl) {
      seenUrls.add(normalizedUrl);
    }
    uniqueJobs.push(job);
  }

  logger.debug(`Deduplication: ${duplicatesRemoved} duplicate jobs removed from ${jobs.length} total.`);

  return {
    uniqueJobs,
    duplicatesRemoved,
  };
}
