import {
  SubmissionConflictError,
  SubmissionValidationError,
  type SubmissionInput,
} from "@/domain/submission";
import { getSubmissionRepository } from "@/server/app-store";
import { getRuntimeConfiguration } from "@/server/features";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;

function unavailable(message: string) {
  return Response.json({ message }, { status: 503 });
}

function publicSubmission(submission: {
  id: string;
  status: string;
  version: number;
  createdAt: string;
  evidenceStatus: string;
}) {
  return {
    id: submission.id,
    status: submission.status,
    version: submission.version,
    createdAt: submission.createdAt,
    evidenceStatus: submission.evidenceStatus,
  };
}

export async function POST(request: Request) {
  const configuration = getRuntimeConfiguration();
  if (!configuration.submissionAvailable) {
    return unavailable(
      configuration.unavailableReason ?? "提交服务当前不可用。",
    );
  }

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return Response.json(
      { message: "请求必须使用 application/json。" },
      { status: 415 },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return Response.json({ message: "提交内容超过 64 KiB 限制。" }, { status: 413 });
  }

  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return Response.json({ message: "提交内容超过 64 KiB 限制。" }, { status: 413 });
    }

    const input = JSON.parse(rawBody) as SubmissionInput;
    const idempotencyKey = request.headers.get("idempotency-key");
    const repository = getSubmissionRepository(configuration);
    const submission = await repository.createSubmission(input, idempotencyKey ?? "");

    return Response.json(publicSubmission(submission), {
      status: 201,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ message: "请求正文不是有效 JSON。" }, { status: 400 });
    }
    if (error instanceof SubmissionValidationError) {
      return Response.json(
        {
          message: "提交内容未通过服务端校验。",
          issues: { [error.field]: error.message },
        },
        { status: 422 },
      );
    }
    if (error instanceof SubmissionConflictError) {
      return Response.json(
        { message: "该仓库已有待审核记录，请勿重复提交。" },
        { status: 409 },
      );
    }

    return unavailable("提交存储暂时不可用，记录没有被保存。");
  }
}
