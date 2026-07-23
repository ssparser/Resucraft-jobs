import { NormalizedJob } from './types.js';

export interface ValidationFilterResult {
  validJobs: NormalizedJob[];
  expiredRemoved: number;
  incompleteRemoved: number;
  invalidRemoved: number;
}

export function isJobExpired(job: NormalizedJob, now: Date = new Date()): boolean {
  if (!job.expiresAt) return false;
  const expiryDate = new Date(job.expiresAt);
  if (isNaN(expiryDate.getTime())) return false;
  return expiryDate <= now;
}

export function isJobIncomplete(job: NormalizedJob): boolean {
  if (!job.title || !job.title.trim()) return true;
  if (!job.company || !job.company.trim()) return true;
  if (!job.applyUrl || !job.applyUrl.trim()) return true;
  if (!job.description || !job.description.trim()) return true;
  return false;
}

export function isJobInvalid(job: NormalizedJob): boolean {
  // Validate applyUrl URL syntax
  try {
    const url = new URL(job.applyUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return true;
    }
  } catch {
    return true;
  }

  // Validate postedAt date format if provided
  if (job.postedAt) {
    const posted = new Date(job.postedAt);
    if (isNaN(posted.getTime())) return true;
  }

  return false;
}

export function validateAndFilterJobs(jobs: NormalizedJob[]): ValidationFilterResult {
  const now = new Date();
  const validJobs: NormalizedJob[] = [];

  let expiredRemoved = 0;
  let incompleteRemoved = 0;
  let invalidRemoved = 0;

  for (const job of jobs) {
    if (isJobExpired(job, now)) {
      expiredRemoved++;
      continue;
    }

    if (isJobIncomplete(job)) {
      incompleteRemoved++;
      continue;
    }

    if (isJobInvalid(job)) {
      invalidRemoved++;
      continue;
    }

    validJobs.push(job);
  }

  return {
    validJobs,
    expiredRemoved,
    incompleteRemoved,
    invalidRemoved,
  };
}
