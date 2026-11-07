-- Venue map listings (Nov 7, 2026): every venue is linked to its real Kakao Map listing, so
-- no venue exists on Doreham that isn't a real place.
--
-- * venues.map_provider = 'kakao' and venues.map_provider_id = the Kakao place id (columns from
--   the baseline; unique together, so one listing can't be claimed twice).
-- * map_place_url: the Kakao Map page of the listing (shown on the venue page).
-- * listing_check: what the server compared when the listing was linked (listing name, phone,
--   address, pin and match flags). Admin/owner only, read through the server.
-- * google_place_id: the matching Google Maps place, found automatically. Google lets us keep
--   only the place id; its hours and photos are fetched live and never stored.
-- * naver_map_url: an optional link to the Naver Map page, typed by the owner.
--
-- Only the server links a listing (it checks the place with the Kakao API first). The browser
-- can't set these columns: owners insert venues, but the guard clears them.

alter table public.venues
  add column if not exists map_place_url text,
  add column if not exists listing_check jsonb,
  add column if not exists google_place_id text,
  add column if not exists naver_map_url text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'venues_map_place_url_check') then
    alter table public.venues add constraint venues_map_place_url_check
      check (map_place_url is null or map_place_url ~ '^https://place\.map\.kakao\.com/[0-9]{1,20}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'venues_google_place_id_check') then
    alter table public.venues add constraint venues_google_place_id_check
      check (google_place_id is null or google_place_id ~ '^[A-Za-z0-9_-]{10,300}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'venues_naver_map_url_check') then
    alter table public.venues add constraint venues_naver_map_url_check
      check (
        naver_map_url is null
        or (length(naver_map_url) <= 300
            and naver_map_url ~ '^https://(map\.naver\.com|m\.map\.naver\.com|naver\.me|place\.naver\.com|m\.place\.naver\.com|pcmap\.place\.naver\.com)/[^\s"<>]*$')
      );
  end if;
end $$;

-- Public columns (listing_check stays private, like the owner's contact details).
grant select (map_place_url, google_place_id, naver_map_url) on public.venues to anon, authenticated;

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
    new.latitude := null;
    new.longitude := null;
    new.location := null;
    -- The map listing is linked by the server after it checks the place.
    new.map_provider := null;
    new.map_provider_id := null;
    new.map_place_url := null;
    new.map_rating := null;
    new.map_review_count := null;
    new.listing_check := null;
    new.google_place_id := null;
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
  new.latitude := old.latitude;
  new.longitude := old.longitude;
  new.location := old.location;
  new.map_provider := old.map_provider;
  new.map_provider_id := old.map_provider_id;
  new.map_place_url := old.map_place_url;
  new.map_rating := old.map_rating;
  new.map_review_count := old.map_review_count;
  new.listing_check := old.listing_check;
  new.google_place_id := old.google_place_id;
  if old.deactivated_at is not null then
    new.deactivated_at := old.deactivated_at;
  end if;
  return new;
end $function$;

-- Paid map API calls per month (Google Places), so the app stays inside the free tier.
-- Server only: RLS on with no policies, function callable by the service role only.
create table if not exists public.api_usage (
  period text not null,
  sku text not null,
  count integer not null default 0,
  primary key (period, sku)
);
alter table public.api_usage enable row level security;
revoke all on public.api_usage from anon, authenticated;

-- Counts one call for `p_sku` this month (UTC, like Google's billing month) and returns true,
-- or returns false without counting when the month already reached `p_cap`.
create or replace function public.bump_api_usage(p_sku text, p_cap integer)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_period text := to_char(now() at time zone 'UTC', 'YYYY-MM');
  v_count integer;
begin
  if p_cap is null or p_cap <= 0 then
    return false;
  end if;
  insert into public.api_usage as u (period, sku, count)
    values (v_period, p_sku, 1)
    on conflict (period, sku) do update set count = u.count + 1
    where u.count < p_cap
    returning u.count into v_count;
  return v_count is not null;
end $function$;

revoke execute on function public.bump_api_usage(text, integer) from public, anon, authenticated;
grant execute on function public.bump_api_usage(text, integer) to service_role;
