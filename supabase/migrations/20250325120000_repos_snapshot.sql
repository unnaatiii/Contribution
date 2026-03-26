-- Repo snapshots per tenant (for last_synced_at + metadata).

create table if not exists repos (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  full_name text not null,
  private boolean default false,
  last_synced_at timestamptz,
  unique (user_id, full_name)
);

create index if not exists repos_user_id_idx on repos (user_id);

create index if not exists commits_user_date_idx on commits (user_id, repo, date desc);
