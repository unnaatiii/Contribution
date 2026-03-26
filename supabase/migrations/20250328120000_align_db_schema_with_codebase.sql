-- Align public.ai_analysis and public.analysis_runs with my-app/lib/db/index.ts
-- (saveAnalysis, batchUpsertAiAnalysis, fetchAiAnalysisCacheForRepos, saveAnalysisRun, getAnalysisRunSnapshot).
--
-- Idempotent: safe on fresh installs where 20250324120000_devimpact_ai.sql already created these columns.
-- Run: supabase db push   or paste into Supabase SQL Editor.
--
-- After applying: Supabase Dashboard → Settings → reload API schema if PostgREST still caches old columns.

-- ── ai_analysis (matches saveAnalysis / batchUpsertAiAnalysis selects & upserts) ──
alter table public.ai_analysis add column if not exists impact_score int;
alter table public.ai_analysis add column if not exists type text;
alter table public.ai_analysis add column if not exists summary text;
alter table public.ai_analysis add column if not exists full_analysis jsonb;
alter table public.ai_analysis add column if not exists model_used text;
alter table public.ai_analysis add column if not exists created_at timestamptz default now();

-- ── analysis_runs (matches saveAnalysisRun insert + getAnalysisRunSnapshot) ──
alter table public.analysis_runs
  add column if not exists result_snapshot jsonb default '{}'::jsonb;

update public.analysis_runs
set result_snapshot = '{}'::jsonb
where result_snapshot is null;

alter table public.analysis_runs alter column result_snapshot set default '{}'::jsonb;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'analysis_runs'
      and column_name = 'result_snapshot'
  )
    and not exists (select 1 from public.analysis_runs where result_snapshot is null)
  then
    alter table public.analysis_runs alter column result_snapshot set not null;
  end if;
end $$;
