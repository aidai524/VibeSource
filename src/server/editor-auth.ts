import { timingSafeEqual } from "node:crypto";

import {
  hasEditorPermission,
  permissionsForRole,
  type EditorPermission,
  type EditorPrincipal,
} from "@/domain/editor-identity";
import type { RuntimeConfiguration } from "@/server/features";

export const EDITOR_TOKEN_HEADER = "x-vibesource-editor-token";

export type EditorAccess =
  | { readonly ok: true; readonly actorId: string; readonly principal: EditorPrincipal }
  | {
      readonly ok: false;
      readonly status: 401 | 403 | 503;
      readonly message: string;
    };

function secretsMatch(expected: string, received: string): boolean {
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);

  return (
    expectedBytes.length === receivedBytes.length &&
    timingSafeEqual(expectedBytes, receivedBytes)
  );
}

export function authorizeEditor(
  request: Request,
  configuration: RuntimeConfiguration,
  requiredPermission: EditorPermission,
): EditorAccess {
  if (
    !configuration.editorAvailable ||
    !configuration.editorToken ||
    !configuration.editorId ||
    !configuration.editorRole ||
    configuration.editorIdentityMode !== "local-token"
  ) {
    return {
      ok: false,
      status: 503,
      message: "本地编辑审核尚未配置。",
    };
  }

  const receivedToken = request.headers.get(EDITOR_TOKEN_HEADER) ?? "";
  if (!secretsMatch(configuration.editorToken, receivedToken)) {
    return {
      ok: false,
      status: 401,
      message: "编辑凭证无效。",
    };
  }

  const principal: EditorPrincipal = {
    subject: `local:${configuration.editorId}`,
    actorId: configuration.editorId,
    role: configuration.editorRole,
    permissions: permissionsForRole(configuration.editorRole),
    authenticationMethod: "local-token",
  };
  if (!hasEditorPermission(principal, requiredPermission)) {
    return {
      ok: false,
      status: 403,
      message: "当前编辑角色没有执行此操作的权限。",
    };
  }

  return { ok: true, actorId: principal.actorId, principal };
}

export function hasSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) {
    return false;
  }

  let parsedOrigin: URL;
  const requestUrl = new URL(request.url);
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  if (parsedOrigin.origin === requestUrl.origin) {
    return true;
  }

  // Next.js may canonicalize the Request URL hostname to localhost while the
  // browser correctly sends 127.0.0.1 in both Origin and Host. Host reflects
  // the browser's actual destination and cannot be rewritten by page script.
  const host = request.headers.get("host")?.toLowerCase();
  return (
    host !== undefined &&
    parsedOrigin.protocol === requestUrl.protocol &&
    parsedOrigin.host.toLowerCase() === host
  );
}
