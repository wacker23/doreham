-- Doreham: one-time clean-up before real users (Oct 2, 2026).
-- Run ONCE in Supabase → SQL Editor → New query → paste all → Run
-- (Supabase warns that the query is destructive: confirm).
-- Deletes every test account and its data: matches, groups, chats, quests, venues, events,
-- notifications, points/ranking, strikes, push devices and logins.
-- Keeps: the admin account (dorehamco@gmail.com), the waitlist, 1365 volunteer listings, tags and app settings.
-- There is no undo. If anything fails, nothing is deleted (one transaction).

begin;

-- Points and ranking first (the points history points at quests)
delete from public.points_ledger;
delete from public.user_points;
delete from public.leaderboard_monthly;
delete from public.weekly_leaderboard_snapshots;
delete from public.reports;
delete from public.reviews;
delete from public.perk_redemptions;

-- Match history: requests, groups and everything under them
-- (members, chat messages, quests, check-ins, reviews, availability, votes, volunteer photo records)
delete from public.match_requests;
delete from public.groups;
delete from public.quests;

-- Events (attendees, comments, reports) and venues (QR codes, venue reviews, perks, menu items)
delete from public.events;
delete from public.venues;

-- Notifications, strikes, trust stats, membership history
delete from public.notifications;
delete from public.user_penalties;
delete from public.user_trust_stats;
delete from public.plus_history;

-- Every account and login except the admin (profiles, consents, push devices, blocks… go with them)
delete from auth.users where id <> 'dc511479-3d65-4dc4-a2da-55cbca7f9456';

commit;

select
  (select count(*) from auth.users) as accounts_left,            -- 1 (the admin)
  (select email from auth.users limit 1) as admin_email,          -- dorehamco@gmail.com
  (select count(*) from public.groups) as groups_left,            -- 0
  (select count(*) from public.venues) as venues_left,            -- 0
  (select count(*) from public.waitlist) as waitlist_kept;        -- 3
