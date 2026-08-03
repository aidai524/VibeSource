import { timingSafeEqual } from "node:crypto";

import type { RuntimeConfiguration } from "@/server/features";

export const EDITOR_TOKEN_HEADER = "x-vibesource-editor-token";

export type EditorAccess =
  | { readonly ok: true; readonly actorId: string }
  | {
      readonly ok: false;
      readonly status: 401 | 503;
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
): EditorAccess {
  if (
    !configuration.editorAvailable ||
    !configuration.editorToken ||
    !configuration.editorId
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

  return { ok: true, actorId: configuration.editorId };
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
