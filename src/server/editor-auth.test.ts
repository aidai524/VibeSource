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
  it("fails closed when editor configuration is missing", async () => {
    const request = new Request("http://localhost/api/editor/submissions");

    await expect(authorizeEditor(request, getRuntimeConfiguration({}), "submission:read")).resolves.toMatchObject({
      ok: false,
      status: 503,
    });
  });

  it("accepts only the configured token and derives the actor server-side", async () => {
    const accepted = new Request("http://localhost/api/editor/submissions", {
      headers: { "x-vibesource-editor-token": "a-long-local-token" },
    });
    const rejected = new Request("http://localhost/api/editor/submissions", {
      headers: { "x-vibesource-editor-token": "wrong-token" },
    });

    await expect(authorizeEditor(accepted, configured, "submission:read")).resolves.toEqual({
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
    await expect(authorizeEditor(rejected, configured, "submission:read")).resolves.toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("returns forbidden when an authenticated role lacks the required permission", async () => {
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
    await expect(authorizeEditor(request, reviewer, "submission:reject")).resolves.toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it("uses a database-backed external principal and still enforces application permissions", async () => {
    const external = getRuntimeConfiguration({
      NODE_ENV: "production",
      VIBESOURCE_SUBMISSION_MODE: "local",
      VIBESOURCE_DB_PATH: "/tmp/vibesource-test.sqlite",
      VIBESOURCE_EDITOR_IDENTITY_MODE: "external-oidc",
      DATABASE_URL: "postgresql://app:secret@db.example.com/vibesource",
      BETTER_AUTH_URL: "https://vibesource.example.com",
      BETTER_AUTH_SECRET: "a-production-secret-that-is-long-enough",
      GITHUB_CLIENT_ID: "github-client",
      GITHUB_CLIENT_SECRET: "github-secret",
    });
    const request = new Request("https://vibesource.example.com/api/editor/submissions");
    const resolver = async () => ({
      kind: "principal" as const,
      principal: {
        subject: "better-auth:user-1",
        actorId: "reviewer-1",
        role: "license_reviewer" as const,
        permissions: ["submission:read", "evidence:refresh", "license:review"] as const,
        authenticationMethod: "external-oidc" as const,
      },
    });

    await expect(
      authorizeEditor(request, external, "submission:read", resolver),
    ).resolves.toMatchObject({ ok: true, actorId: "reviewer-1" });
    await expect(
      authorizeEditor(request, external, "submission:reject", resolver),
    ).resolves.toMatchObject({ ok: false, status: 403 });
  });

  it("distinguishes an authenticated account without an editor role", async () => {
    const external = getRuntimeConfiguration({
      NODE_ENV: "production",
      VIBESOURCE_SUBMISSION_MODE: "local",
      VIBESOURCE_DB_PATH: "/tmp/vibesource-test.sqlite",
      VIBESOURCE_EDITOR_IDENTITY_MODE: "external-oidc",
      DATABASE_URL: "postgresql://app:secret@db.example.com/vibesource",
      BETTER_AUTH_URL: "https://vibesource.example.com",
      BETTER_AUTH_SECRET: "a-production-secret-that-is-long-enough",
      GITHUB_CLIENT_ID: "github-client",
      GITHUB_CLIENT_SECRET: "github-secret",
    });

    await expect(authorizeEditor(
      new Request("https://vibesource.example.com/api/editor/submissions"),
      external,
      "submission:read",
      async () => ({ kind: "unassigned" }),
    )).resolves.toMatchObject({ ok: false, status: 403 });
  });

  it("fails closed when the external identity adapter is unavailable", async () => {
    const external = getRuntimeConfiguration({
      NODE_ENV: "production",
      VIBESOURCE_SUBMISSION_MODE: "local",
      VIBESOURCE_DB_PATH: "/tmp/vibesource-test.sqlite",
      VIBESOURCE_EDITOR_IDENTITY_MODE: "external-oidc",
      DATABASE_URL: "postgresql://app:secret@db.example.com/vibesource",
      BETTER_AUTH_URL: "https://vibesource.example.com",
      BETTER_AUTH_SECRET: "a-production-secret-that-is-long-enough",
      GITHUB_CLIENT_ID: "github-client",
      GITHUB_CLIENT_SECRET: "github-secret",
    });
    const request = new Request("https://vibesource.example.com/api/editor/submissions");

    await expect(
      authorizeEditor(request, external, "submission:read", async () => {
        throw new Error("database unavailable");
      }),
    ).resolves.toMatchObject({ ok: false, status: 503 });
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
