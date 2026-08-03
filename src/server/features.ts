import path from "node:path";

import { isEditorRole, type EditorRole } from "@/domain/editor-identity";

export type SubmissionMode = "disabled" | "local";
export type GitHubEvidenceMode = "disabled" | "live";
export type DemoEvidenceMode = "disabled" | "live";
export type EditorIdentityMode = "disabled" | "local-token" | "external-oidc";

export type RuntimeConfiguration = {
  readonly mode: SubmissionMode;
  readonly submissionAvailable: boolean;
  readonly editorAvailable: boolean;
  readonly editorIdentityMode: EditorIdentityMode;
  readonly editorRole: EditorRole | null;
  readonly githubEvidenceMode: GitHubEvidenceMode;
  readonly githubEvidenceAvailable: boolean;
  readonly demoEvidenceMode: DemoEvidenceMode;
  readonly demoEvidenceAvailable: boolean;
  readonly databasePath: string | null;
  readonly editorToken: string | null;
  readonly editorId: string | null;
  readonly unavailableReason: string | null;
};

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

export function getRuntimeConfiguration(
  environment: RuntimeEnvironment = process.env,
): RuntimeConfiguration {
  const mode = environment.VIBESOURCE_SUBMISSION_MODE === "local"
    ? "local"
    : "disabled";
  const candidatePath = environment.VIBESOURCE_DB_PATH?.trim() || null;
  const databasePath = candidatePath && path.isAbsolute(candidatePath)
    ? candidatePath
    : null;
  const editorToken = environment.VIBESOURCE_EDITOR_TOKEN?.trim() || null;
  const editorId = environment.VIBESOURCE_EDITOR_ID?.trim() || null;
  const editorIdentityMode: EditorIdentityMode =
    environment.VIBESOURCE_EDITOR_IDENTITY_MODE === "local-token"
      ? "local-token"
      : environment.VIBESOURCE_EDITOR_IDENTITY_MODE === "external-oidc"
        ? "external-oidc"
        : "disabled";
  const roleCandidate = environment.VIBESOURCE_EDITOR_ROLE?.trim() || null;
  const editorRole = isEditorRole(roleCandidate) ? roleCandidate : null;
  const githubEvidenceMode =
    environment.VIBESOURCE_GITHUB_EVIDENCE_MODE === "live"
      ? "live"
      : "disabled";
  const submissionAvailable = mode === "local" && databasePath !== null;
  const editorAvailable =
    submissionAvailable &&
    editorIdentityMode === "local-token" &&
    editorToken !== null &&
    editorToken.length >= 16 &&
    editorId !== null &&
    editorRole !== null;
  const githubEvidenceAvailable =
    editorAvailable && githubEvidenceMode === "live";
  const demoEvidenceMode = environment.VIBESOURCE_DEMO_EVIDENCE_MODE === "live"
    ? "live"
    : "disabled";
  const demoEvidenceAvailable = editorAvailable && demoEvidenceMode === "live";

  let unavailableReason: string | null = null;
  if (mode !== "local") {
    unavailableReason = "提交入口默认关闭，仅在受控本地或 QA 环境开放。";
  } else if (databasePath === null) {
    unavailableReason =
      "提交模式已开启，但 VIBESOURCE_DB_PATH 还没有配置为绝对路径。";
  }

  return {
    mode,
    submissionAvailable,
    editorAvailable,
    editorIdentityMode,
    editorRole,
    githubEvidenceMode,
    githubEvidenceAvailable,
    demoEvidenceMode,
    demoEvidenceAvailable,
    databasePath,
    editorToken,
    editorId,
    unavailableReason,
  };
}
