-- Fix: PostgREST error "Could not find the 'full_analysis' column ... in the schema cache"
-- when ai_analysis existed before full_analysis was added to the app schema.
alter table ai_analysis add column if not exists full_analysis jsonb;
