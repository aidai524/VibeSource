import {
  GITHUB_API_VERSION,
  type GitHubEvidenceErrorCode,
  type GitHubEvidenceFailure,
  type GitHubEvidenceResult,
  type GitHubEvidenceSuccess,
  type GitHubRateLimit,
  type GitHubRepositoryObservation,
} from "@/domain/github-evidence";
import { normalizeRepositoryUrl } from "@/domain/submission";

const GITHUB_API_ORIGIN = "https://api.github.com";
const RESPONSE_SIZE_LIMIT = 1_048_576;
const DEFAULT_TIMEOUT_MS = 8_000;

type FetchImplementation = typeof fetch;

export interface GitHubEvidenceAdapterDependencies {
  readonly fetchImpl?: FetchImplementation;
  readonly now?: () => Date;
  readonly timeoutMs?: number;
}

function nullableInteger(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function rateLimitFrom(headers: Headers): GitHubRateLimit {
  const resetSeconds = nullableInteger(headers.get("x-ratelimit-reset"));
  return {
    limit: nullableInteger(headers.get("x-ratelimit-limit")),
    remaining: nullableInteger(headers.get("x-ratelimit-remaining")),
    resetAt:
      resetSeconds === null
        ? null
        : new Date(resetSeconds * 1_000).toISOString(),
  };
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("GitHub response is not an object.");
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`GitHub response field ${key} is invalid.`);
  }
  return value;
}

function requireIsoDate(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key);
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`GitHub response field ${key} is not a date.`);
  }
  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new Error(`GitHub response field ${key} is invalid.`);
  }
  return value;
}

function requireCount(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`GitHub response field ${key} is invalid.`);
  }
  return value as number;
}

function repositoryId(record: Record<string, unknown>): string {
  const value = record.id;
  if (
    (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) ||
    (typeof value === "string" && /^\d+$/.test(value))
  ) {
    return String(value);
  }
  throw new Error("GitHub response field id is invalid.");
}

function nullableLicenseValue(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseRepository(
  value: unknown,
  expectedRepositoryUrl: string,
): GitHubRepositoryObservation {
  const record = requireRecord(value);
  const licenseValue = record.license;
  const license =
    licenseValue === null || licenseValue === undefined
      ? null
      : requireRecord(licenseValue);

  const htmlUrl = normalizeRepositoryUrl(requireString(record, "html_url"));
  const expectedFullName = new URL(expectedRepositoryUrl).pathname.slice(1);
  const fullName = requireString(record, "full_name");
  if (
    htmlUrl !== expectedRepositoryUrl ||
    fullName.toLowerCase() !== expectedFullName
  ) {
    throw new Error("GitHub response did not identify the requested repository.");
  }

  return {
    repositoryId: repositoryId(record),
    fullName,
    htmlUrl,
    visibility: requireString(record, "visibility"),
    isPrivate: requireBoolean(record, "private"),
    archived: requireBoolean(record, "archived"),
    isFork: requireBoolean(record, "fork"),
    defaultBranch: requireString(record, "default_branch"),
    pushedAt: requireIsoDate(record, "pushed_at"),
    stars: requireCount(record, "stargazers_count"),
    forks: requireCount(record, "forks_count"),
    openIssues: requireCount(record, "open_issues_count"),
    licenseDetection: license === null ? "not_detected" : "detected",
    licenseKey: license === null ? null : nullableLicenseValue(license, "key"),
    licenseName:
      license === null ? null : nullableLicenseValue(license, "name"),
    licenseSpdxId:
      license === null ? null : nullableLicenseValue(license, "spdx_id"),
    licenseUrl: license === null ? null : nullableLicenseValue(license, "url"),
  };
}

function failure(
  sourceUrl: string,
  observedAt: string,
  errorCode: GitHubEvidenceErrorCode,
  errorMessage: string,
  httpStatus: number | null,
  rateLimit: GitHubRateLimit,
): GitHubEvidenceFailure {
  return {
    outcome: "error",
    sourceUrl,
    apiVersion: GITHUB_API_VERSION,
    observedAt,
    httpStatus,
    rateLimit,
    repository: null,
    errorCode,
    errorMessage: errorMessage.slice(0, 500),
  };
}

async function readJson(response: Response): Promise<unknown> {
  const declaredLength = nullableInteger(response.headers.get("content-length"));
  if (declaredLength !== null && declaredLength > RESPONSE_SIZE_LIMIT) {
    throw new Error("GitHub response exceeded the accepted size.");
  }
  const text = await response.text();
  if (text.length > RESPONSE_SIZE_LIMIT) {
    throw new Error("GitHub response exceeded the accepted size.");
  }
  return JSON.parse(text) as unknown;
}

export class GitHubEvidenceAdapter {
  private readonly fetchImpl: FetchImplementation;
  private readonly now: () => Date;
  private readonly timeoutMs: number;

  constructor(dependencies: GitHubEvidenceAdapterDependencies = {}) {
    this.fetchImpl = dependencies.fetchImpl ?? fetch;
    this.now = dependencies.now ?? (() => new Date());
    this.timeoutMs = dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async observe(repositoryUrl: string): Promise<GitHubEvidenceResult> {
    const normalized = normalizeRepositoryUrl(repositoryUrl);
    const { pathname } = new URL(normalized);
    const sourceUrl = `${GITHUB_API_ORIGIN}/repos${pathname}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(sourceUrl, {
        method: "GET",
        headers: {
          accept: "application/vnd.github+json",
          "x-github-api-version": GITHUB_API_VERSION,
          "user-agent": "VibeSource-M2.2a-local-verifier",
        },
        signal: controller.signal,
        // Do not follow repository moves implicitly: a redirect would add a
        // second network exchange and could point outside the fixed API host.
        redirect: "manual",
      });
      const observedAt = this.now().toISOString();
      const rateLimit = rateLimitFrom(response.headers);

      if (!response.ok) {
        const rateLimited =
          response.status === 429 ||
          (response.status === 403 && rateLimit.remaining === 0);
        const code: GitHubEvidenceErrorCode = rateLimited
          ? "rate_limited"
          : response.status === 404
            ? "not_found"
            : "github_http_error";
        const message = rateLimited
          ? "GitHub API rate limit was reached. No repository snapshot was saved."
          : response.status === 404
            ? "GitHub did not expose a public repository at this path."
            : `GitHub API returned HTTP ${response.status}.`;
        return failure(
          sourceUrl,
          observedAt,
          code,
          message,
          response.status,
          rateLimit,
        );
      }

      try {
        const repository = parseRepository(await readJson(response), normalized);
        const result: GitHubEvidenceSuccess = {
          outcome: "success",
          sourceUrl,
          apiVersion: GITHUB_API_VERSION,
          observedAt,
          httpStatus: response.status,
          rateLimit,
          repository,
          errorCode: null,
          errorMessage: null,
        };
        return result;
      } catch (error) {
        const timedOutWhileReading =
          controller.signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError");
        if (timedOutWhileReading) {
          return failure(
            sourceUrl,
            this.now().toISOString(),
            "timeout",
            "GitHub request timed out before a complete response was received.",
            response.status,
            rateLimit,
          );
        }
        return failure(
          sourceUrl,
          observedAt,
          "invalid_response",
          "GitHub returned a response that did not match the expected public repository shape.",
          response.status,
          rateLimit,
        );
      }
    } catch (error) {
      const observedAt = this.now().toISOString();
      const timedOut =
        controller.signal.aborted ||
        (error instanceof DOMException && error.name === "AbortError");
      return failure(
        sourceUrl,
        observedAt,
        timedOut ? "timeout" : "network_error",
        timedOut
          ? "GitHub request timed out before a response was received."
          : "GitHub request failed before a response was received.",
        null,
        { limit: null, remaining: null, resetAt: null },
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
