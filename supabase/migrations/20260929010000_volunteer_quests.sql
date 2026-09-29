-- =====================================================================
-- Volunteer quests (봉사활동) — Sep 29 2026
-- Programs come from 행정안전부_봉사참여정보서비스 (1365) and are cached here.
-- Proof of attendance = one group selfie (required) + optional 1365 certificates.
-- =====================================================================

-- ---------- 1365 program cache ----------
create table if not exists public.volunteer_programs (
  id text primary key,                         -- progrmRegistNo
  title text not null,                         -- progrmSj
  status smallint,                             -- progrmSttusSe: 1 모집대기, 2 모집중, 3 모집완료
  program_start date,                          -- progrmBgnde
  program_end date,                            -- progrmEndde
  act_begin_hour smallint,                     -- actBeginTm
  act_end_hour smallint,                       -- actEndTm
  notice_start date,                           -- noticeBgnde (모집시작일)
  notice_end date,                             -- noticeEndde (모집종료일)
  recruit_count integer,                       -- rcritNmpr (모집인원)
  applied_count integer,                       -- appTotal (신청인원수)
  act_weekdays text,                           -- actWkdy (활동요일)
  category text,                               -- srvcClCode (봉사분야)
  adult_ok boolean,                            -- adultPosblAt
  youth_ok boolean,                            -- yngbgsPosblAt
  group_ok boolean,                            -- grpPosblAt
  org_name text,                               -- mnnstNm (모집기관)
  registrar_name text,                         -- nanmmbyNm (등록기관)
  place text,                                  -- actPlace (봉사장소)
  contact_name text,
  contact_phone text,
  contact_email text,
  description text,                            -- progrmCn
  sido_code text,
  gugun_code text,
  city text,                                   -- Doreham city slug (asan, cheonan, …)
  detail_url text,                             -- 1365 page where users sign up
  raw jsonb,
  listed_at timestamptz,                       -- last time it appeared in a list sync
  detail_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_volunteer_programs_city_start on public.volunteer_programs (city, program_start);
alter table public.volunteer_programs enable row level security;
drop policy if exists "Signed-in users read volunteer programs" on public.volunteer_programs;
create policy "Signed-in users read volunteer programs" on public.volunteer_programs
  for select to authenticated using (true);
drop trigger if exists volunteer_programs_updated_at on public.volunteer_programs;
create trigger volunteer_programs_updated_at before update on public.volunteer_programs
  for each row execute function public.set_updated_at();

-- ---------- quest type ----------
alter table public.match_requests add column if not exists quest_type text not null default 'venue';
alter table public.match_requests drop constraint if exists match_requests_quest_type_check;
alter table public.match_requests add constraint match_requests_quest_type_check check (quest_type in ('venue', 'volunteer'));

alter table public.groups add column if not exists quest_type text not null default 'venue';
alter table public.groups drop constraint if exists groups_quest_type_check;
alter table public.groups add constraint groups_quest_type_check check (quest_type in ('venue', 'volunteer'));
alter table public.groups add column if not exists volunteer_signup_deadline timestamptz;
alter table public.groups add column if not exists volunteer_signup_closed_at timestamptz;

alter table public.quests add column if not exists quest_type text not null default 'venue';
alter table public.quests drop constraint if exists quests_quest_type_check;
alter table public.quests add constraint quests_quest_type_check check (quest_type in ('venue', 'volunteer'));
alter table public.quests alter column venue_id drop not null;
alter table public.quests drop constraint if exists quests_venue_required;
alter table public.quests add constraint quests_venue_required check (quest_type <> 'venue' or venue_id is not null);
alter table public.quests add column if not exists volunteer_program_id text references public.volunteer_programs(id);

-- Vote options can be (program, date) pairs; two programs may start at the same time.
alter table public.candidate_slots add column if not exists volunteer_program_id text references public.volunteer_programs(id);
alter table public.candidate_slots drop constraint if exists candidate_slots_group_id_slot_time_key;
create unique index if not exists candidate_slots_group_slot_program_key
  on public.candidate_slots (group_id, slot_time, coalesce(volunteer_program_id, ''));

-- Per-member 1365 signup confirmation
alter table public.group_members add column if not exists volunteer_signup_confirmed_at timestamptz;
alter table public.group_members add column if not exists volunteer_signup_nudged_at timestamptz;

-- Protect the new member columns from direct client edits (only last_read_at is user-editable)
create or replace function public.guard_group_member_update()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or private.is_admin(auth.uid()) then
    return new;
  end if;
  new.group_id := old.group_id;
  new.user_id := old.user_id;
  new.invited_at := old.invited_at;
  new.accepted_at := old.accepted_at;
  new.declined_at := old.declined_at;
  new.left_at := old.left_at;
  new.role_in_group := old.role_in_group;
  new.invite_state := old.invite_state;
  new.invite_expires_at := old.invite_expires_at;
  new.availability_nudge_sent_at := old.availability_nudge_sent_at;
  new.volunteer_signup_confirmed_at := old.volunteer_signup_confirmed_at;
  new.volunteer_signup_nudged_at := old.volunteer_signup_nudged_at;
  return new;
end $$;
revoke execute on function public.guard_group_member_update() from public, anon, authenticated;

-- Users choose the quest type when they request; the server owns everything else.
create or replace function public.guard_match_request_insert()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or private.is_admin(auth.uid()) then
    new.search_started_at := coalesce(new.search_started_at, now());
    return new;
  end if;
  if private.is_user_frozen(auth.uid()) then
    raise exception 'account_frozen' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.match_requests where user_id = auth.uid() and status = 'searching') then
    raise exception 'already_searching' using errcode = 'P0001';
  end if;
  new.user_id := auth.uid();
  new.status := 'searching';
  new.matched_group_id := null;
  new.resolved_at := null;
  new.attempt_count := 0;
  new.last_attempt_at := null;
  new.excluded_user_ids := array[]::uuid[];
  new.created_at := now();
  new.search_started_at := now();
  new.quest_type := coalesce(new.quest_type, 'venue');
  return new;
end $$;
revoke execute on function public.guard_match_request_insert() from public, anon, authenticated;

-- ---------- attendance proof (group selfie required, certificate optional) ----------
create table if not exists public.volunteer_proofs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,  -- uploader
  kind text not null check (kind in ('group_selfie', 'certificate')),
  storage_path text not null,
  tagged_user_ids uuid[] not null default '{}',   -- selfie: members in the photo
  latitude numeric,
  longitude numeric,
  created_at timestamptz not null default now()
);
create index if not exists idx_volunteer_proofs_group on public.volunteer_proofs (group_id);
create index if not exists idx_volunteer_proofs_quest on public.volunteer_proofs (quest_id);
alter table public.volunteer_proofs enable row level security;
drop policy if exists "Members read group proofs" on public.volunteer_proofs;
create policy "Members read group proofs" on public.volunteer_proofs
  for select to authenticated
  using (user_id = auth.uid() or private.user_is_in_group(group_id, auth.uid()) or private.is_admin(auth.uid()));
-- Inserts go through /api/volunteer/proof (service role) only.

-- Private bucket: photos of people are never public. Files are served via short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('volunteer-proofs', 'volunteer-proofs', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do nothing;
