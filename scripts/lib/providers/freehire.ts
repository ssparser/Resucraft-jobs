import { JobProvider, NormalizedJob } from '../types.js';
import { generateDeterministicId } from '../hash.js';
import { withRetry } from '../retry.js';
import { logger } from '../logger.js';

export interface FreeHireRawJob {
  public_slug: string;
  source?: string;
  external_id?: string;
  url: string;
  title: string;
  company: string;
  company_slug?: string;
  location?: string;
  description?: string;
  countries?: string[];
  regions?: string[];
  skills?: string[];
  cities?: string[];
  collections?: string[];
  is_tech?: string;
  posted_at?: string;
  created_at?: string;
  updated_at?: string;
  closed_at?: string | null;
  enrichment?: {
    employment_type?: string;
    category?: string;
    posting_language?: string;
  };
}

export interface FreeHireApiResponse {
  data: FreeHireRawJob[];
  meta: {
    limit: number;
    offset: number;
    total: number;
  };
}

export class FreeHireProvider implements JobProvider {
  public readonly name = 'freehire';

  private baseUrl: string;
  private pageSize: number;
  private maxPages: number;
  private maxJobs: number;

  constructor(options?: { baseUrl?: string; pageSize?: number; maxPages?: number; maxJobs?: number }) {
    this.baseUrl = options?.baseUrl || process.env.FREEHIRE_BASE_URL || 'https://freehire.dev/api/v1/jobs';
    this.pageSize = options?.pageSize || parseInt(process.env.FREEHIRE_PAGE_SIZE || '100', 10);
    this.maxPages = options?.maxPages || parseInt(process.env.FREEHIRE_MAX_PAGES || '5', 10);
    this.maxJobs = options?.maxJobs || parseInt(process.env.FREEHIRE_MAX_JOBS || '500', 10);
  }

  public async *fetchJobs(): AsyncGenerator<FreeHireRawJob[], void, unknown> {
    let offset = 0;
    let pagesFetched = 0;
    let hasMore = true;

    logger.info(`Starting FreeHire job fetch (pageSize=${this.pageSize}, maxJobs=${this.maxJobs}, maxPages=${this.maxPages})...`);

    while (hasMore && pagesFetched < this.maxPages && offset < this.maxJobs) {
      const url = `${this.baseUrl}?limit=${this.pageSize}&offset=${offset}`;

      const response = await withRetry(async () => {
        const res = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'ResuCraft-Jobs-Sync/1.0',
          },
        });

        if (!res.ok) {
          const error: any = new Error(`FreeHire API error HTTP ${res.status}: ${res.statusText}`);
          error.status = res.status;
          error.headers = res.headers;
          throw error;
        }

        return (await res.json()) as FreeHireApiResponse;
      }, {
        maxRetries: 4,
        initialDelayMs: 1000,
      }, `FreeHire API GET offset=${offset}`);

      if (!response || !Array.isArray(response.data)) {
        logger.warn(`FreeHire API returned non-array data at offset=${offset}. Stopping fetch.`);
        break;
      }

      const jobs = response.data;
      pagesFetched++;

      logger.info(`FreeHire page ${pagesFetched}: fetched ${jobs.length} jobs (offset=${offset}, totalAvailable=${response.meta?.total ?? 'unknown'}).`);

      yield jobs;

      offset += jobs.length;

      // Stop condition: fewer jobs returned than requested limit, or offset >= total
      if (jobs.length < this.pageSize) {
        hasMore = false;
      } else if (response.meta && response.meta.total && offset >= response.meta.total) {
        hasMore = false;
      }
    }

    logger.info(`FreeHire fetch finished after ${pagesFetched} pages.`);
  }

  public normalizeJob(raw: unknown): NormalizedJob {
    const job = raw as FreeHireRawJob;

    const sourceJobId = job.public_slug || job.external_id || String(Math.random());
    const id = generateDeterministicId(this.name, sourceJobId);

    const country = Array.isArray(job.countries) && job.countries.length > 0 ? job.countries[0] : null;

    const isRemote = Boolean(
      (job.regions && job.regions.includes('remote')) ||
      (job.location && /remote/i.test(job.location))
    );

    const tagsSet = new Set<string>();
    if (Array.isArray(job.collections)) {
      job.collections.forEach((c) => c && tagsSet.add(c.toLowerCase()));
    }
    if (job.is_tech) {
      tagsSet.add(job.is_tech.toLowerCase());
    }
    if (job.enrichment?.category) {
      tagsSet.add(job.enrichment.category.toLowerCase());
    }

    return {
      id,
      source: this.name,
      sourceJobId,
      slug: job.public_slug || sourceJobId,
      title: job.title ? job.title.trim() : '',
      company: job.company ? job.company.trim() : '',
      location: job.location ? job.location.trim() : null,
      country,
      remote: isRemote,
      visaSponsored: false,
      employmentType: job.enrichment?.employment_type || null,
      salary: null,
      description: job.description || '',
      applyUrl: job.url || '',
      companyUrl: job.company_slug ? `https://freehire.dev/company/${job.company_slug}` : null,
      postedAt: job.posted_at || job.created_at || null,
      expiresAt: job.closed_at || null,
      skills: Array.isArray(job.skills) ? job.skills.map((s) => s.trim().toLowerCase()) : [],
      tags: Array.from(tagsSet),
    };
  }
}
