-- Org webhook: map GitHub org → tenant user_id, AI batch queue, commit ingest time for polls.

create table if not exists github_org_tenant_map (
  org_login text primary key,
  user_id text not null,
  note text,
  created_at timestamptz default now()
);

create index if not exists github_org_tenant_map_user_id_idx on github_org_tenant_map (user_id);

create table if not exists tenant_ai_queue (
  user_id text primary key,
  pending_count int not null default 0,
  last_batch_started_at timestamptz,
  last_batch_completed_at timestamptz,
  ai_batch_version int not null default 0
);

alter table commits
  add column if not exists ingested_at timestamptz default now();

update commits set ingested_at = coalesce(ingested_at, date, now()) where ingested_at is null;

create index if not exists commits_user_ingested_idx on commits (user_id, ingested_at desc);

create or replace function increment_tenant_ai_pending(p_user_id text, p_delta int)
returns void
language plpgsql
as $$
begin
  if p_delta <= 0 then
    return;
  end if;
  insert into tenant_ai_queue (user_id, pending_count)
  values (p_user_id, p_delta)
  on conflict (user_id) do update
  set pending_count = tenant_ai_queue.pending_count + excluded.pending_count;
end;
$$;

create or replace function complete_tenant_ai_batch(p_user_id text)
returns int
language plpgsql
as $$
declare
  v_next int;
begin
  insert into tenant_ai_queue (user_id, pending_count, last_batch_completed_at, ai_batch_version)
  values (p_user_id, 0, now(), 1)
  on conflict (user_id) do update
  set
    pending_count = 0,
    last_batch_completed_at = now(),
    ai_batch_version = tenant_ai_queue.ai_batch_version + 1
  returning tenant_ai_queue.ai_batch_version into v_next;
  return coalesce(v_next, 0);
end;
$$;
