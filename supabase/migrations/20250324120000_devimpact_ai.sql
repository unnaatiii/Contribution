-- DevImpact: AI cache + analysis history (multi-tenant via user_id).
-- Run in Supabase SQL editor or via supabase db push.

create table if not exists commits (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  repo text not null,
  sha text not null,
  author text,
  message text,
  date timestamptz,
  analyzed boolean default false,
  unique (user_id, repo, sha)
);

create index if not exists commits_user_repo_idx on commits (user_id, repo);

create table if not exists ai_analysis (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  repo text not null,
  sha text not null,
  impact_score int,
  type text,
  summary text,
  full_analysis jsonb,
  model_used text,
  created_at timestamptz default now(),
  unique (user_id, repo, sha)
);

create index if not exists ai_analysis_user_repo_idx on ai_analysis (user_id, repo);

create table if not exists analysis_runs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  repos jsonb not null,
  from_date date not null,
  to_date date not null,
  run_at timestamptz default now(),
  result_snapshot jsonb not null
);

create index if not exists analysis_runs_user_run_at_idx on analysis_runs (user_id, run_at desc);
