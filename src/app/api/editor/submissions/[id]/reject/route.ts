import {
  SubmissionConflictError,
  SubmissionNotFoundError,
  SubmissionValidationError,
} from "@/domain/submission";
import { getSubmissionRepository } from "@/server/app-store";
import { authorizeEditor, hasSameOrigin } from "@/server/editor-auth";
import { getRuntimeConfiguration } from "@/server/features";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RejectRouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function POST(request: Request, context: RejectRouteContext) {
  const configuration = getRuntimeConfiguration();
  const access = authorizeEditor(request, configuration, "submission:reject");
  if (!access.ok) {
    return Response.json(
      { message: access.message },
      { status: access.status, headers: { "cache-control": "no-store" } },
    );
  }

  if (!hasSameOrigin(request)) {
    return Response.json(
      { message: "审核状态变更必须来自同源页面。" },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const body = (await request.json()) as {
      readonly reason?: unknown;
      readonly expectedVersion?: unknown;
    };
    const { id } = await context.params;
    const submission = getSubmissionRepository(configuration).rejectSubmission(
      id,
      {
        actor: access.actorId,
        reason: body.reason as string,
        expectedVersion: body.expectedVersion as number,
      },
    );

    return Response.json(
      {
        id: submission.id,
        status: submission.status,
        version: submission.version,
        updatedAt: submission.updatedAt,
        message: "候选产品已拒绝，理由和服务器端编辑身份已写入审计记录。",
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ message: "请求正文不是有效 JSON。" }, { status: 400 });
    }
    if (error instanceof SubmissionValidationError) {
      return Response.json(
        { message: error.message, issue: { field: error.field } },
        { status: 422 },
      );
    }
    if (error instanceof SubmissionNotFoundError) {
      return Response.json({ message: "待审核记录不存在。" }, { status: 404 });
    }
    if (error instanceof SubmissionConflictError) {
      return Response.json(
        { message: "记录状态或版本已变化，请刷新审核队列后重试。" },
        { status: 409 },
      );
    }

    return Response.json(
      { message: "审核存储暂时不可用，记录没有被更改。" },
      { status: 503 },
    );
  }
}
