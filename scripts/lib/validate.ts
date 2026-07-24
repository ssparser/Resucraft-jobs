import { NormalizedJob } from './types.js';

export interface ValidationFilterResult {
  validJobs: NormalizedJob[];
  expiredRemoved: number;
  incompleteRemoved: number;
  invalidRemoved: number;
  djinniRemoved: number;
  nonTechRemoved: number;
  nonEnglishRemoved: number;
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

export function isDjinniJob(job: NormalizedJob): boolean {
  const fields = [
    job.applyUrl,
    job.companyUrl || '',
    job.sourceJobId,
    job.slug,
    job.source,
  ];
  return fields.some((field) => field.toLowerCase().includes('djinni'));
}

const NON_TECH_TITLE_PATTERNS = [
  /\bplanning\b/i,
  /\blogistics\b/i,
  /\bsupply chain\b/i,
  /\bapprovisionnement\b/i,
  /\bmatières premières\b/i,
  /\bhuman resources\b/i,
  /\bhr specialist\b/i,
  /\brecruiter\b/i,
  /\btalent acquisition\b/i,
  /\baccountant\b/i,
  /\baccounting\b/i,
  /\blegal counsel\b/i,
  /\bparalegal\b/i,
  /\breceptionist\b/i,
  /\badministrative assistant\b/i,
  /\bwarehouse\b/i,
  /\bmedical specialist\b/i,
  /\bnursing\b/i,
  /\bnurse\b/i,
  /\bphysician\b/i,
  /\bcook\b/i,
  /\bchef\b/i,
  /\bdriver\b/i,
  /\bcleaner\b/i,
  /\bjanitor\b/i,
  /\bsales associate\b/i,
  /\bretail\b/i,
  /\bstore manager\b/i,
];

const TECH_KEYWORDS_PATTERNS = [
  /\bsoftware\b/i,
  /\bdeveloper\b/i,
  /\bengineer\b/i,
  /\bprogrammer\b/i,
  /\bcoder\b/i,
  /\bfrontend\b/i,
  /\bfront-end\b/i,
  /\bbackend\b/i,
  /\bback-end\b/i,
  /\bfullstack\b/i,
  /\bfull-stack\b/i,
  /\bai\b/i,
  /\bml\b/i,
  /\bmachine learning\b/i,
  /\bdata\b/i,
  /\bdevops\b/i,
  /\bsre\b/i,
  /\bsysadmin\b/i,
  /\bsystem\b/i,
  /\bqa\b/i,
  /\btesting\b/i,
  /\btest\b/i,
  /\bsecurity\b/i,
  /\bcyber\b/i,
  /\bweb\b/i,
  /\bmobile\b/i,
  /\bios\b/i,
  /\bandroid\b/i,
  /\bembedded\b/i,
  /\bfirmware\b/i,
  /\bplatform\b/i,
  /\binfrastructure\b/i,
  /\barchitect\b/i,
  /\btech\b/i,
  /\btechnical\b/i,
  /\bscrum\b/i,
  /\bagile\b/i,
  /\bui\/ux\b/i,
  /\bux\b/i,
  /\bui\b/i,
  /\bdatabase\b/i,
  /\bdba\b/i,
  /\bcloud\b/i,
  /\bnetwork\b/i,
  /\bit\b/i,
  /\bproduct manager\b/i,
  /\bsite reliability\b/i,
  /\banalytics\b/i,
  /\balgorithm\b/i,
];

export function isTechJob(job: NormalizedJob): boolean {
  if (job.tags.includes('non_tech') || job.tags.includes('non-tech')) {
    return false;
  }

  if (NON_TECH_TITLE_PATTERNS.some((pattern) => pattern.test(job.title))) {
    return false;
  }

  if (job.tags.includes('tech')) return true;
  return TECH_KEYWORDS_PATTERNS.some((pattern) => pattern.test(job.title));
}

const NON_ENGLISH_SCRIPT_REGEX = /[\u0400-\u04FF\u4E00-\u9FFF\u0600-\u06FF\u0590-\u05FF\u0E00-\u0E7F\u0900-\u097F\u3040-\u30FF]/;

const NON_ENGLISH_TITLE_PATTERNS = [
  /\b(développeur|ingénieur|coordinateur|coordinatrice|responsable|stage|alternance|approvisionnement|matières premières)\b/i,
  /\b(entwickler|stellenausschreibung|ingenieur)\b/i,
  /\b(desarrollador|programador|vacante|oferta|coordinador)\b/i,
  /\b(разработчик|программист|инженер)\b/i,
];

const ENGLISH_STOPWORDS = new Set([
  'the', 'and', 'to', 'of', 'in', 'is', 'you', 'that', 'it', 'for', 'on', 'are', 'with', 'as', 'at', 'be', 'this', 'have', 'from', 'or', 'by', 'an', 'work', 'team', 'experience', 'will', 'our', 'we', 'about', 'role'
]);

const NON_ENGLISH_STOPWORDS = new Set([
  'et', 'les', 'pour', 'dans', 'des', 'est', 'une', 'qui', 'sur', 'avec', 'par', 'nous',
  'und', 'der', 'die', 'das', 'mit', 'für', 'ist', 'von', 'auf', 'aus', 'den',
  'para', 'con', 'por', 'como', 'del', 'los', 'las', 'una', 'uno', 'más',
]);

export function isEnglishJob(job: NormalizedJob): boolean {
  if (NON_ENGLISH_SCRIPT_REGEX.test(job.title) || NON_ENGLISH_SCRIPT_REGEX.test(job.description)) {
    return false;
  }

  if (NON_ENGLISH_TITLE_PATTERNS.some((pattern) => pattern.test(job.title))) {
    return false;
  }

  const cleanDesc = job.description.replace(/<[^>]*>/g, ' ').toLowerCase();
  const words = cleanDesc.split(/\W+/).filter((w) => w.length > 1);

  if (words.length > 20) {
    let engCount = 0;
    let nonEngCount = 0;

    for (const w of words) {
      if (ENGLISH_STOPWORDS.has(w)) engCount++;
      if (NON_ENGLISH_STOPWORDS.has(w)) nonEngCount++;
    }

    if (nonEngCount > engCount) return false;
    if (engCount < 2) return false;
  }

  return true;
}

export function validateAndFilterJobs(jobs: NormalizedJob[]): ValidationFilterResult {
  const now = new Date();
  const validJobs: NormalizedJob[] = [];

  let expiredRemoved = 0;
  let incompleteRemoved = 0;
  let invalidRemoved = 0;
  let djinniRemoved = 0;
  let nonTechRemoved = 0;
  let nonEnglishRemoved = 0;

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

    if (isDjinniJob(job)) {
      djinniRemoved++;
      continue;
    }

    if (!isTechJob(job)) {
      nonTechRemoved++;
      continue;
    }

    if (!isEnglishJob(job)) {
      nonEnglishRemoved++;
      continue;
    }

    validJobs.push(job);
  }

  return {
    validJobs,
    expiredRemoved,
    incompleteRemoved,
    invalidRemoved,
    djinniRemoved,
    nonTechRemoved,
    nonEnglishRemoved,
  };
}
