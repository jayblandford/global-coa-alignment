-- Global COA Alignment demo: shared state table.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

create table if not exists public.demo_state (
  id         text primary key,
  state      jsonb not null,
  updated_at timestamptz not null default now(),
  constraint demo_state_id check (id = 'wave1'),
  constraint demo_state_size check (octet_length(state::text) < 3000000)
);

-- Row-level security: the public (anon/publishable) key may read and write only the single demo row.
alter table public.demo_state enable row level security;

drop policy if exists "demo read" on public.demo_state;
drop policy if exists "demo insert" on public.demo_state;
drop policy if exists "demo update" on public.demo_state;

create policy "demo read"   on public.demo_state for select to anon using (id = 'wave1');
create policy "demo insert" on public.demo_state for insert to anon with check (id = 'wave1');
create policy "demo update" on public.demo_state for update to anon using (id = 'wave1') with check (id = 'wave1');
-- No delete policy: visitors cannot delete. The nightly job below runs as the database owner.

-- Server sets the timestamp so clients cannot fake it.
create or replace function public.demo_state_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists demo_state_touch on public.demo_state;
create trigger demo_state_touch before insert or update on public.demo_state
  for each row execute function public.demo_state_touch();

-- Nightly reset at 07:00 UTC (2–3am US Eastern). The next visitor re-seeds fresh demo data.
create extension if not exists pg_cron;
select cron.unschedule('reset-coa-demo') where exists (select 1 from cron.job where jobname = 'reset-coa-demo');
select cron.schedule('reset-coa-demo', '0 7 * * *', $$delete from public.demo_state$$);
