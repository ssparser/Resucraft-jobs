import { NormalizedJob, PipelineStats } from './types.js';
import { deduplicateJobs } from './deduplicate.js';
import { validateAndFilterJobs } from './validate.js';
import { logger } from './logger.js';

export interface FilterPipelineResult {
  processedJobs: NormalizedJob[];
  stats: Omit<PipelineStats, 'providerName' | 'totalFetched'>;
}

export function runFilterPipeline(jobs: NormalizedJob[]): FilterPipelineResult {
  const totalNormalized = jobs.length;

  // 1. Deduplication
  const { uniqueJobs, duplicatesRemoved } = deduplicateJobs(jobs);

  // 2. Validation & Filtering (Expired, Incomplete, Invalid)
  const { validJobs, expiredRemoved, incompleteRemoved, invalidRemoved } = validateAndFilterJobs(uniqueJobs);

  logger.info(
    `Filter Pipeline Summary: ` +
    `Input=${totalNormalized}, Duplicates=${duplicatesRemoved}, ` +
    `Expired=${expiredRemoved}, Incomplete=${incompleteRemoved}, Invalid=${invalidRemoved}, ` +
    `Final Output=${validJobs.length}`
  );

  return {
    processedJobs: validJobs,
    stats: {
      totalNormalized,
      duplicatesRemoved,
      expiredRemoved,
      incompleteRemoved,
      invalidRemoved,
      totalValid: validJobs.length,
    },
  };
}
