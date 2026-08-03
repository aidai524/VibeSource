import { describe, expect, it } from "vitest";

import { getHealthPayload } from "./health";

describe("health payload", () => {
  it("returns a small deterministic service status", () => {
    expect(getHealthPayload()).toEqual({
      status: "ok",
      service: "vibesource",
      milestone: "M1-runnable-foundation",
    });
  });
});
