import { getRuntimeConfiguration } from "@/server/features";
import { getProductionAuthRuntime } from "@/server/production-auth";

const configuration = getRuntimeConfiguration();

if (!configuration.productionAuth) {
  throw new Error(
    "Schema generation requires DATABASE_URL, BETTER_AUTH_URL, " +
      "BETTER_AUTH_SECRET, GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.",
  );
}

export const auth = getProductionAuthRuntime(configuration.productionAuth).auth;
