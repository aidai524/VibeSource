import { getSubmissionRepository } from "@/server/app-store";
import { authorizeEditor } from "@/server/editor-auth";
import { getRuntimeConfiguration } from "@/server/features";
import { evaluateLicensePolicy } from "@/domain/license-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const configuration = getRuntimeConfiguration();
  const access = await authorizeEditor(request, configuration, "submission:read");
  if (!access.ok) {
    return Response.json(
      { message: access.message },
      { status: access.status, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const repository = getSubmissionRepository(configuration);
    const pending = await repository.listPending();
    const items = await Promise.all(pending.map(async (submission) => {
      const [githubEvidence, demoEvidence] = await Promise.all([
        repository.getGitHubEvidence(submission.id),
        repository.getDemoEvidence(submission.id),
      ]);
      return {
        ...submission,
        githubEvidence,
        demoEvidence,
        licensePolicy: evaluateLicensePolicy(submission.licenseName, githubEvidence),
      };
    }));
    return Response.json(
      {
        items,
        capabilities: {
          githubEvidenceRefresh:
            configuration.githubEvidenceAvailable &&
            access.principal.permissions.includes("evidence:refresh"),
          demoEvidenceRefresh:
            configuration.demoEvidenceAvailable &&
            access.principal.permissions.includes("evidence:refresh"),
          rejectSubmission:
            access.principal.permissions.includes("submission:reject"),
          licenseReview:
            access.principal.permissions.includes("license:review"),
          role: access.principal.role,
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
