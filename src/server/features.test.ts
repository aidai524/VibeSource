import { describe, expect, it } from "vitest";

import {
  getRuntimeConfiguration,
  withCloudflareDatabaseBinding,
} from "./features";

describe("runtime feature configuration", () => {
  it("uses Hyperdrive only when a direct database URL is absent", () => {
    const hyperdriveUrl = "postgresql://hyperdrive.internal/vibesource";

    expect(
      withCloudflareDatabaseBinding({}, { connectionString: hyperdriveUrl }),
    ).toMatchObject({ DATABASE_URL: hyperdriveUrl });
    expect(
      withCloudflareDatabaseBinding(
        { DATABASE_URL: "postgresql://direct.example/vibesource" },
        { connectionString: hyperdriveUrl },
      ),
    ).toMatchObject({
      DATABASE_URL: "postgresql://direct.example/vibesource",
    });
    expect(
      withCloudflareDatabaseBinding({}, { connectionString: "  " }),
    ).not.toHaveProperty("DATABASE_URL");
  });

  it("fails closed by default", () => {
    expect(getRuntimeConfiguration({})).toMatchObject({
      mode: "disabled",
      submissionAvailable: false,
      editorAvailable: false,
      editorIdentityMode: "disabled",
      editorRole: null,
      githubEvidenceMode: "disabled",
      githubEvidenceAvailable: false,
      demoEvidenceMode: "disabled",
      demoEvidenceAvailable: false,
      databasePath: null,
    });
  });

  it("requires an absolute database path for local submissions", () => {
    expect(
      getRuntimeConfiguration({
        VIBESOURCE_SUBMISSION_MODE: "local",
        VIBESOURCE_DB_PATH: "./relative.sqlite",
      }),
    ).toMatchObject({
      mode: "local",
      submissionAvailable: false,
    });
  });

  it("only enables review when the server-side editor identity is complete", () => {
    const base = {
      VIBESOURCE_SUBMISSION_MODE: "local",
      VIBESOURCE_DB_PATH: "/tmp/vibesource-test.sqlite",
    };

    expect(getRuntimeConfiguration(base).editorAvailable).toBe(false);
    expect(
      getRuntimeConfiguration({
        ...base,
        VIBESOURCE_EDITOR_IDENTITY_MODE: "local-token",
        VIBESOURCE_EDITOR_TOKEN: "a-long-local-token",
        VIBESOURCE_EDITOR_ID: "qa-editor",
        VIBESOURCE_EDITOR_ROLE: "editor",
      }).editorAvailable,
    ).toBe(true);
  });

  it("keeps the reserved external OIDC mode unavailable until an adapter exists", () => {
    expect(getRuntimeConfiguration({
      VIBESOURCE_SUBMISSION_MODE: "local",
      VIBESOURCE_DB_PATH: "/tmp/vibesource-test.sqlite",
      VIBESOURCE_EDITOR_IDENTITY_MODE: "external-oidc",
      VIBESOURCE_EDITOR_ROLE: "admin",
    })).toMatchObject({
      editorIdentityMode: "external-oidc",
      editorAvailable: false,
    });
  });

  it("enables external identity only with a complete HTTPS production configuration", () => {
    expect(getRuntimeConfiguration({
      NODE_ENV: "production",
      VIBESOURCE_SUBMISSION_MODE: "local",
      VIBESOURCE_DB_PATH: "/tmp/vibesource-test.sqlite",
      VIBESOURCE_EDITOR_IDENTITY_MODE: "external-oidc",
      DATABASE_URL: "postgresql://app:secret@db.example.com/vibesource",
      BETTER_AUTH_URL: "https://vibesource.example.com",
      BETTER_AUTH_SECRET: "a-production-secret-that-is-long-enough",
      GITHUB_CLIENT_ID: "github-client",
      GITHUB_CLIENT_SECRET: "github-secret",
    })).toMatchObject({
      editorIdentityMode: "external-oidc",
      editorAvailable: true,
      editorRole: null,
      productionAuth: {
        baseUrl: "https://vibesource.example.com/",
      },
    });

    expect(getRuntimeConfiguration({
      NODE_ENV: "production",
      VIBESOURCE_SUBMISSION_MODE: "local",
      VIBESOURCE_DB_PATH: "/tmp/vibesource-test.sqlite",
      VIBESOURCE_EDITOR_IDENTITY_MODE: "external-oidc",
      DATABASE_URL: "postgresql://app:secret@db.example.com/vibesource",
      BETTER_AUTH_URL: "http://vibesource.example.com",
      BETTER_AUTH_SECRET: "a-production-secret-that-is-long-enough",
      GITHUB_CLIENT_ID: "github-client",
      GITHUB_CLIENT_SECRET: "github-secret",
    }).editorAvailable).toBe(false);
  });

  it("requires an explicit live switch and a complete editor boundary for GitHub evidence", () => {
    const base = {
      VIBESOURCE_SUBMISSION_MODE: "local",
      VIBESOURCE_DB_PATH: "/tmp/vibesource-test.sqlite",
      VIBESOURCE_GITHUB_EVIDENCE_MODE: "live",
    };

    expect(getRuntimeConfiguration(base).githubEvidenceAvailable).toBe(false);
    expect(
      getRuntimeConfiguration({
        ...base,
        VIBESOURCE_EDITOR_IDENTITY_MODE: "local-token",
        VIBESOURCE_EDITOR_TOKEN: "a-long-local-token",
        VIBESOURCE_EDITOR_ID: "qa-editor",
        VIBESOURCE_EDITOR_ROLE: "editor",
      }),
    ).toMatchObject({
      githubEvidenceMode: "live",
      githubEvidenceAvailable: true,
    });
  });

  it("requires an explicit live switch and a complete editor boundary for Demo evidence", () => {
    const base = {
      VIBESOURCE_SUBMISSION_MODE: "local",
      VIBESOURCE_DB_PATH: "/tmp/vibesource-test.sqlite",
      VIBESOURCE_DEMO_EVIDENCE_MODE: "live",
    };
    expect(getRuntimeConfiguration(base).demoEvidenceAvailable).toBe(false);
    expect(getRuntimeConfiguration({
      ...base,
      VIBESOURCE_EDITOR_IDENTITY_MODE: "local-token",
      VIBESOURCE_EDITOR_TOKEN: "a-long-local-token",
      VIBESOURCE_EDITOR_ID: "qa-editor",
      VIBESOURCE_EDITOR_ROLE: "editor",
    })).toMatchObject({ demoEvidenceMode: "live", demoEvidenceAvailable: true });
  });
});
