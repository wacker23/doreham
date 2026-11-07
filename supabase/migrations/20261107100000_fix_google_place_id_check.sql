-- Fix (Nov 7, 2026): the google_place_id check used the regex '^[A-Za-z0-9_-]{10,300}$', but
-- Postgres regexes allow at most 255 repetitions, so the check failed with "invalid regular
-- expression: invalid repetition count(s)" as soon as a Google place id was saved (linking a
-- Kakao Map place then failed with save_failed). Same rule, written without a repetition count.
-- Applied live on Nov 7.
alter table public.venues drop constraint if exists venues_google_place_id_check;
alter table public.venues add constraint venues_google_place_id_check
  check (google_place_id is null or (length(google_place_id) between 10 and 300 and google_place_id ~ '^[A-Za-z0-9_-]+$'));
