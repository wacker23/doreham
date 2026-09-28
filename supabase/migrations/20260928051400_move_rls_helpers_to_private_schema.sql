-- RLS helper functions live in a schema that PostgREST does not expose,
-- so they can't be called via /rest/v1/rpc/*. Policies reference functions
-- by OID, so they keep working after the move.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

alter function public.is_admin(uuid) set schema private;
alter function public.is_group_member(uuid, uuid) set schema private;
alter function public.is_quest_group_member(uuid, uuid) set schema private;
alter function public.is_venue_owner(uuid, uuid) set schema private;
alter function public.user_is_in_group(uuid, uuid) set schema private;
alter function public.users_share_quest(uuid, uuid, uuid) set schema private;
alter function public.is_user_frozen(uuid) set schema private;
alter function public.user_strike_count(uuid) set schema private;

-- Trigger functions reference these by name; repoint them.
create or replace function public.guard_profile_privileged_columns()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or private.is_admin(auth.uid()) then
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

create or replace function public.guard_venue_privileged_columns()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_count int;
begin
  if auth.uid() is null or private.is_admin(auth.uid()) then
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
  if old.deactivated_at is not null then
    new.deactivated_at := old.deactivated_at;
  end if;
  return new;
end $$;

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
  return new;
end $$;

create or replace function public.guard_match_request_insert()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or private.is_admin(auth.uid()) then
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
  return new;
end $$;

revoke execute on function public.guard_profile_privileged_columns() from public, anon, authenticated;
revoke execute on function public.guard_venue_privileged_columns() from public, anon, authenticated;
revoke execute on function public.guard_group_member_update() from public, anon, authenticated;
revoke execute on function public.guard_match_request_insert() from public, anon, authenticated;
