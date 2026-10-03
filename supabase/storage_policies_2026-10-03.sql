-- Storage policy changes from the Oct 3, 2026 security audit.
-- storage.objects belongs to Supabase's storage role, so this can't run as a normal migration.
-- Run it once in the Supabase SQL editor; if it says "must be owner of table objects", make the
-- same changes in Dashboard → Storage → Policies (described in each comment).
--
-- Why: public buckets serve their files by URL with no policy at all, so the old
-- "Anyone can view …" SELECT policies only let anyone LIST every folder (= every user id).
-- Users keep seeing their own files (needed to replace or remove a photo), and venue photo
-- uploads must go into the uploader's own folder (before, any signed-in user could upload
-- anywhere in those buckets).

alter policy "Anyone can view menu photos" on storage.objects
  to authenticated
  using (bucket_id = 'venue-menu-photos' and (storage.foldername(name))[1] = auth.uid()::text);
alter policy "Anyone can view menu photos" on storage.objects rename to "Users see their own menu photo files";
alter policy "Anyone can view profile photos" on storage.objects
  to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
alter policy "Anyone can view profile photos" on storage.objects rename to "Users see their own profile photo files";
alter policy "Anyone can view venue photos" on storage.objects
  to authenticated
  using (bucket_id = 'venue-photos' and (storage.foldername(name))[1] = auth.uid()::text);
alter policy "Anyone can view venue photos" on storage.objects rename to "Users see their own venue photo files";

alter policy "Venue owners can upload venue photos" on storage.objects
  to authenticated
  with check (bucket_id = 'venue-photos' and (storage.foldername(name))[1] = auth.uid()::text);
alter policy "Venue owners can upload venue photos" on storage.objects rename to "Users upload venue photos to their own folder";
alter policy "Venue owners can upload menu photos" on storage.objects
  to authenticated
  with check (bucket_id = 'venue-menu-photos' and (storage.foldername(name))[1] = auth.uid()::text);
alter policy "Venue owners can upload menu photos" on storage.objects rename to "Users upload menu photos to their own folder";

