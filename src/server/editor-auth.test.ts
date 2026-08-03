import { describe, expect, it } from "vitest";

import { authorizeEditor, hasSameOrigin } from "./editor-auth";
import { getRuntimeConfiguration } from "./features";

const configured = getRuntimeConfiguration({
  VIBESOURCE_SUBMISSION_MODE: "local",
  VIBESOURCE_DB_PATH: "/tmp/vibesource-test.sqlite",
  VIBESOURCE_EDITOR_TOKEN: "a-long-local-token",
  VIBESOURCE_EDITOR_ID: "qa-editor",
});

describe("local editor authorization", () => {
  it("fails closed when editor configuration is missing", () => {
    const request = new Request("http://localhost/api/editor/submissions");

    expect(authorizeEditor(request, getRuntimeConfiguration({}))).toMatchObject({
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

    expect(authorizeEditor(accepted, configured)).toEqual({
      ok: true,
      actorId: "qa-editor",
    });
    expect(authorizeEditor(rejected, configured)).toMatchObject({
      ok: false,
      status: 401,
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
