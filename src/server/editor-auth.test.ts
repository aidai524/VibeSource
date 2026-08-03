import { describe, expect, it } from "vitest";

import { authorizeEditor, hasSameOrigin } from "./editor-auth";
import { getRuntimeConfiguration } from "./features";

const configured = getRuntimeConfiguration({
  VIBESOURCE_SUBMISSION_MODE: "local",
  VIBESOURCE_DB_PATH: "/tmp/vibesource-test.sqlite",
  VIBESOURCE_EDITOR_IDENTITY_MODE: "local-token",
  VIBESOURCE_EDITOR_TOKEN: "a-long-local-token",
  VIBESOURCE_EDITOR_ID: "qa-editor",
  VIBESOURCE_EDITOR_ROLE: "editor",
});

describe("local editor authorization", () => {
  it("fails closed when editor configuration is missing", () => {
    const request = new Request("http://localhost/api/editor/submissions");

    expect(authorizeEditor(request, getRuntimeConfiguration({}), "submission:read")).toMatchObject({
      ok: false,
      status: 503,
    });
  });

  it("accepts only the configured token and derives the actor server-side", () => {
    const accepted = new Request("http://localhost/api/editor/submissions", {
      headers: { "x-vibesource-editor-token": "a-long-local-token" },
    });
    const rejected = new Request("http://localhost/api/editor/submissions", {
      headers: { "x-vibesource-editor-token": "wrong-token" },
    });

    expect(authorizeEditor(accepted, configured, "submission:read")).toEqual({
      ok: true,
      actorId: "qa-editor",
      principal: {
        subject: "local:qa-editor",
        actorId: "qa-editor",
        role: "editor",
        permissions: ["submission:read", "submission:reject", "evidence:refresh"],
        authenticationMethod: "local-token",
      },
    });
    expect(authorizeEditor(rejected, configured, "submission:read")).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("returns forbidden when an authenticated role lacks the required permission", () => {
    const reviewer = getRuntimeConfiguration({
      VIBESOURCE_SUBMISSION_MODE: "local",
      VIBESOURCE_DB_PATH: "/tmp/vibesource-test.sqlite",
      VIBESOURCE_EDITOR_IDENTITY_MODE: "local-token",
      VIBESOURCE_EDITOR_TOKEN: "a-long-local-token",
      VIBESOURCE_EDITOR_ID: "qa-reviewer",
      VIBESOURCE_EDITOR_ROLE: "license_reviewer",
    });
    const request = new Request("http://localhost/api/editor/submissions/1/reject", {
      headers: { "x-vibesource-editor-token": "a-long-local-token" },
    });
    expect(authorizeEditor(request, reviewer, "submission:reject")).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it("requires an exact same-origin header for state changes", () => {
    expect(
      hasSameOrigin(
        new Request("http://localhost/api/editor/submissions/1/reject", {
          headers: { origin: "http://localhost" },
        }),
      ),
    ).toBe(true);
    expect(
      hasSameOrigin(
        new Request("http://localhost/api/editor/submissions/1/reject", {
          headers: { origin: "https://example.com" },
        }),
      ),
    ).toBe(false);
  });

  it("accepts the browser Host when the framework canonicalizes the URL host", () => {
    expect(
      hasSameOrigin(
        new Request("http://localhost:3108/api/editor/submissions/1/reject", {
          headers: {
            host: "127.0.0.1:3108",
            origin: "http://127.0.0.1:3108",
          },
        }),
      ),
    ).toBe(true);

    expect(
      hasSameOrigin(
        new Request("http://localhost:3108/api/editor/submissions/1/reject", {
          headers: {
            host: "127.0.0.1:3108",
            origin: "https://127.0.0.1:3108",
          },
        }),
      ),
    ).toBe(false);
  });
});
