import { betterAuth } from "better-auth";
import { Pool } from "pg";

import {
  isEditorRole,
  permissionsForRole,
  type EditorPrincipal,
} from "@/domain/editor-identity";
import type { ProductionAuthConfiguration } from "@/server/features";
import type { ExternalPrincipalResolution } from "@/server/editor-auth";

type RoleGrantRow = {
  readonly actor_id: string;
  readonly role: string;
};

type RoleGrantQuery = Pick<Pool, "query">;

function configurationKey(configuration: ProductionAuthConfiguration): string {
  return [
    configuration.databaseUrl,
    configuration.baseUrl,
    configuration.githubClientId,
    configuration.secret,
  ].join("\0");
}

function createProductionAuthRuntime(
  configuration: ProductionAuthConfiguration,
) {
  const pool = new Pool({
    connectionString: configuration.databaseUrl,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: true,
    application_name: "vibesource-web",
  });
  const auth = betterAuth({
    appName: "VibeSource",
    baseURL: configuration.baseUrl,
    secret: configuration.secret,
    database: pool,
    socialProviders: {
      github: {
        clientId: configuration.githubClientId,
        clientSecret: configuration.githubClientSecret,
      },
    },
    account: {
      encryptOAuthTokens: true,
      storeStateStrategy: "database",
      accountLinking: {
        enabled: false,
      },
    },
    session: {
      expiresIn: 60 * 60 * 8,
      disableSessionRefresh: true,
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
    },
    advanced: {
      useSecureCookies: configuration.baseUrl.startsWith("https://"),
      disableCSRFCheck: false,
      disableOriginCheck: false,
      cookiePrefix: "vibesource",
    },
    telemetry: {
      enabled: false,
    },
  });

  return { auth, pool };
}

type ProductionAuthRuntime = ReturnType<typeof createProductionAuthRuntime>;

let cachedRuntime:
  | { readonly key: string; readonly value: ProductionAuthRuntime }
  | undefined;

export function getProductionAuthRuntime(
  configuration: ProductionAuthConfiguration,
): ProductionAuthRuntime {
  const key = configurationKey(configuration);
  if (cachedRuntime?.key === key) return cachedRuntime.value;

  const value = createProductionAuthRuntime(configuration);
  cachedRuntime = { key, value };
  return value;
}

export async function resolveExternalEditorPrincipal(
  request: Request,
  configuration: ProductionAuthConfiguration,
): Promise<ExternalPrincipalResolution> {
  const { auth, pool } = getProductionAuthRuntime(configuration);
  const session = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
  });
  if (!session?.user.id) return { kind: "unauthenticated" };

  const principal = await resolveGrantedEditorPrincipal(session.user.id, pool);
  return principal
    ? { kind: "principal", principal }
    : { kind: "unassigned" };
}

export async function resolveGrantedEditorPrincipal(
  authUserId: string,
  database: RoleGrantQuery,
): Promise<EditorPrincipal | null> {
  const result = await database.query<RoleGrantRow>(
    `select actor_id, role
       from vibesource_editor_role_grants
      where auth_user_id = $1
        and revoked_at is null
      limit 1`,
    [authUserId],
  );
  const grant = result.rows[0];
  if (!grant || !isEditorRole(grant.role)) return null;

  return {
    subject: `better-auth:${authUserId}`,
    actorId: grant.actor_id,
    role: grant.role,
    permissions: permissionsForRole(grant.role),
    authenticationMethod: "external-oidc",
  };
}
