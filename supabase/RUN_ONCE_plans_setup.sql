-- Doreham: run this ONCE in Supabase → SQL Editor → New query → paste all → Run.
-- It creates the Doreham+ history table and the "plans on/off" switch (starts OFF = test period),
-- then tells the API to reload, so /admin/plus works right away.
-- Safe to run again (it skips what already exists).

create table if not exists public.plus_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('granted', 'extended', 'removed', 'purchased', 'renewed', 'cancelled', 'refunded')),
  source text not null default 'doreham' check (source in ('doreham', 'payment')),
  months integer,
  amount_won integer,
  ends_at timestamptz,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists plus_history_user_idx on public.plus_history (user_id, created_at desc);
alter table public.plus_history enable row level security;
drop policy if exists "Members read own plus history" on public.plus_history;
create policy "Members read own plus history" on public.plus_history for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.plus_history from anon, authenticated;

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
insert into public.app_settings (key, value) values ('plans_enforced', 'false'::jsonb) on conflict (key) do nothing;

create or replace function private.plans_enforced()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select value = 'true'::jsonb from public.app_settings where key = 'plans_enforced'), true);
$$;
revoke all on function private.plans_enforced() from public, anon, authenticated;

create or replace function private.has_plus(p_user uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select not private.plans_enforced() or exists (
    select 1 from public.profiles p
    where p.id = p_user and p.subscription_tier = 'plus'
      and (p.subscription_expires_at is null or p.subscription_expires_at > now())
  );
$$;
revoke all on function private.has_plus(uuid) from public, anon, authenticated;

create or replace function public.plan_status(p_user uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'plus', (p.subscription_tier = 'plus' and (p.subscription_expires_at is null or p.subscription_expires_at > now())),
    'expires_at', case when p.subscription_tier = 'plus' then p.subscription_expires_at end,
    'match_requests_used', private.match_requests_this_month(p.id),
    'match_requests_limit', 2,
    'enforced', private.plans_enforced()
  )
  from public.profiles p where p.id = p_user;
$$;
revoke all on function public.plan_status(uuid) from public, anon, authenticated;
grant execute on function public.plan_status(uuid) to service_role;

create or replace function public.get_plans_enforced()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select private.plans_enforced();
$$;
revoke all on function public.get_plans_enforced() from public, anon, authenticated;
grant execute on function public.get_plans_enforced() to service_role;

notify pgrst, 'reload schema';

select 'Done: plans are OFF (test period)' as result;
