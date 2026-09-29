-- =====================================================================
-- English versions of 1365 volunteer programs (Sep 29 2026)
-- 1365 only publishes Korean. Programs a group is shown are machine-translated
-- (Vercel AI Gateway) and cached here; the Korean original is always kept.
-- source_hash = hash of the Korean text that was translated, so a program whose
-- details change on 1365 gets translated again.
-- =====================================================================
alter table public.volunteer_programs add column if not exists title_en text;
alter table public.volunteer_programs add column if not exists place_en text;
alter table public.volunteer_programs add column if not exists org_name_en text;
alter table public.volunteer_programs add column if not exists description_en text;
alter table public.volunteer_programs add column if not exists category_en text;
alter table public.volunteer_programs add column if not exists translated_at timestamptz;
alter table public.volunteer_programs add column if not exists translation_source_hash text;
