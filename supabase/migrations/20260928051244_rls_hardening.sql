-- =====================================================================
-- RLS hardening (Sep 28 2026)
-- =====================================================================

-- ---------- 1. Admin policies: hardcoded UUID -> is_admin() ----------
drop policy if exists "Admin sees all submissions" on public.availability_submissions;
create policy "Admin sees all submissions" on public.availability_submissions for select to authenticated using (public.is_admin(auth.uid()));

drop policy if exists "Admin sees all candidates" on public.candidate_slots;
create policy "Admin sees all candidates" on public.candidate_slots for select to authenticated using (public.is_admin(auth.uid()));

drop policy if exists "Admin can delete group members" on public.group_members;
drop policy if exists "Admin can insert group members" on public.group_members;
drop policy if exists "Admin can see all group members" on public.group_members;
create policy "Admin manages group members" on public.group_members for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "Admin can delete groups" on public.groups;
drop policy if exists "Admin can insert groups" on public.groups;
drop policy if exists "Admin can see all groups" on public.groups;
drop policy if exists "Admin can update groups" on public.groups;
create policy "Admin manages groups" on public.groups for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "Admin sees all requests" on public.match_requests;
drop policy if exists "Admin updates any request" on public.match_requests;
create policy "Admin manages requests" on public.match_requests for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "Admin can see all messages" on public.messages;
create policy "Admin reads all messages" on public.messages for select to authenticated using (public.is_admin(auth.uid()));
drop policy if exists "Users can edit messages" on public.messages;
create policy "Users can edit messages" on public.messages for update to authenticated
  using (((sender_id = auth.uid()) and (created_at > (now() - interval '15 minutes'))) or public.is_admin(auth.uid()))
  with check ((sender_id = auth.uid()) or public.is_admin(auth.uid()));

drop policy if exists "Admin can see all profiles" on public.profiles;
drop policy if exists "Admins read all profiles" on public.profiles;
create policy "Admins read all profiles" on public.profiles for select to authenticated using (public.is_admin(auth.uid()));

drop policy if exists "Admin can insert quest menu items" on public.quest_menu_items;
create policy "Admin inserts quest menu items" on public.quest_menu_items for insert to authenticated with check (public.is_admin(auth.uid()));

drop policy if exists "Admin can insert quests" on public.quests;
drop policy if exists "Admin can see all quests" on public.quests;
drop policy if exists "Admin can update quests" on public.quests;
create policy "Admin manages quests" on public.quests for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "Admin inserts penalties" on public.user_penalties;
drop policy if exists "Admin sees all penalties" on public.user_penalties;
create policy "Admin manages penalties" on public.user_penalties for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "Admin can see all menu items" on public.venue_menu_items;

drop policy if exists "Admin can delete any venue" on public.venues;
drop policy if exists "Admin can see all venues" on public.venues;
drop policy if exists "Admin can update any venue" on public.venues;

-- ---------- 2. Policies that used helper functions for role "public" -> authenticated ----------
-- (so anon never needs EXECUTE on the SECURITY DEFINER helpers)
drop policy if exists "Members read own membership" on public.group_members;
create policy "Members read own membership" on public.group_members for select to authenticated
  using ((user_id = auth.uid()) or public.is_group_member(group_id, auth.uid()));

drop policy if exists "Members read own groups" on public.groups;
create policy "Members read own groups" on public.groups for select to authenticated
  using (public.is_group_member(id, auth.uid()));

drop policy if exists "Users read own points" on public.points_ledger;
create policy "Users read own points" on public.points_ledger for select to authenticated
  using ((user_id = auth.uid()) or public.is_admin(auth.uid()));

drop policy if exists "Group members see checkins" on public.quest_checkins;
create policy "Group members see checkins" on public.quest_checkins for select to authenticated
  using ((user_id = auth.uid()) or public.is_quest_group_member(quest_id, auth.uid()) or public.is_admin(auth.uid()));
drop policy if exists "Users check themselves in" on public.quest_checkins;

drop policy if exists "Group members read quest" on public.quests;
create policy "Group members read quest" on public.quests for select to authenticated
  using (public.is_group_member(group_id, auth.uid()) or public.is_venue_owner(venue_id, auth.uid()));

drop policy if exists "Reporters read own reports" on public.reports;
create policy "Reporters read own reports" on public.reports for select to authenticated
  using ((reporter_id = auth.uid()) or public.is_admin(auth.uid()));
drop policy if exists "Users file reports" on public.reports;
create policy "Users file reports" on public.reports for insert to authenticated with check (reporter_id = auth.uid());

drop policy if exists "Read review tags" on public.review_tags;
create policy "Read review tags" on public.review_tags for select to authenticated using (true);

drop policy if exists "Reviewee reads own reviews" on public.reviews;
create policy "Reviewee reads own reviews" on public.reviews for select to authenticated
  using ((reviewee_id = auth.uid()) or (reviewer_id = auth.uid()) or public.is_admin(auth.uid()));
drop policy if exists "Users write reviews" on public.reviews;

drop policy if exists "Users manage own blocks" on public.user_blocks;
create policy "Users manage own blocks" on public.user_blocks for all to authenticated
  using ((blocker_id = auth.uid()) or public.is_admin(auth.uid()))
  with check ((blocker_id = auth.uid()) or public.is_admin(auth.uid()));

drop policy if exists "Read leaderboard" on public.weekly_leaderboard_snapshots;
create policy "Read leaderboard" on public.weekly_leaderboard_snapshots for select to authenticated using (true);

-- Venues: anon sees active venues only (no function call); owners/admins see and manage their own.
drop policy if exists "Read active venues" on public.venues;
create policy "Read active venues" on public.venues for select to anon, authenticated using (is_active = true and deactivated_at is null);
drop policy if exists "Owners manage own venues" on public.venues;
create policy "Owners manage own venues" on public.venues for all to authenticated
  using ((owner_id = auth.uid()) or public.is_admin(auth.uid()))
  with check ((owner_id = auth.uid()) or public.is_admin(auth.uid()));

-- Menu items: owners manage their own (was role public + missing WITH CHECK).
drop policy if exists "Venue owners can manage their menu items" on public.venue_menu_items;
create policy "Venue owners can manage their menu items" on public.venue_menu_items for all to authenticated
  using (public.is_venue_owner(venue_id, auth.uid()) or public.is_admin(auth.uid()))
  with check (public.is_venue_owner(venue_id, auth.uid()) or public.is_admin(auth.uid()));

-- ---------- 3. Venue QR codes: never public ----------
drop policy if exists venue_qr_codes_select on public.venue_qr_codes;
create policy "Owners read own venue QR" on public.venue_qr_codes for select to authenticated
  using (public.is_venue_owner(venue_id, auth.uid()) or public.is_admin(auth.uid()));

-- ---------- 4. Group membership: users may only touch last_read_at on their own row ----------
drop policy if exists "Users update own group membership" on public.group_members;
create policy "Users update own read marker" on public.group_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.guard_group_member_update()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or public.is_admin(auth.uid()) then
    return new;
  end if;
  -- End users can only move their read marker. Everything else is server-controlled.
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
  return new;
end $$;
drop trigger if exists group_members_guard_update on public.group_members;
create trigger group_members_guard_update before update on public.group_members
  for each row execute function public.guard_group_member_update();

-- ---------- 5. Match requests: users insert only; server controls lifecycle ----------
drop policy if exists "Users update own requests" on public.match_requests;

create or replace function public.guard_match_request_insert()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or public.is_admin(auth.uid()) then
    return new;
  end if;
  if public.is_user_frozen(auth.uid()) then
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
  return new;
end $$;
drop trigger if exists match_requests_guard_insert on public.match_requests;
create trigger match_requests_guard_insert before insert on public.match_requests
  for each row execute function public.guard_match_request_insert();

-- ---------- 6. Break-the-Ice progress is written by the server only ----------
drop policy if exists progress_update_members on public.group_question_progress;

-- ---------- 7. Views: run with the caller's permissions, never readable by anon ----------
alter view public.public_profiles set (security_invoker = true);
alter view public.profile_top_tags set (security_invoker = true);
alter view public.unread_message_counts set (security_invoker = true);
revoke all on public.public_profiles, public.profile_top_tags, public.unread_message_counts from anon;

-- ---------- 8. Functions: pin search_path, restrict EXECUTE ----------
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.evaluate_hidden_gem_status() set search_path = public, pg_temp;
alter function public.cleanup_stale_typing() set search_path = public, pg_temp;
alter function public.user_is_in_group(uuid, uuid) set search_path = public, pg_temp;
alter function public.is_user_frozen(uuid) set search_path = public, pg_temp;
alter function public.user_strike_count(uuid) set search_path = public, pg_temp;

-- Trigger / event-trigger / maintenance functions: nobody calls these over REST.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.evaluate_hidden_gem_status() from public, anon, authenticated;
revoke execute on function public.cleanup_stale_typing() from public, anon, authenticated;
revoke execute on function public.guard_group_member_update() from public, anon, authenticated;
revoke execute on function public.guard_match_request_insert() from public, anon, authenticated;

-- RLS helper functions: needed by signed-in users' policies, never by anon.
revoke execute on function public.is_admin(uuid) from public, anon;
revoke execute on function public.is_group_member(uuid, uuid) from public, anon;
revoke execute on function public.is_quest_group_member(uuid, uuid) from public, anon;
revoke execute on function public.is_venue_owner(uuid, uuid) from public, anon;
revoke execute on function public.user_is_in_group(uuid, uuid) from public, anon;
revoke execute on function public.users_share_quest(uuid, uuid, uuid) from public, anon;
revoke execute on function public.is_user_frozen(uuid) from public, anon;
revoke execute on function public.user_strike_count(uuid) from public, anon;
grant execute on function public.is_admin(uuid), public.is_group_member(uuid, uuid), public.is_quest_group_member(uuid, uuid),
  public.is_venue_owner(uuid, uuid), public.user_is_in_group(uuid, uuid), public.users_share_quest(uuid, uuid, uuid),
  public.is_user_frozen(uuid), public.user_strike_count(uuid) to authenticated, service_role;

-- ---------- 9. Realtime: tables the UI already subscribes to but were never published ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='availability_submissions') then
    alter publication supabase_realtime add table public.availability_submissions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='date_votes') then
    alter publication supabase_realtime add table public.date_votes;
  end if;
end $$;
