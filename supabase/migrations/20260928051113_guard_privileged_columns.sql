-- 1) Make the real admin account an admin so is_admin() works (admin policies were UUID-hardcoded).
update public.profiles set role = 'admin', is_matchable = false
where id = 'dc511479-3d65-4dc4-a2da-55cbca7f9456';

-- 2) Profiles: end users may edit their own profile, but never privileged columns.
create or replace function public.guard_profile_privileged_columns()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Service role, SQL editor, cron (no end-user JWT) and admins may change anything.
  if auth.uid() is null or public.is_admin(auth.uid()) then
    return new;
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
end $$;

drop trigger if exists profiles_guard_privileged on public.profiles;
create trigger profiles_guard_privileged
  before insert or update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

-- 3) Venues: owners may edit their listing but cannot self-approve, self-boost,
--    transfer ownership, reactivate, or exceed the 2-venue limit.
create or replace function public.guard_venue_privileged_columns()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_count int;
begin
  if auth.uid() is null or public.is_admin(auth.uid()) then
    return new;
  end if;

  if tg_op = 'INSERT' then
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
  -- Owners may deactivate their own venue, but not reactivate it.
  if old.deactivated_at is not null then
    new.deactivated_at := old.deactivated_at;
  end if;
  return new;
end $$;

drop trigger if exists venues_guard_privileged on public.venues;
create trigger venues_guard_privileged
  before insert or update on public.venues
  for each row execute function public.guard_venue_privileged_columns();

-- Trigger functions are never meant to be called over the REST API.
revoke execute on function public.guard_profile_privileged_columns() from public, anon, authenticated;
revoke execute on function public.guard_venue_privileged_columns() from public, anon, authenticated;
