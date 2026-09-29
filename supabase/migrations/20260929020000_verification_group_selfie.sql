-- Volunteer quests are verified by a tagged group selfie (not a venue QR scan).
alter type public.verification_method add value if not exists 'group_selfie';
