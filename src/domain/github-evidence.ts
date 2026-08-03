export const GITHUB_API_VERSION = "2026-03-10";

export type GitHubEvidenceOutcome = "success" | "error";
export type GitHubEvidenceState =
  | "not_checked"
  | "observed"
  | "stale"
  | "error";
export type GitHubLicenseDetection = "detected" | "not_detected";
export type GitHubEvidenceErrorCode =
  | "not_found"
  | "rate_limited"
  | "timeout"
  | "network_error"
  | "invalid_response"
  | "github_http_error";

export interface GitHubRateLimit {
  readonly limit: number | null;
  readonly remaining: number | null;
  readonly resetAt: string | null;
}

export interface GitHubRepositoryObservation {
  readonly repositoryId: string;
  readonly fullName: string;
  readonly htmlUrl: string;
  readonly visibility: string;
  readonly isPrivate: boolean;
  readonly archived: boolean;
  readonly isFork: boolean;
  readonly defaultBranch: string;
  readonly pushedAt: string;
  readonly stars: number;
  readonly forks: number;
  readonly openIssues: number;
  readonly licenseDetection: GitHubLicenseDetection;
  readonly licenseKey: string | null;
  readonly licenseName: string | null;
  readonly licenseSpdxId: string | null;
  readonly licenseUrl: string | null;
}

interface GitHubEvidenceResultBase {
  readonly sourceUrl: string;
  readonly apiVersion: typeof GITHUB_API_VERSION;
  readonly observedAt: string;
  readonly httpStatus: number | null;
  readonly rateLimit: GitHubRateLimit;
}

export interface GitHubEvidenceSuccess extends GitHubEvidenceResultBase {
  readonly outcome: "success";
  readonly repository: GitHubRepositoryObservation;
  readonly errorCode: null;
  readonly errorMessage: null;
}

export interface GitHubEvidenceFailure extends GitHubEvidenceResultBase {
  readonly outcome: "error";
  readonly repository: null;
  readonly errorCode: GitHubEvidenceErrorCode;
  readonly errorMessage: string;
}

export type GitHubEvidenceResult =
  | GitHubEvidenceSuccess
  | GitHubEvidenceFailure;

export type GitHubEvidenceAttempt = GitHubEvidenceResult & {
  readonly id: string;
  readonly submissionId: string;
  readonly actor: string;
};

export interface GitHubEvidenceView {
  readonly state: GitHubEvidenceState;
  readonly latestAttempt: GitHubEvidenceAttempt | null;
  readonly latestUsableAttempt: GitHubEvidenceAttempt | null;
}

export const EMPTY_GITHUB_EVIDENCE: GitHubEvidenceView = {
  state: "not_checked",
  latestAttempt: null,
  latestUsableAttempt: null,
};
