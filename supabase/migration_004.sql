-- migration_004: signal capture + improvement-agent backlog
-- Run this in your Supabase SQL editor.

-- Real user feedback (the signal the improvement agents reason about)
create table if not exists app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  sentiment text,            -- 'helpful' | 'not_helpful' | 'idea'
  message text not null,
  page text,                 -- where it was submitted from
  created_at timestamptz default now()
);

-- Improvement proposals produced by the agent pipeline
create table if not exists suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  rationale text,            -- why the agent proposed this
  category text,             -- e.g. 'logging' | 'insights' | 'onboarding'
  impact text,               -- 'low' | 'medium' | 'high'
  effort text,               -- 'low' | 'medium' | 'high'
  status text default 'new', -- 'new' | 'done' | 'dismissed'
  source text,               -- short note on which signals drove it
  created_at timestamptz default now()
);

alter table app_feedback enable row level security;
alter table suggestions enable row level security;

create policy "Users own their feedback" on app_feedback
  for all using (auth.uid() = user_id);

create policy "Users own their suggestions" on suggestions
  for all using (auth.uid() = user_id);
