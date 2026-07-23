import fs from 'node:fs';
import path from 'node:path';
import { NormalizedJob, DatasetMetadata, PipelineStats } from './types.js';
import { sha256 } from './hash.js';
import { logger } from './logger.js';

export interface WriteDatasetOptions {
  outputDir: string;
  schemaVersion?: string;
  providerStats: Record<string, PipelineStats>;
}

/**
 * Sorts jobs deterministically by ID ascending to minimize git diffs.
 */
export function sortJobsDeterministically(jobs: NormalizedJob[]): NormalizedJob[] {
  return [...jobs].sort((a, b) => {
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
}

/**
 * Writes data safely by writing to a temporary file first, validating JSON parseability,
 * and atomically replacing the target file.
 */
export function atomicWriteJson(targetPath: string, data: unknown): { hash: string; sizeBytes: number } {
  const content = JSON.stringify(data, null, 2);

  // Validate JSON serialization
  try {
    JSON.parse(content);
  } catch (err: any) {
    throw new Error(`Failed JSON validation before writing ${targetPath}: ${err.message}`);
  }

  const hash = sha256(content);
  const sizeBytes = Buffer.byteLength(content, 'utf8');

  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tempPath = `${targetPath}.${Date.now()}.${Math.random().toString(36).substring(2, 8)}.tmp`;

  fs.writeFileSync(tempPath, content, 'utf-8');
  fs.renameSync(tempPath, targetPath);

  return { hash, sizeBytes };
}

export function generateDatasets(jobs: NormalizedJob[], options: WriteDatasetOptions): DatasetMetadata {
  const sortedJobs = sortJobsDeterministically(jobs);

  const jobsFilePath = path.join(options.outputDir, 'latest.json');
  const metadataFilePath = path.join(options.outputDir, 'metadata.json');

  logger.info(`Writing ${sortedJobs.length} jobs to ${jobsFilePath}...`);
  const { hash: datasetHash, sizeBytes: datasetSizeBytes } = atomicWriteJson(jobsFilePath, sortedJobs);

  const generatedAt = new Date().toISOString();
  const overallVersion = sha256(`${datasetHash}:${generatedAt}:${sortedJobs.length}`);

  const metadata: DatasetMetadata = {
    schemaVersion: options.schemaVersion || '1.0.0',
    generatedAt,
    totalJobs: sortedJobs.length,
    providerStats: options.providerStats,
    datasetFilename: 'latest.json',
    datasetHash,
    datasetSizeBytes,
    overallVersion,
  };

  logger.info(`Writing metadata to ${metadataFilePath}...`);
  atomicWriteJson(metadataFilePath, metadata);

  return metadata;
}
