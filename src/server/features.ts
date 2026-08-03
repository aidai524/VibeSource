import path from "node:path";

import { isEditorRole, type EditorRole } from "@/domain/editor-identity";

export type SubmissionMode = "disabled" | "local";
export type GitHubEvidenceMode = "disabled" | "live";
export type DemoEvidenceMode = "disabled" | "live";
export type EditorIdentityMode = "disabled" | "local-token" | "external-oidc";

export type ProductionAuthConfiguration = {
  readonly databaseUrl: string;
  readonly baseUrl: string;
  readonly secret: string;
  readonly githubClientId: string;
  readonly githubClientSecret: string;
};

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
  readonly productionAuth: ProductionAuthConfiguration | null;
  readonly unavailableReason: string | null;
};

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

function parseUrl(value: string | undefined, protocols: readonly string[]): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    return protocols.includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

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
  const productionDatabaseUrl = parseUrl(
    environment.DATABASE_URL,
    ["postgres:", "postgresql:"],
  );
  const productionAuthBaseUrl = parseUrl(
    environment.BETTER_AUTH_URL,
    environment.NODE_ENV === "production" ? ["https:"] : ["https:", "http:"],
  );
  const productionAuthSecret = environment.BETTER_AUTH_SECRET?.trim() || null;
  const githubClientId = environment.GITHUB_CLIENT_ID?.trim() || null;
  const githubClientSecret = environment.GITHUB_CLIENT_SECRET?.trim() || null;
  const productionAuth =
    productionDatabaseUrl &&
    productionAuthBaseUrl &&
    productionAuthSecret &&
    productionAuthSecret.length >= 32 &&
    githubClientId &&
    githubClientSecret
      ? {
          databaseUrl: productionDatabaseUrl,
          baseUrl: productionAuthBaseUrl,
          secret: productionAuthSecret,
          githubClientId,
          githubClientSecret,
        }
      : null;
  const githubEvidenceMode =
    environment.VIBESOURCE_GITHUB_EVIDENCE_MODE === "live"
      ? "live"
      : "disabled";
  const submissionAvailable = mode === "local" && databasePath !== null;
  const localEditorAvailable =
    submissionAvailable &&
    editorIdentityMode === "local-token" &&
    editorToken !== null &&
    editorToken.length >= 16 &&
    editorId !== null &&
    editorRole !== null;
  const externalEditorAvailable =
    submissionAvailable &&
    editorIdentityMode === "external-oidc" &&
    productionAuth !== null;
  const editorAvailable = localEditorAvailable || externalEditorAvailable;
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
    productionAuth,
    unavailableReason,
  };
}
