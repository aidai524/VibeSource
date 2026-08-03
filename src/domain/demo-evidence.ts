export const DEMO_EVIDENCE_CHECK_VERSION = "m2.2b1-v1";

export type DemoEvidenceOutcome = "success" | "error";
export type DemoEvidenceState = "not_checked" | "observed" | "stale" | "error";
export type DemoEvidenceErrorCode =
  | "dns_resolution_failed"
  | "unsafe_address"
  | "timeout"
  | "tls_error"
  | "network_error"
  | "redirect_blocked"
  | "http_error"
  | "invalid_response";

interface DemoEvidenceResultBase {
  readonly sourceUrl: string;
  readonly checkVersion: typeof DEMO_EVIDENCE_CHECK_VERSION;
  readonly observedAt: string;
  readonly method: "GET";
  readonly httpStatus: number | null;
  readonly contentType: string | null;
  readonly resolvedAddress: string | null;
  readonly resolvedFamily: 4 | 6 | null;
  readonly responseTimeMs: number | null;
}

export interface DemoEvidenceSuccess extends DemoEvidenceResultBase {
  readonly outcome: "success";
  readonly httpStatus: number;
  readonly resolvedAddress: string;
  readonly resolvedFamily: 4 | 6;
  readonly responseTimeMs: number;
  readonly errorCode: null;
  readonly errorMessage: null;
}

export interface DemoEvidenceFailure extends DemoEvidenceResultBase {
  readonly outcome: "error";
  readonly errorCode: DemoEvidenceErrorCode;
  readonly errorMessage: string;
}

export type DemoEvidenceResult = DemoEvidenceSuccess | DemoEvidenceFailure;

export type DemoEvidenceAttempt = DemoEvidenceResult & {
  readonly id: string;
  readonly submissionId: string;
  readonly actor: string;
};

export interface DemoEvidenceView {
  readonly state: DemoEvidenceState;
  readonly latestAttempt: DemoEvidenceAttempt | null;
  readonly latestUsableAttempt: DemoEvidenceAttempt | null;
}

export const EMPTY_DEMO_EVIDENCE: DemoEvidenceView = {
  state: "not_checked",
  latestAttempt: null,
  latestUsableAttempt: null,
};
