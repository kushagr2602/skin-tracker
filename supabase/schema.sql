-- Run this in your Supabase SQL editor at: https://supabase.com/dashboard/project/<your-project>/sql

-- Daily log: one row per user per day
create table if not exists daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  log_date date not null,
  photo_url text,
  ai_severity int check (ai_severity between 1 and 10),
  user_severity int check (user_severity between 1 and 10),
  ai_summary text,
  notes text,
  created_at timestamptz default now(),
  unique (user_id, log_date)
);

-- Diet entries for a log
create table if not exists diet_entries (
  id uuid primary key default gen_random_uuid(),
  log_id uuid references daily_logs on delete cascade not null,
  food_item text not null,
  is_trigger boolean default false
);

-- Skincare product library (per user)
create table if not exists skincare_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  category text
);

-- Which products used on which log day
create table if not exists log_skincare (
  log_id uuid references daily_logs on delete cascade not null,
  product_id uuid references skincare_products on delete cascade not null,
  primary key (log_id, product_id)
);

-- Medication/supplement library (per user)
create table if not exists medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  type text
);

-- Which meds taken on which log day
create table if not exists log_medications (
  log_id uuid references daily_logs on delete cascade not null,
  medication_id uuid references medications on delete cascade not null,
  taken boolean default true,
  primary key (log_id, medication_id)
);

-- Lifestyle factors (one per log)
create table if not exists lifestyle_factors (
  log_id uuid primary key references daily_logs on delete cascade not null,
  sleep_hours numeric(3,1),
  stress_level int check (stress_level between 1 and 10),
  exercise_minutes int,
  water_glasses int,
  menstrual_cycle_day int
);

-- Enable Row Level Security
alter table daily_logs enable row level security;
alter table diet_entries enable row level security;
alter table skincare_products enable row level security;
alter table log_skincare enable row level security;
alter table medications enable row level security;
alter table log_medications enable row level security;
alter table lifestyle_factors enable row level security;

-- RLS Policies: users can only access their own data
create policy "Users own their logs" on daily_logs
  for all using (auth.uid() = user_id);

create policy "Users own their diet entries" on diet_entries
  for all using (
    auth.uid() = (select user_id from daily_logs where id = log_id)
  );

create policy "Users own their skincare products" on skincare_products
  for all using (auth.uid() = user_id);

create policy "Users own their log_skincare" on log_skincare
  for all using (
    auth.uid() = (select user_id from daily_logs where id = log_id)
  );

create policy "Users own their medications" on medications
  for all using (auth.uid() = user_id);

create policy "Users own their log_medications" on log_medications
  for all using (
    auth.uid() = (select user_id from daily_logs where id = log_id)
  );

create policy "Users own their lifestyle_factors" on lifestyle_factors
  for all using (
    auth.uid() = (select user_id from daily_logs where id = log_id)
  );

-- Storage bucket for skin photos
insert into storage.buckets (id, name, public) values ('skin-photos', 'skin-photos', false)
  on conflict do nothing;

create policy "Users upload their own photos" on storage.objects
  for insert with check (bucket_id = 'skin-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users read their own photos" on storage.objects
  for select using (bucket_id = 'skin-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users delete their own photos" on storage.objects
  for delete using (bucket_id = 'skin-photos' and auth.uid()::text = (storage.foldername(name))[1]);
