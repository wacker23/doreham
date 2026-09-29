-- =====================================================================
-- Event posters — Sep 29 2026
-- One optional image per event. Uploaded only through /api/events/[id]/poster
-- (service role; no storage policies for users). Public bucket so the feed can show it.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-posters', 'event-posters', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

alter table public.events add column if not exists poster_url text;
alter table public.events add column if not exists poster_path text;
