-- Security hardening (Oct 3, 2026 audit), part A.
-- Everything here works with both the old and the new app code, so it can go live first.
-- Part B (20261003000100_hide_private_columns.sql) needs the new code deployed first.

-- ---------------------------------------------------------------------------
-- 1. Venues: owners create venues from the browser, but every later edit goes through
--    /api/venues/[id] (checks, re-review, file ownership). Direct UPDATE/DELETE is gone.
-- ---------------------------------------------------------------------------
-- (Policies are altered/renamed rather than dropped and re-created.)
alter policy "Owners manage own venues" on public.venues
  to authenticated
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));
alter policy "Owners manage own venues" on public.venues rename to "Admin manages venues";
create policy "Owners read own venues" on public.venues
  for select to authenticated
  using (owner_id = auth.uid() or private.is_admin(auth.uid()));
create policy "Owners create venues" on public.venues
  for insert to authenticated
  with check (owner_id = auth.uid());

-- One "submitted" email per venue (the route claims this column atomically).
alter table public.venues add column if not exists submitted_email_sent_at timestamptz;

-- Length limits (the forms and the API already stay below these).
alter table public.venues
  add constraint venues_text_lengths check (
    char_length(coalesce(business_name_display, '')) <= 100
    and char_length(coalesce(business_name_legal, '')) <= 150
    and char_length(coalesce(contact_email, '')) <= 254
    and char_length(coalesce(contact_phone, '')) <= 40
    and char_length(coalesce(contact_name, '')) <= 80
    and char_length(coalesce(address, '')) <= 400
    and char_length(coalesce(description, '')) <= 2000
    and char_length(coalesce(description_en, '')) <= 2000
    and char_length(coalesce(discount_offer, '')) <= 300
    and char_length(coalesce(discount_offer_en, '')) <= 300
    and coalesce(cardinality(photo_urls), 0) <= 10
  ) not valid;
alter table public.venues validate constraint venues_text_lengths;

-- Insert guard: the server sets created_at (it gates the submitted email), and only photos
-- uploaded to the owner's own folder in our venue-photos bucket are kept.
create or replace function public.guard_venue_privileged_columns()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_count int;
begin
  if auth.uid() is null or private.is_admin(auth.uid()) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if not private.has_plus(auth.uid()) then
      raise exception 'plus_required' using errcode = 'P0001';
    end if;
    select count(*) into v_count from public.venues
      where owner_id = auth.uid() and deactivated_at is null;
    if v_count >= 2 then
      raise exception 'venue_limit_reached' using errcode = 'P0001';
    end if;
    new.owner_id := auth.uid();
    new.is_active := false;
    new.claim_verified_at := null;
    new.hidden_gem_eligible := false;
    new.hidden_gem_evaluated_at := null;
    new.boost_until := null;
    new.deactivated_at := null;
    new.created_at := now();
    new.submitted_email_sent_at := null;
    new.photo_urls := coalesce((
      select array_agg(u)
      from (
        select u from unnest(coalesce(new.photo_urls, '{}'::text[])) as u
        where u ~ ('^https://wuqfjeonhwglqjcrznvu\.supabase\.co/storage/v1/object/public/venue-photos/' || auth.uid()::text || '/')
        limit 10
      ) x
    ), '{}'::text[]);
    return new;
  end if;
  new.owner_id := old.owner_id;
  new.is_active := old.is_active;
  new.claim_method := old.claim_method;
  new.claim_verified_at := old.claim_verified_at;
  new.hidden_gem_eligible := old.hidden_gem_eligible;
  new.hidden_gem_evaluated_at := old.hidden_gem_evaluated_at;
  new.boost_until := old.boost_until;
  new.created_at := old.created_at;
  new.submitted_email_sent_at := old.submitted_email_sent_at;
  if old.deactivated_at is not null then
    new.deactivated_at := old.deactivated_at;
  end if;
  return new;
end $function$;

-- Menu items: owners add them while registering; later edits go through the API.
alter policy "Venue owners can manage their menu items" on public.venue_menu_items
  to authenticated
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));
alter policy "Venue owners can manage their menu items" on public.venue_menu_items rename to "Admin manages menu items";
create policy "Owners add menu items" on public.venue_menu_items
  for insert to authenticated
  with check (private.is_venue_owner(venue_id, auth.uid()));

create or replace function public.guard_menu_item_insert()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null or private.is_admin(auth.uid()) then
    return new;
  end if;
  if new.photo_url is not null
     and new.photo_url !~ ('^https://wuqfjeonhwglqjcrznvu\.supabase\.co/storage/v1/object/public/venue-menu-photos/' || auth.uid()::text || '/') then
    new.photo_url := null;
  end if;
  new.name := left(coalesce(new.name, ''), 80);
  new.name_en := left(new.name_en, 80);
  new.description := left(new.description, 300);
  return new;
end $function$;
create or replace trigger venue_menu_items_guard_insert before insert on public.venue_menu_items
  for each row execute function public.guard_menu_item_insert();
revoke execute on function public.guard_menu_item_insert() from public, anon, authenticated;

-- One check-in code per venue per day (concurrent first loads used to create two).
create unique index if not exists venue_qr_codes_venue_day on public.venue_qr_codes (venue_id, valid_date);

-- ---------------------------------------------------------------------------
-- 2. Reviews and trust stats: who wrote a venue review and private concern tags stay private.
-- ---------------------------------------------------------------------------
alter policy venue_reviews_public on public.venue_reviews
  to authenticated
  using (reviewer_id = auth.uid() or private.is_admin(auth.uid()));
alter policy venue_reviews_public on public.venue_reviews rename to "Reviewers read own venue reviews";

alter policy trust_stats_public on public.user_trust_stats
  to authenticated
  using (true);
alter policy trust_stats_public on public.user_trust_stats rename to "Signed-in users read trust stats";

-- ---------------------------------------------------------------------------
-- 3. Chat messages: an edit can change the text only, within the 15-minute window.
--    (Before, the sender could move a message to another group, un-hide it or backdate it.)
-- ---------------------------------------------------------------------------
create or replace function public.guard_message_write()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null or private.is_admin(auth.uid()) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.reply_to_id is not null and not exists (
      select 1 from public.messages m where m.id = new.reply_to_id and m.group_id = new.group_id
    ) then
      new.reply_to_id := null;
    end if;
    if char_length(coalesce(new.content, '')) > 2000 then
      raise exception 'message_too_long' using errcode = 'P0001';
    end if;
    new.is_hidden := false;
    new.hidden_at := null;
    new.hidden_reason := null;
    new.edited_at := null;
    new.created_at := now();
    return new;
  end if;
  new.id := old.id;
  new.group_id := old.group_id;
  new.sender_id := old.sender_id;
  new.message_type := old.message_type;
  new.metadata := old.metadata;
  new.reply_to_id := old.reply_to_id;
  new.is_hidden := old.is_hidden;
  new.hidden_at := old.hidden_at;
  new.hidden_reason := old.hidden_reason;
  new.created_at := old.created_at;
  if char_length(coalesce(new.content, '')) = 0 or char_length(new.content) > 2000 then
    raise exception 'bad_message' using errcode = 'P0001';
  end if;
  new.edited_at := now();
  return new;
end $function$;
create or replace trigger messages_guard_write before insert or update on public.messages
  for each row execute function public.guard_message_write();
revoke execute on function public.guard_message_write() from public, anon, authenticated;

-- Notifications are marked read/dismissed through /api/notifications (server); the browser
-- never needs to update them, so it can't rewrite their links either.
alter policy notifications_update_own on public.notifications
  to authenticated
  using (false);
alter policy notifications_update_own on public.notifications rename to "No direct notification updates";

-- ---------------------------------------------------------------------------
-- 4. Profiles
-- ---------------------------------------------------------------------------
-- A declined invite no longer gives lasting access to the other person's profile.
alter policy "Users can see group members profiles" on public.profiles
  to authenticated
  using (exists (
    select 1
    from public.group_members gm1
    join public.group_members gm2 on gm1.group_id = gm2.group_id
    where gm1.user_id = auth.uid()
      and gm2.user_id = profiles.id
      and gm1.declined_at is null
      and gm2.declined_at is null
  ));

-- Age for the profile page (the exact birthday is hidden from the browser in part B).
create or replace function public.profile_age(p_user uuid)
 returns integer
 language sql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select extract(year from age(p.date_of_birth))::int
  from public.profiles p
  where p.id = p_user
    and p.deleted_at is null
    and p.date_of_birth is not null
    and (
      p_user = auth.uid()
      or private.is_admin(auth.uid())
      or exists (
        select 1
        from public.group_members gm1
        join public.group_members gm2 on gm1.group_id = gm2.group_id
        where gm1.user_id = auth.uid() and gm2.user_id = p_user
          and gm1.declined_at is null and gm2.declined_at is null
      )
    )
$function$;
revoke execute on function public.profile_age(uuid) from public, anon;
grant execute on function public.profile_age(uuid) to authenticated;

-- Profile photo: only our own storage folder or the Google/Kakao sign-in avatar
-- (stops tracking-pixel URLs that would log the IP of everyone viewing the profile).
create or replace function public.guard_profile_privileged_columns()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null or private.is_admin(auth.uid()) then
    return new;
  end if;
  if new.photo_url is not null
     and new.photo_url !~ ('^https://wuqfjeonhwglqjcrznvu\.supabase\.co/storage/v1/object/public/profile-photos/' || auth.uid()::text || '/')
     and new.photo_url !~ '^https://(lh[0-9]\.googleusercontent\.com|[a-z0-9-]+\.kakaocdn\.net)/' then
    if tg_op = 'INSERT' then
      raise exception 'bad_photo_url' using errcode = 'P0001';
    elsif new.photo_url is distinct from old.photo_url then
      raise exception 'bad_photo_url' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'INSERT' then
    new.role := 'user';
    new.subscription_tier := 'free';
    new.subscription_expires_at := null;
    new.phone_verified := false;
    new.pass_verified := false;
    new.photo_verified := false;
    new.photo_verification_status := 'unverified';
    new.kakao_linked := false;
    new.deleted_at := null;
    return new;
  end if;
  new.id := old.id;
  new.role := old.role;
  new.subscription_tier := old.subscription_tier;
  new.subscription_expires_at := old.subscription_expires_at;
  new.phone_verified := old.phone_verified;
  new.pass_verified := old.pass_verified;
  new.photo_verified := old.photo_verified;
  new.photo_verification_status := old.photo_verification_status;
  new.kakao_linked := old.kakao_linked;
  new.deleted_at := old.deleted_at;
  new.created_at := old.created_at;
  return new;
end $function$;

-- ---------------------------------------------------------------------------
-- 5. Match requests: at most 5 in 24 hours, whatever the plan.
--    (Request → match → cancel could otherwise be looped to spam people with invites.)
-- ---------------------------------------------------------------------------
create or replace function public.guard_match_request_insert()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  -- Normalise cities for everyone: lowercase slugs, no duplicates, `city` = first choice.
  if new.cities is null or cardinality(new.cities) = 0 then
    new.cities := case when new.city is null then null else array[lower(new.city)] end;
  else
    new.cities := (
      select array_agg(c order by first_pos)
      from (
        select lower(trim(x)) as c, min(ord) as first_pos
        from unnest(new.cities) with ordinality as t(x, ord)
        where lower(trim(x)) ~ '^[a-z]{2,20}$'
        group by lower(trim(x))
      ) d
    );
  end if;
  if new.cities is not null and cardinality(new.cities) > 3 then
    new.cities := new.cities[1:3];
  end if;
  new.city := new.cities[1];

  if auth.uid() is null or private.is_admin(auth.uid()) then
    new.search_started_at := coalesce(new.search_started_at, now());
    return new;
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and onboarding_completed) then
    raise exception 'finish_onboarding' using errcode = 'P0001';
  end if;
  if private.is_user_frozen(auth.uid()) then
    raise exception 'account_frozen' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.match_requests where user_id = auth.uid() and status = 'searching') then
    raise exception 'already_searching' using errcode = 'P0001';
  end if;
  if (select count(*) from public.match_requests
      where user_id = auth.uid() and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;
  if coalesce(new.quest_type, 'venue') = 'volunteer' and not private.has_consent(auth.uid(), 'volunteer_photos') then
    raise exception 'consent_required' using errcode = 'P0001';
  end if;

  -- Free plan
  if not private.has_plus(auth.uid()) then
    new.group_size := null; -- random size
    if coalesce(new.quest_type, 'venue') <> 'volunteer' then
      new.preferred_categories := null; -- any category
      if private.match_requests_this_month(auth.uid()) >= 2 then
        raise exception 'monthly_limit' using errcode = 'P0001';
      end if;
    end if;
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
end $function$;

-- ---------------------------------------------------------------------------
-- 6. Storage policies live in supabase/storage_policies_2026-10-03.sql: storage.objects is owned
--    by Supabase's storage role, so they are changed from the dashboard (Storage → Policies)
--    or that file is run in the SQL editor by the project owner.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 7. Waitlist (anyone can sign up): sane emails, one row per address.
-- ---------------------------------------------------------------------------
alter table public.waitlist
  add constraint waitlist_email_format check (
    char_length(email) <= 254
    and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    and char_length(coalesce(source, '')) <= 50
    and char_length(coalesce(preferred_city, '')) <= 50
    and char_length(coalesce(primary_language, '')) <= 10
    and char_length(coalesce(notes, '')) <= 500
  ) not valid;
alter table public.waitlist validate constraint waitlist_email_format;
create unique index if not exists waitlist_email_unique on public.waitlist (lower(email));
