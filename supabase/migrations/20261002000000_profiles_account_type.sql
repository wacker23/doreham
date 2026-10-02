-- Venue owners can sign up without the friend profile (languages, MBTI, quiz...).
-- member = joined to meet people (friend profile required)
-- venue  = signed up only to list a venue; becomes a member when they finish the friend profile.
alter table public.profiles
  add column if not exists account_type text not null default 'member'
  constraint profiles_account_type_check check (account_type in ('member', 'venue'));
comment on column public.profiles.account_type is 'member = joined to meet people (friend profile required); venue = signed up only to list a venue (no friend profile until they choose to make one).';
