import {
  SubmissionConflictError,
  SubmissionNotFoundError,
  SubmissionValidationError,
} from "@/domain/submission";
import { evaluateLicensePolicy } from "@/domain/license-policy";
import { getSubmissionRepository } from "@/server/app-store";
import { authorizeEditor, hasSameOrigin } from "@/server/editor-auth";
import { getRuntimeConfiguration } from "@/server/features";
import { GitHubEvidenceAdapter } from "@/server/github-evidence-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RefreshRouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

const noStoreHeaders = { "cache-control": "no-store" } as const;

export async function POST(request: Request, context: RefreshRouteContext) {
  const configuration = getRuntimeConfiguration();
  const access = authorizeEditor(request, configuration);
  if (!access.ok) {
    return Response.json(
      { message: access.message },
      { status: access.status, headers: noStoreHeaders },
    );
  }
  if (!hasSameOrigin(request)) {
    return Response.json(
      { message: "GitHub 证据刷新必须来自同源审核页面。" },
      { status: 403, headers: noStoreHeaders },
    );
  }
  if (!configuration.githubEvidenceAvailable) {
    return Response.json(
      { message: "GitHub 证据刷新默认关闭，当前环境没有显式启用。" },
      { status: 503, headers: noStoreHeaders },
    );
  }

  try {
    const { id } = await context.params;
    const repository = getSubmissionRepository(configuration);
    const submission = repository.getSubmission(id);
    if (submission === null) {
      throw new SubmissionNotFoundError(id);
    }
    if (submission.status !== "pending_review") {
      throw new SubmissionConflictError(
        "state",
        "Only pending submissions can refresh evidence.",
      );
    }

    const result = await new GitHubEvidenceAdapter().observe(
      submission.repositoryUrl,
    );
    const githubEvidence = repository.recordGitHubEvidenceAttempt(
      submission.id,
      access.actorId,
      result,
    );
    const licensePolicy = evaluateLicensePolicy(
      submission.licenseName,
      githubEvidence,
    );

    const message =
      githubEvidence.state === "observed"
        ? "GitHub 当前时点证据已保存；这不会批准或发布产品。"
        : githubEvidence.state === "stale"
          ? "最新 GitHub 刷新失败；旧快照已保留并明确标记为过期。"
          : "GitHub 刷新失败，失败状态已保存，没有生成仓库快照。";

    return Response.json(
      { githubEvidence, licensePolicy, message },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    if (error instanceof SubmissionValidationError) {
      return Response.json(
        { message: error.message, issue: { field: error.field } },
        { status: 422, headers: noStoreHeaders },
      );
    }
    if (error instanceof SubmissionNotFoundError) {
      return Response.json(
        { message: "待审核记录不存在。" },
        { status: 404, headers: noStoreHeaders },
      );
    }
    if (error instanceof SubmissionConflictError) {
      return Response.json(
        { message: "记录已不在待审核状态，GitHub 证据没有写入。" },
        { status: 409, headers: noStoreHeaders },
      );
    }

    return Response.json(
      { message: "GitHub 证据存储暂时不可用，本次尝试没有写入。" },
      { status: 503, headers: noStoreHeaders },
    );
  }
}
