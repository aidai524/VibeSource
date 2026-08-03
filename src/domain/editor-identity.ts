export type EditorRole = "editor" | "license_reviewer" | "admin";

export type EditorPermission =
  | "submission:read"
  | "submission:reject"
  | "evidence:refresh"
  | "license:review";

export interface EditorPrincipal {
  readonly subject: string;
  readonly actorId: string;
  readonly role: EditorRole;
  readonly permissions: readonly EditorPermission[];
  readonly authenticationMethod: "local-token" | "external-oidc";
}

const rolePermissions = {
  editor: ["submission:read", "submission:reject", "evidence:refresh"],
  license_reviewer: ["submission:read", "evidence:refresh", "license:review"],
  admin: [
    "submission:read",
    "submission:reject",
    "evidence:refresh",
    "license:review",
  ],
} as const satisfies Record<EditorRole, readonly EditorPermission[]>;

export function isEditorRole(value: string | null): value is EditorRole {
  return value === "editor" || value === "license_reviewer" || value === "admin";
}

export function permissionsForRole(role: EditorRole): readonly EditorPermission[] {
  return rolePermissions[role];
}

export function hasEditorPermission(
  principal: Pick<EditorPrincipal, "permissions">,
  permission: EditorPermission,
): boolean {
  return principal.permissions.includes(permission);
}
