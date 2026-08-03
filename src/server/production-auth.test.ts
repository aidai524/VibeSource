import { describe, expect, it, vi } from "vitest";

import { resolveGrantedEditorPrincipal } from "./production-auth";

describe("production editor role grants", () => {
  it("derives the application principal from the single active role grant", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ actor_id: "license-reviewer-1", role: "license_reviewer" }],
    });

    await expect(resolveGrantedEditorPrincipal("auth-user-1", { query })).resolves.toEqual({
      subject: "better-auth:auth-user-1",
      actorId: "license-reviewer-1",
      role: "license_reviewer",
      permissions: ["submission:read", "evidence:refresh", "license:review"],
      authenticationMethod: "external-oidc",
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("revoked_at is null"), ["auth-user-1"]);
  });

  it("does not accept missing or unknown database roles", async () => {
    const missing = vi.fn().mockResolvedValue({ rows: [] });
    const unknown = vi.fn().mockResolvedValue({
      rows: [{ actor_id: "unexpected", role: "owner" }],
    });

    await expect(resolveGrantedEditorPrincipal("user-1", { query: missing })).resolves.toBeNull();
    await expect(resolveGrantedEditorPrincipal("user-2", { query: unknown })).resolves.toBeNull();
  });
});
