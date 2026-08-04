import { describe, expect, it } from "vitest";

import {
  EMPTY_GITHUB_EVIDENCE,
  GITHUB_API_VERSION,
  type GitHubEvidenceAttempt,
  type GitHubEvidenceView,
} from "@/domain/github-evidence";
import source from "@/domain/license-policy-source.json";
import { evaluateLicensePolicy, LICENSE_POLICY_VERSION } from "@/domain/license-policy";

function evidence(overrides: Partial<GitHubEvidenceAttempt["repository"]> = {}): GitHubEvidenceView {
  const attempt: GitHubEvidenceAttempt = {
    id: "attempt-1",
    submissionId: "submission-1",
    actor: "qa-editor",
    outcome: "success",
    sourceUrl: "https://api.github.com/repos/example/project",
    apiVersion: GITHUB_API_VERSION,
    observedAt: "2026-08-03T10:00:00.000Z",
    httpStatus: 200,
    rateLimit: { limit: 60, remaining: 59, resetAt: null },
    errorCode: null,
    errorMessage: null,
    repository: {
      repositoryId: "1",
      fullName: "example/project",
      htmlUrl: "https://github.com/example/project",
      visibility: "public",
      isPrivate: false,
      archived: false,
      isFork: false,
      defaultBranch: "main",
      pushedAt: "2026-08-03T09:00:00.000Z",
      stars: 1,
      forks: 0,
      openIssues: 0,
      licenseDetection: "detected",
      licenseKey: "apache-2.0",
      licenseName: "Apache License 2.0",
      licenseSpdxId: "Apache-2.0",
      licenseUrl: "https://api.github.com/licenses/apache-2.0",
      ...overrides,
    },
  };
  return { state: "observed", latestAttempt: attempt, latestUsableAttempt: attempt };
}

describe("license policy snapshot", () => {
  it("is a sorted, duplicate-free SPDX 3.28.0 OSI-approved snapshot", () => {
    expect(source.licenseListVersion).toBe("3.28.0");
    expect(source.approvedSpdxIds).toHaveLength(136);
    expect(new Set(source.approvedSpdxIds).size).toBe(136);
    expect([...source.approvedSpdxIds].sort()).toEqual(source.approvedSpdxIds);
  });
});

describe("evaluateLicensePolicy", () => {
  it("waits for current GitHub evidence", () => {
    expect(evaluateLicensePolicy("Apache-2.0", EMPTY_GITHUB_EVIDENCE)).toMatchObject({
      state: "not_ready",
      policyVersion: LICENSE_POLICY_VERSION,
      reasons: ["github_evidence_missing"],
    });
  });

  it("marks a matching OSI-approved SPDX license ready only for manual review", () => {
    expect(evaluateLicensePolicy("Apache-2.0", evidence())).toMatchObject({
      state: "ready_for_manual_review",
      detectedSpdxId: "Apache-2.0",
      osiApproved: true,
      developerDeclarationMatches: true,
      reasons: ["machine_checks_passed"],
    });
  });

  it("accepts the exact detected GitHub license name as a matching declaration", () => {
    expect(evaluateLicensePolicy("Apache License 2.0", evidence()).developerDeclarationMatches).toBe(true);
  });

  it("requires manual review for a declaration mismatch", () => {
    expect(evaluateLicensePolicy("MIT", evidence())).toMatchObject({
      state: "needs_manual_review",
      developerDeclarationMatches: false,
      reasons: ["developer_declaration_mismatch"],
    });
  });

  it("requires manual review when GitHub detects no license", () => {
    expect(evaluateLicensePolicy("未声明", evidence({
      licenseDetection: "not_detected",
      licenseKey: null,
      licenseName: null,
      licenseSpdxId: null,
      licenseUrl: null,
    }))).toMatchObject({
      state: "needs_manual_review",
      osiApproved: null,
      developerDeclarationMatches: null,
      reasons: ["license_not_detected"],
    });
  });

  it("does not treat a non-OSI SPDX identifier as automatically eligible", () => {
    expect(evaluateLicensePolicy("Elastic-2.0", evidence({
      licenseKey: "elastic-2.0",
      licenseName: "Elastic License 2.0",
      licenseSpdxId: "Elastic-2.0",
    }))).toMatchObject({
      state: "needs_manual_review",
      osiApproved: false,
      developerDeclarationMatches: true,
      reasons: ["spdx_not_osi_approved"],
    });
  });

  it("requires fresh evidence after the latest GitHub refresh fails", () => {
    const usable = evidence().latestUsableAttempt;
    const stale: GitHubEvidenceView = {
      state: "stale",
      latestUsableAttempt: usable,
      latestAttempt: {
        id: "attempt-2",
        submissionId: "submission-1",
        actor: "qa-editor",
        outcome: "error",
        sourceUrl: "https://api.github.com/repos/example/project",
        apiVersion: GITHUB_API_VERSION,
        observedAt: "2026-08-03T11:00:00.000Z",
        httpStatus: 403,
        rateLimit: { limit: 60, remaining: 0, resetAt: null },
        repository: null,
        errorCode: "rate_limited",
        errorMessage: "Rate limited.",
      },
    };
    expect(evaluateLicensePolicy("Apache-2.0", stale)).toMatchObject({
      state: "not_ready",
      detectedSpdxId: "Apache-2.0",
      reasons: ["github_evidence_not_current"],
    });
  });
});
