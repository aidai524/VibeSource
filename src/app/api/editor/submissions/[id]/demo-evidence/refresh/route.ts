import {
  SubmissionConflictError,
  SubmissionNotFoundError,
  SubmissionValidationError,
} from "@/domain/submission";
import { getSubmissionRepository } from "@/server/app-store";
import { DemoEvidenceAdapter } from "@/server/demo-evidence-adapter";
import { authorizeEditor, hasSameOrigin } from "@/server/editor-auth";
import { getRuntimeConfiguration } from "@/server/features";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = { "cache-control": "no-store" };

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const configuration = getRuntimeConfiguration();
  const access = authorizeEditor(request, configuration, "evidence:refresh");
  if (!access.ok) {
    return Response.json({ message: access.message }, { status: access.status, headers: noStoreHeaders });
  }
  if (!hasSameOrigin(request)) {
    return Response.json({ message: "Demo 证据刷新必须来自同源审核页面。" }, { status: 403, headers: noStoreHeaders });
  }
  if (!configuration.demoEvidenceAvailable) {
    return Response.json(
      { message: "当前环境没有启用 Demo 实时验证。" },
      { status: 503, headers: noStoreHeaders },
    );
  }

  try {
    const { id } = await context.params;
    const repository = getSubmissionRepository(configuration);
    const submission = repository.getSubmission(id);
    if (submission === null) throw new SubmissionNotFoundError(id);
    if (submission.status !== "pending_review") {
      throw new SubmissionConflictError("state", "Only pending submissions can refresh evidence.");
    }
    const result = await new DemoEvidenceAdapter().observe(submission.experienceUrl);
    const demoEvidence = repository.recordDemoEvidenceAttempt(submission.id, access.actorId, result);
    const message = demoEvidence.state === "observed"
      ? "Demo 当前时点响应头证据已保存；这不会批准或发布产品。"
      : demoEvidence.state === "stale"
        ? "最新 Demo 验证失败；旧快照已保留并明确标记为过期。"
        : "Demo 验证失败，失败状态已保存，没有生成可用快照。";
    return Response.json({ demoEvidence, message }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof SubmissionValidationError) {
      return Response.json({ message: error.message, issue: { field: error.field } }, { status: 422, headers: noStoreHeaders });
    }
    if (error instanceof SubmissionNotFoundError) {
      return Response.json({ message: "待审核记录不存在。" }, { status: 404, headers: noStoreHeaders });
    }
    if (error instanceof SubmissionConflictError) {
      return Response.json({ message: "记录已不在待审核状态，Demo 证据没有写入。" }, { status: 409, headers: noStoreHeaders });
    }
    return Response.json(
      { message: "Demo 证据存储暂时不可用，本次尝试没有写入。" },
      { status: 503, headers: noStoreHeaders },
    );
  }
}
