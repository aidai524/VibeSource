import { getSubmissionRepository } from "@/server/app-store";
import { authorizeEditor } from "@/server/editor-auth";
import { getRuntimeConfiguration } from "@/server/features";
import { evaluateLicensePolicy } from "@/domain/license-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const configuration = getRuntimeConfiguration();
  const access = authorizeEditor(request, configuration);
  if (!access.ok) {
    return Response.json(
      { message: access.message },
      { status: access.status, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const repository = getSubmissionRepository(configuration);
    const items = repository.listPending().map((submission) => {
      const githubEvidence = repository.getGitHubEvidence(submission.id);
      return {
        ...submission,
        githubEvidence,
        demoEvidence: repository.getDemoEvidence(submission.id),
        licensePolicy: evaluateLicensePolicy(submission.licenseName, githubEvidence),
      };
    });
    return Response.json(
      {
        items,
        capabilities: {
          githubEvidenceRefresh: configuration.githubEvidenceAvailable,
          demoEvidenceRefresh: configuration.demoEvidenceAvailable,
        },
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      { message: "审核存储暂时不可用。" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
