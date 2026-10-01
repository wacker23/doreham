-- =====================================================================
-- Doreham+ membership history — Oct 1 2026
-- One row per change to someone's Doreham+ (given by Doreham now; payments later).
-- Members can read their own rows (shown on their profile); only the server writes.
-- =====================================================================
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
create policy "Members read own plus history" on public.plus_history
  for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.plus_history from anon, authenticated;
