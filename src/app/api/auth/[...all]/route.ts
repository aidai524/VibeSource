import { getRuntimeConfiguration } from "@/server/features";
import { getProductionAuthRuntime } from "@/server/production-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unavailableResponse(): Response {
  return Response.json(
    { message: "生产 GitHub 身份登录尚未配置。" },
    { status: 503, headers: { "cache-control": "no-store" } },
  );
}

async function handle(request: Request): Promise<Response> {
  const configuration = getRuntimeConfiguration();
  if (
    configuration.editorIdentityMode !== "external-oidc" ||
    !configuration.productionAuth
  ) {
    return unavailableResponse();
  }

  try {
    return await getProductionAuthRuntime(configuration.productionAuth).auth.handler(request);
  } catch {
    return Response.json(
      { message: "生产身份服务暂时不可用。" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

export const GET = handle;
export const POST = handle;
