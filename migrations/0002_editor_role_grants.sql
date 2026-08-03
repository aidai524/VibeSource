begin;

create table if not exists vibesource_editor_role_grants (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null references "user" (id) on delete restrict,
  actor_id text not null,
  role text not null check (role in ('editor', 'license_reviewer', 'admin')),
  granted_at timestamptz not null default now(),
  granted_by text not null,
  grant_reason text not null check (char_length(grant_reason) between 10 and 500),
  revoked_at timestamptz,
  revoked_by text,
  revoke_reason text,
  constraint vibesource_editor_role_grants_revocation_complete check (
    (revoked_at is null and revoked_by is null and revoke_reason is null)
    or
    (
      revoked_at is not null
      and revoked_by is not null
      and revoke_reason is not null
      and char_length(revoke_reason) between 10 and 500
    )
  )
);

create unique index if not exists vibesource_editor_role_grants_active_user_idx
  on vibesource_editor_role_grants (auth_user_id)
  where revoked_at is null;

create index if not exists vibesource_editor_role_grants_auth_user_id_idx
  on vibesource_editor_role_grants (auth_user_id);

create unique index if not exists vibesource_editor_role_grants_active_actor_idx
  on vibesource_editor_role_grants (actor_id)
  where revoked_at is null;

create index if not exists vibesource_editor_role_grants_granted_at_idx
  on vibesource_editor_role_grants (granted_at desc);

commit;
