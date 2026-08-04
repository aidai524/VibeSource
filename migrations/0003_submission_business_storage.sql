begin;

create table if not exists vibesource_submissions (
  id text primary key not null,
  product_name text not null,
  summary text not null,
  repository_url text not null,
  experience_url text not null,
  ai_involvement text not null,
  tech_stack text not null,
  license_name text not null,
  reuse_notes text not null,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'rejected')),
  evidence_status text not null default 'not_checked'
    check (evidence_status = 'not_checked'),
  idempotency_key_hash text not null unique
    check (idempotency_key_hash ~ '^[a-f0-9]{64}$'),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  check (updated_at >= created_at)
);

create unique index if not exists vibesource_submissions_pending_repository_idx
  on vibesource_submissions (repository_url)
  where status = 'pending_review';

create index if not exists vibesource_submissions_pending_created_idx
  on vibesource_submissions (created_at, id)
  where status = 'pending_review';

create table if not exists vibesource_review_events (
  sequence bigint generated always as identity unique not null,
  id text primary key not null,
  submission_id text not null
    references vibesource_submissions (id) on delete restrict,
  event_type text not null check (event_type in ('submitted', 'rejected')),
  from_status text
    check (from_status is null or from_status in ('pending_review', 'rejected')),
  to_status text not null check (to_status in ('pending_review', 'rejected')),
  actor text not null,
  reason text not null,
  created_at timestamptz not null,
  check (
    (event_type = 'submitted' and from_status is null and to_status = 'pending_review')
    or
    (event_type = 'rejected' and from_status = 'pending_review' and to_status = 'rejected')
  )
);

create index if not exists vibesource_review_events_submission_created_idx
  on vibesource_review_events (submission_id, created_at, sequence);

create table if not exists vibesource_github_evidence_attempts (
  sequence bigint generated always as identity unique not null,
  id text primary key not null,
  submission_id text not null
    references vibesource_submissions (id) on delete restrict,
  actor text not null,
  outcome text not null check (outcome in ('success', 'error')),
  source_url text not null,
  api_version text not null,
  observed_at timestamptz not null,
  http_status integer check (http_status is null or http_status between 100 and 599),
  error_code text check (
    error_code is null or error_code in (
      'not_found', 'rate_limited', 'timeout', 'network_error',
      'invalid_response', 'github_http_error'
    )
  ),
  error_message text,
  rate_limit_limit integer check (rate_limit_limit is null or rate_limit_limit >= 0),
  rate_limit_remaining integer check (rate_limit_remaining is null or rate_limit_remaining >= 0),
  rate_limit_reset_at timestamptz,
  repository_id text,
  full_name text,
  html_url text,
  visibility text,
  is_private boolean,
  archived boolean,
  is_fork boolean,
  default_branch text,
  pushed_at timestamptz,
  stargazers_count integer check (stargazers_count is null or stargazers_count >= 0),
  forks_count integer check (forks_count is null or forks_count >= 0),
  open_issues_count integer check (open_issues_count is null or open_issues_count >= 0),
  license_detection text check (
    license_detection is null or license_detection in ('detected', 'not_detected')
  ),
  license_key text,
  license_name text,
  license_spdx_id text,
  license_url text,
  check (
    (
      outcome = 'success'
      and error_code is null and error_message is null
      and repository_id is not null and full_name is not null
      and html_url is not null and visibility is not null
      and is_private is not null and archived is not null and is_fork is not null
      and default_branch is not null and pushed_at is not null
      and stargazers_count is not null and forks_count is not null
      and open_issues_count is not null and license_detection is not null
    )
    or
    (
      outcome = 'error'
      and error_code is not null and error_message is not null
      and repository_id is null and full_name is null and html_url is null
      and visibility is null and is_private is null and archived is null
      and is_fork is null and default_branch is null and pushed_at is null
      and stargazers_count is null and forks_count is null
      and open_issues_count is null and license_detection is null
    )
  )
);

create index if not exists vibesource_github_evidence_submission_observed_idx
  on vibesource_github_evidence_attempts
  (submission_id, observed_at desc, sequence desc);

create table if not exists vibesource_demo_evidence_attempts (
  sequence bigint generated always as identity unique not null,
  id text primary key not null,
  submission_id text not null
    references vibesource_submissions (id) on delete restrict,
  actor text not null,
  outcome text not null check (outcome in ('success', 'error')),
  source_url text not null,
  check_version text not null,
  observed_at timestamptz not null,
  method text not null check (method = 'GET'),
  http_status integer check (http_status is null or http_status between 100 and 599),
  content_type text,
  resolved_address text,
  resolved_family integer check (resolved_family is null or resolved_family in (4, 6)),
  response_time_ms integer check (response_time_ms is null or response_time_ms >= 0),
  error_code text check (
    error_code is null or error_code in (
      'dns_resolution_failed', 'unsafe_address', 'timeout', 'tls_error',
      'network_error', 'redirect_blocked', 'http_error', 'invalid_response'
    )
  ),
  error_message text,
  check (
    (
      outcome = 'success'
      and http_status between 200 and 299
      and resolved_address is not null and resolved_family is not null
      and response_time_ms is not null
      and error_code is null and error_message is null
    )
    or
    (outcome = 'error' and error_code is not null and error_message is not null)
  )
);

create index if not exists vibesource_demo_evidence_submission_observed_idx
  on vibesource_demo_evidence_attempts
  (submission_id, observed_at desc, sequence desc);

create or replace function vibesource_reject_append_only_change()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end;
$$;

drop trigger if exists vibesource_review_events_no_update on vibesource_review_events;
create trigger vibesource_review_events_no_update
before update on vibesource_review_events
for each statement execute function vibesource_reject_append_only_change();

drop trigger if exists vibesource_review_events_no_delete on vibesource_review_events;
create trigger vibesource_review_events_no_delete
before delete on vibesource_review_events
for each statement execute function vibesource_reject_append_only_change();

drop trigger if exists vibesource_github_evidence_no_update on vibesource_github_evidence_attempts;
create trigger vibesource_github_evidence_no_update
before update on vibesource_github_evidence_attempts
for each statement execute function vibesource_reject_append_only_change();

drop trigger if exists vibesource_github_evidence_no_delete on vibesource_github_evidence_attempts;
create trigger vibesource_github_evidence_no_delete
before delete on vibesource_github_evidence_attempts
for each statement execute function vibesource_reject_append_only_change();

drop trigger if exists vibesource_demo_evidence_no_update on vibesource_demo_evidence_attempts;
create trigger vibesource_demo_evidence_no_update
before update on vibesource_demo_evidence_attempts
for each statement execute function vibesource_reject_append_only_change();

drop trigger if exists vibesource_demo_evidence_no_delete on vibesource_demo_evidence_attempts;
create trigger vibesource_demo_evidence_no_delete
before delete on vibesource_demo_evidence_attempts
for each statement execute function vibesource_reject_append_only_change();

commit;
