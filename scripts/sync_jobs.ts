import path from 'node:path';
import fs from 'node:fs';
import { registry } from './lib/providers/index.js';
import { NormalizedJob, PipelineStats } from './lib/types.js';
import { runFilterPipeline } from './lib/filter.js';
import { generateDatasets } from './lib/dataset.js';
import { logger } from './lib/logger.js';

async function main() {
  logger.info('====================================================');
  logger.info('Starting ResuCraft Jobs Synchronization Engine');
  logger.info('====================================================');

  const jobsOutputDir = path.join(process.cwd(), 'jobs');
  const providers = registry.getProviders();

  if (providers.length === 0) {
    logger.error('No job providers registered! Exiting synchronization.');
    process.exit(1);
  }

  logger.info(`Registered providers (${providers.length}): ${providers.map((p) => p.name).join(', ')}`);

  const providerStatsMap: Record<string, PipelineStats> = {};
  const allNormalizedJobs: NormalizedJob[] = [];

  // Execute providers concurrently while isolating failures
  const providerPromises = providers.map(async (provider) => {
    logger.info(`Starting provider '${provider.name}'...`);
    let totalFetched = 0;
    const providerNormalizedJobs: NormalizedJob[] = [];

    try {
      for await (const rawPage of provider.fetchJobs()) {
        totalFetched += rawPage.length;
        for (const rawJob of rawPage) {
          try {
            const normalized = provider.normalizeJob(rawJob);
            providerNormalizedJobs.push(normalized);
          } catch (normErr: any) {
            logger.warn(`[${provider.name}] Error normalizing job: ${normErr.message}`);
          }
        }
      }

      logger.info(`[${provider.name}] Completed fetch: ${totalFetched} raw jobs fetched, ${providerNormalizedJobs.length} normalized.`);

      // Run filtering for this provider's jobs
      const { processedJobs, stats: filterStats } = runFilterPipeline(providerNormalizedJobs);

      providerStatsMap[provider.name] = {
        providerName: provider.name,
        totalFetched,
        ...filterStats,
      };

      return processedJobs;
    } catch (error: any) {
      logger.error(`[${provider.name}] Provider failed during execution: ${error.message || error}`);
      providerStatsMap[provider.name] = {
        providerName: provider.name,
        totalFetched,
        totalNormalized: providerNormalizedJobs.length,
        duplicatesRemoved: 0,
        expiredRemoved: 0,
        incompleteRemoved: 0,
        invalidRemoved: 0,
        totalValid: 0,
      };
      return [];
    }
  });

  const results = await Promise.allSettled(providerPromises);

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allNormalizedJobs.push(...result.value);
    }
  }

  // Cross-provider deduplication if multiple providers returned data
  let finalJobs = allNormalizedJobs;
  if (providers.length > 1) {
    logger.info('Performing cross-provider filtering and deduplication...');
    const { processedJobs } = runFilterPipeline(allNormalizedJobs);
    finalJobs = processedJobs;
  }

  logger.info(`Total valid jobs across all providers: ${finalJobs.length}`);

  if (finalJobs.length === 0) {
    logger.error('CRITICAL: Synchronization produced 0 valid jobs.');
    // Check if we have existing datasets to preserve
    const existingDataset = path.join(jobsOutputDir, 'latest.json');
    if (fs.existsSync(existingDataset)) {
      logger.error('Preserving existing dataset in jobs/ and aborting write.');
    }
    process.exit(1);
  }

  // Generate deterministic output datasets
  try {
    const metadata = generateDatasets(finalJobs, {
      outputDir: jobsOutputDir,
      schemaVersion: '1.0.0',
      providerStats: providerStatsMap,
    });

    logger.info('====================================================');
    logger.info(`SUCCESS: Job synchronization completed.`);
    logger.info(`Dataset: ${metadata.datasetFilename}`);
    logger.info(`Total Jobs: ${metadata.totalJobs}`);
    logger.info(`SHA256 Hash: ${metadata.datasetHash}`);
    logger.info(`Version: ${metadata.overallVersion}`);
    logger.info('====================================================');
  } catch (err: any) {
    logger.error(`Failed to write dataset output: ${err.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error(`Unhandled exception in sync engine: ${err.stack || err}`);
  process.exit(1);
});
