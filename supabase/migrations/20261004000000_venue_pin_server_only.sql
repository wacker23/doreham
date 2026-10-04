-- Venue map pins (latitude / longitude / location) are what QR check-in measures members' GPS
-- against, so only the server sets them (address lookup or an admin in /admin/venues).
-- Owners already can't update venues from the browser (RLS: admin only); this also stops them
-- from choosing a pin when they create the venue.

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
  if old.deactivated_at is not null then
    new.deactivated_at := old.deactivated_at;
  end if;
  return new;
end $function$;
