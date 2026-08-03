import { describe, expect, it } from "vitest";

import { getRuntimeConfiguration } from "./features";

describe("runtime feature configuration", () => {
  it("fails closed by default", () => {
    expect(getRuntimeConfiguration({})).toMatchObject({
      mode: "disabled",
      submissionAvailable: false,
      editorAvailable: false,
      githubEvidenceMode: "disabled",
      githubEvidenceAvailable: false,
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
        VIBESOURCE_EDITOR_TOKEN: "a-long-local-token",
        VIBESOURCE_EDITOR_ID: "qa-editor",
      }).editorAvailable,
    ).toBe(true);
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
        VIBESOURCE_EDITOR_TOKEN: "a-long-local-token",
        VIBESOURCE_EDITOR_ID: "qa-editor",
      }),
    ).toMatchObject({
      githubEvidenceMode: "live",
      githubEvidenceAvailable: true,
    });
  });
});
