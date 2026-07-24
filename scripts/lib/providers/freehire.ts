import { JobProvider, NormalizedJob } from "../types.js";
import { generateDeterministicId } from "../hash.js";
import { withRetry } from "../retry.js";
import { logger } from "../logger.js";

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
  public readonly name = "freehire";

  private baseUrl: string;
  private pageSize: number;
  private maxPages: number;
  private maxJobs: number;
  private roles: string[] = [
    "Software Engineer",
    "Software Developer",
    "Full Stack Engineer",
    "Backend Engineer",
    "Frontend Engineer",
    "AI Engineer",
    "Machine Learning Engineer",
    "API Engineer",
  ];

  constructor(options?: {
    baseUrl?: string;
    pageSize?: number;
    maxPages?: number;
    maxJobs?: number;
  }) {
    this.baseUrl =
      options?.baseUrl ||
      process.env.FREEHIRE_BASE_URL ||
      "https://freehire.dev/api/v1/jobs";
    this.pageSize =
      options?.pageSize ||
      parseInt(process.env.FREEHIRE_PAGE_SIZE || "100", 10);
    this.maxPages =
      options?.maxPages || parseInt(process.env.FREEHIRE_MAX_PAGES || "15", 10);
    this.maxJobs =
      options?.maxJobs || parseInt(process.env.FREEHIRE_MAX_JOBS || "1500", 10);
  }

  private matchesTargetRoles(job: FreeHireRawJob): boolean {
    if (job.is_tech === "tech") return true;
    if (!job.title) return false;
    const lowerTitle = job.title.toLowerCase();
    return this.roles.some((role) => lowerTitle.includes(role.toLowerCase()));
  }

  public async *fetchJobs(): AsyncGenerator<FreeHireRawJob[], void, unknown> {
    logger.info(
      `Starting FreeHire job fetch (pageSize=${this.pageSize}, maxJobs=${this.maxJobs}, maxPages=${this.maxPages})...`,
    );

    // All pages are dedicated to tech jobs (non-tech jobs fetching is disabled)
    const techPagesLimit = this.maxPages;

    let totalPagesFetched = 0;

    // --- Fetch Tech Jobs (isTechUrl) ---
    logger.info(`Fetching Tech jobs (limit pages: ${techPagesLimit})...`);
    let techOffset = 0;
    let techPagesFetched = 0;
    let hasMoreTech = true;

    while (
      hasMoreTech &&
      techPagesFetched < techPagesLimit &&
      totalPagesFetched < this.maxPages
    ) {
      const isTechUrl = `${this.baseUrl}?limit=${this.pageSize}&offset=${techOffset}&is_tech=tech`;

      const response = await withRetry(
        async () => {
          const res = await fetch(isTechUrl, {
            headers: {
              Accept: "application/json",
              "User-Agent": "ResuCraft-Jobs-Sync/1.0",
            },
          });

          if (!res.ok) {
            const error: any = new Error(
              `FreeHire API error HTTP ${res.status}: ${res.statusText}`,
            );
            error.status = res.status;
            error.headers = res.headers;
            throw error;
          }

          return (await res.json()) as FreeHireApiResponse;
        },
        {
          maxRetries: 4,
          initialDelayMs: 1000,
        },
        `FreeHire API GET is_tech=tech offset=${techOffset}`,
      );

      if (!response || !Array.isArray(response.data)) {
        logger.warn(
          `FreeHire API returned non-array data at tech offset=${techOffset}. Stopping tech fetch.`,
        );
        break;
      }

      const rawJobs = response.data;
      techPagesFetched++;
      totalPagesFetched++;

      // Yield fetched tech jobs directly
      logger.info(
        `FreeHire Tech page ${techPagesFetched}: fetched ${rawJobs.length} tech jobs (offset=${techOffset}).`,
      );

      if (rawJobs.length > 0) {
        yield rawJobs;
      }

      techOffset += rawJobs.length;

      if (
        rawJobs.length < this.pageSize ||
        (response.meta?.total && techOffset >= response.meta.total)
      ) {
        hasMoreTech = false;
      }
    }

    // Non-tech jobs fetching is explicitly disabled - only tech jobs in English are processed
    logger.info(
      `FreeHire fetch finished after ${techPagesFetched} tech pages (${techOffset} jobs fetched).`,
    );
  }

  public normalizeJob(raw: unknown): NormalizedJob {
    const job = raw as FreeHireRawJob;

    const sourceJobId =
      job.public_slug || job.external_id || String(Math.random());
    const id = generateDeterministicId(this.name, sourceJobId);

    const country =
      Array.isArray(job.countries) && job.countries.length > 0
        ? job.countries[0]
        : null;

    const isRemote = Boolean(
      (job.regions && job.regions.includes("remote")) ||
      (job.location && /remote/i.test(job.location)),
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

    let location = job.location ? job.location.trim() : null;
    if (!location) {
      const locParts: string[] = [];
      if (Array.isArray(job.cities) && job.cities.length > 0) {
        locParts.push(job.cities.join(", "));
      }
      if (Array.isArray(job.countries) && job.countries.length > 0) {
        locParts.push(job.countries.join(", "));
      }
      if (Array.isArray(job.regions) && job.regions.length > 0) {
        locParts.push(job.regions.join(", "));
      }
      if (locParts.length > 0) {
        location = locParts.join(", ");
      }
    }

    return {
      id,
      source: this.name,
      sourceJobId,
      slug: job.public_slug || sourceJobId,
      title: job.title ? job.title.trim() : "",
      company: job.company ? job.company.trim() : "",
      location,
      country,
      remote: isRemote,
      visaSponsored: false,
      employmentType: job.enrichment?.employment_type || null,
      salary: null,
      description: job.description || "",
      applyUrl: job.url || "",
      companyUrl: job.company_slug
        ? `https://freehire.dev/company/${job.company_slug}`
        : null,
      postedAt: job.posted_at || job.created_at || null,
      expiresAt: job.closed_at || null,
      skills: Array.isArray(job.skills)
        ? job.skills.map((s) => s.trim().toLowerCase())
        : [],
      tags: Array.from(tagsSet),
    };
  }
}
