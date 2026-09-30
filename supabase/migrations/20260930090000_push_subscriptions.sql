-- =====================================================================
-- Web push subscriptions — Sep 30 2026
-- One row per browser/device that turned on notifications. Written and read only
-- by the server (service role) through /api/push/*; no policies for users on purpose.
-- The endpoint is unique: if another account signs in on the same browser and turns
-- notifications on, the row moves to that account.
-- =====================================================================
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  lang text not null default 'en' check (lang in ('en', 'ko')),
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count integer not null default 0
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
