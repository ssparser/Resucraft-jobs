export interface NormalizedJob {
  id: string;
  source: string;
  sourceJobId: string;
  slug: string;
  title: string;
  company: string;
  location: string | null;
  country: string | null;
  remote: boolean;
  visaSponsored: boolean;
  employmentType: string | null;
  salary: string | null;
  description: string;
  applyUrl: string;
  companyUrl: string | null;
  postedAt: string | null;
  expiresAt: string | null;
  skills: string[];
  tags: string[];
}

export interface JobProvider {
  /**
   * Unique name of the job provider (e.g., 'freehire', 'greenhouse', etc.)
   */
  readonly name: string;

  /**
   * Fetches all available jobs from the provider and returns un-normalized raw records.
   */
  fetchJobs(): AsyncGenerator<unknown[], void, unknown>;

  /**
   * Normalizes a raw job object into the standard NormalizedJob internal schema.
   */
  normalizeJob(rawJob: unknown): NormalizedJob;
}

export interface PipelineStats {
  providerName: string;
  totalFetched: number;
  totalNormalized: number;
  duplicatesRemoved: number;
  expiredRemoved: number;
  incompleteRemoved: number;
  invalidRemoved: number;
  totalValid: number;
}

export interface DatasetMetadata {
  schemaVersion: string;
  generatedAt: string;
  totalJobs: number;
  providerStats: Record<string, PipelineStats>;
  datasetFilename: string;
  datasetHash: string;
  datasetSizeBytes: number;
  overallVersion: string;
}
