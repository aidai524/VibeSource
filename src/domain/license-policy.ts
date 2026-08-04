import type { GitHubEvidenceView } from "@/domain/github-evidence";
import source from "@/domain/license-policy-source.json";

export const LICENSE_POLICY_VERSION = "m2.2b2a-osi-spdx-3.28.0-v1";

export type LicensePolicyState =
  | "not_ready"
  | "needs_manual_review"
  | "ready_for_manual_review";

export type LicensePolicyReason =
  | "github_evidence_missing"
  | "github_evidence_not_current"
  | "repository_not_public"
  | "license_not_detected"
  | "spdx_id_missing"
  | "spdx_not_osi_approved"
  | "developer_declaration_mismatch"
  | "machine_checks_passed";

export interface LicensePolicyView {
  readonly state: LicensePolicyState;
  readonly policyVersion: typeof LICENSE_POLICY_VERSION;
  readonly source: {
    readonly url: string;
    readonly licenseListVersion: string;
    readonly releaseDate: string;
    readonly sha256: string;
    readonly approvedIdentifierCount: number;
  };
  readonly basedOnGitHubObservedAt: string | null;
  readonly detectedSpdxId: string | null;
  readonly osiApproved: boolean | null;
  readonly developerDeclarationMatches: boolean | null;
  readonly reasons: readonly LicensePolicyReason[];
}

const approvedSpdxIds = new Set(source.approvedSpdxIds);

function normalizeClaim(value: string): string {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

function baseView(): Pick<LicensePolicyView, "policyVersion" | "source"> {
  return {
    policyVersion: LICENSE_POLICY_VERSION,
    source: {
      url: source.source,
      licenseListVersion: source.licenseListVersion,
      releaseDate: source.releaseDate,
      sha256: source.sha256,
      approvedIdentifierCount: approvedSpdxIds.size,
    },
  };
}

export function evaluateLicensePolicy(
  developerDeclaration: string,
  githubEvidence: GitHubEvidenceView,
): LicensePolicyView {
  const base = baseView();
  if (githubEvidence.state === "not_checked") {
    return {
      ...base,
      state: "not_ready",
      basedOnGitHubObservedAt: null,
      detectedSpdxId: null,
      osiApproved: null,
      developerDeclarationMatches: null,
      reasons: ["github_evidence_missing"],
    };
  }
  if (githubEvidence.state !== "observed") {
    return {
      ...base,
      state: "not_ready",
      basedOnGitHubObservedAt: githubEvidence.latestUsableAttempt?.observedAt ?? null,
      detectedSpdxId:
        githubEvidence.latestUsableAttempt?.outcome === "success"
          ? githubEvidence.latestUsableAttempt.repository.licenseSpdxId
          : null,
      osiApproved: null,
      developerDeclarationMatches: null,
      reasons: ["github_evidence_not_current"],
    };
  }

  const attempt = githubEvidence.latestAttempt;
  if (attempt?.outcome !== "success") {
    throw new Error("Observed GitHub evidence must have a successful latest attempt.");
  }
  const repository = attempt.repository;
  const reasons: LicensePolicyReason[] = [];
  if (repository.isPrivate || repository.visibility !== "public") {
    reasons.push("repository_not_public");
  }
  if (repository.licenseDetection !== "detected") {
    reasons.push("license_not_detected");
  }
  const spdxId = repository.licenseSpdxId;
  if (repository.licenseDetection === "detected" && spdxId === null) {
    reasons.push("spdx_id_missing");
  }
  const osiApproved = spdxId === null ? null : approvedSpdxIds.has(spdxId);
  if (osiApproved === false) reasons.push("spdx_not_osi_approved");

  const candidates = [spdxId, repository.licenseKey, repository.licenseName]
    .filter((value): value is string => value !== null)
    .map(normalizeClaim);
  const declarationMatches = candidates.length === 0
    ? null
    : candidates.includes(normalizeClaim(developerDeclaration));
  if (declarationMatches === false) reasons.push("developer_declaration_mismatch");

  const ready =
    !repository.isPrivate &&
    repository.visibility === "public" &&
    repository.licenseDetection === "detected" &&
    spdxId !== null &&
    osiApproved === true &&
    declarationMatches === true;
  return {
    ...base,
    state: ready ? "ready_for_manual_review" : "needs_manual_review",
    basedOnGitHubObservedAt: attempt.observedAt,
    detectedSpdxId: spdxId,
    osiApproved,
    developerDeclarationMatches: declarationMatches,
    reasons: ready ? ["machine_checks_passed"] : reasons,
  };
}
