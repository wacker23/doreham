-- =====================================================================
-- Doreham+ test mode switch — Oct 1 2026
-- app_settings.plans_enforced = false  -> everyone can use every feature (testing period)
-- app_settings.plans_enforced = true   -> Free / Doreham+ limits apply
-- Flip it on /admin/plus. Nothing else changes: memberships, history and pages stay.
-- =====================================================================
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;

insert into public.app_settings (key, value) values ('plans_enforced', 'false'::jsonb)
on conflict (key) do nothing;

-- Missing row = enforced (the safe default).
create or replace function private.plans_enforced()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select value = 'true'::jsonb from public.app_settings where key = 'plans_enforced'), true);
$$;
revoke all on function private.plans_enforced() from public, anon, authenticated;

-- "Can use Doreham+ features": everyone while plans aren't enforced, otherwise real members.
-- (Used by the match request and venue guards, unchanged.)
create or replace function private.has_plus(p_user uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select not private.plans_enforced() or exists (
    select 1 from public.profiles p
    where p.id = p_user
      and p.subscription_tier = 'plus'
      and (p.subscription_expires_at is null or p.subscription_expires_at > now())
  );
$$;
revoke all on function private.has_plus(uuid) from public, anon, authenticated;

-- plan_status: `plus` = a real Doreham+ membership; `enforced` = whether limits apply.
create or replace function public.plan_status(p_user uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'plus', (p.subscription_tier = 'plus' and (p.subscription_expires_at is null or p.subscription_expires_at > now())),
    'expires_at', case when p.subscription_tier = 'plus' then p.subscription_expires_at end,
    'match_requests_used', private.match_requests_this_month(p.id),
    'match_requests_limit', 2,
    'enforced', private.plans_enforced()
  )
  from public.profiles p
  where p.id = p_user;
$$;
revoke all on function public.plan_status(uuid) from public, anon, authenticated;
grant execute on function public.plan_status(uuid) to service_role;

-- The admin page reads/flips the switch through these (service role only).
create or replace function public.get_plans_enforced()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select private.plans_enforced();
$$;
revoke all on function public.get_plans_enforced() from public, anon, authenticated;
grant execute on function public.get_plans_enforced() to service_role;
