-- Registry of GitHub sign-ins for multi-tenant ops (one row per tenant user_id).
-- user_id matches commits.ai_analysis.analysis_runs (hash of token + USER_ID_PEPPER).
-- Same human with PAT vs OAuth gets two rows (two tokens → two tenants).

create table if not exists public.github_accounts (
  user_id text primary key,
  github_user_id bigint not null,
  login text not null,
  avatar_url text,
  updated_at timestamptz not null default now()
);

create index if not exists github_accounts_github_user_id_idx
  on public.github_accounts (github_user_id);

create index if not exists github_accounts_login_idx
  on public.github_accounts (lower(login));

comment on table public.github_accounts is
  'Maps DevImpact tenant user_id to GitHub identity; updated on each successful list-repos.';
