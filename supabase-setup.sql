-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)
-- https://supabase.com/dashboard

-- 1. Create the drinks table
create table if not exists public.drinks (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null default 'beer',
  quantity    integer not null default 0,
  last_change text,
  created_at  timestamptz default now()
);

-- 2. Enable Row Level Security
alter table public.drinks enable row level security;

-- 3. Allow full public access (the app uses PIN auth, not Supabase auth)
--    Anyone with your Supabase anon key can read/write — keep that key private.
create policy "public read" on public.drinks for select using (true);
create policy "public insert" on public.drinks for insert with check (true);
create policy "public update" on public.drinks for update using (true);
create policy "public delete" on public.drinks for delete using (true);

-- 4. Enable realtime (so both users see live updates)
alter publication supabase_realtime add table public.drinks;
