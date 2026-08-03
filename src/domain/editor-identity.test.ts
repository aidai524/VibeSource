import { describe, expect, it } from "vitest";

import {
  hasEditorPermission,
  isEditorRole,
  permissionsForRole,
} from "@/domain/editor-identity";

describe("editor identity policy", () => {
  it("recognizes only the three explicit roles", () => {
    expect(["editor", "license_reviewer", "admin"].every(isEditorRole)).toBe(true);
    expect(isEditorRole("owner")).toBe(false);
    expect(isEditorRole(null)).toBe(false);
  });

  it("keeps rejection unavailable to a license reviewer", () => {
    const permissions = permissionsForRole("license_reviewer");
    expect(hasEditorPermission({ permissions }, "submission:read")).toBe(true);
    expect(hasEditorPermission({ permissions }, "evidence:refresh")).toBe(true);
    expect(hasEditorPermission({ permissions }, "license:review")).toBe(true);
    expect(hasEditorPermission({ permissions }, "submission:reject")).toBe(false);
  });

  it("allows an editor to reject without granting license review", () => {
    const permissions = permissionsForRole("editor");
    expect(hasEditorPermission({ permissions }, "submission:reject")).toBe(true);
    expect(hasEditorPermission({ permissions }, "license:review")).toBe(false);
  });

  it("grants the admin every currently defined permission", () => {
    expect(permissionsForRole("admin")).toEqual([
      "submission:read",
      "submission:reject",
      "evidence:refresh",
      "license:review",
    ]);
  });
});
