-- Match requests need a finished friend profile (venue-only accounts and half-finished sign-ups
-- can't be matched anyway, so their request would only sit there). Same function as before plus
-- the finish_onboarding check.
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
