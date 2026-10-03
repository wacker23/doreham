-- Security hardening (Oct 3, 2026 audit), part B: private columns are no longer readable from
-- the browser (anon / authenticated roles). Apply ONLY after the code from the
-- security/ship-ready branch is live: older pages read these tables with select('*') and would
-- get "permission denied".
--
-- Owners and admins still see everything through the server (service role):
--   GET /api/venues/[id] (edit form), GET /api/admin/venues (review queue).
-- Writes are unchanged (column SELECT privileges don't affect INSERT/UPDATE).

-- Venues: owner contact details, legal name and business registration number are private.
revoke select on public.venues from anon, authenticated;
grant select (
  id, owner_id, map_provider, map_provider_id, business_name_display, category,
  accepted_quest_types, address, district, city, location, map_rating, map_review_count,
  business_opened_at, description, description_en, photo_urls, hours_json, discount_offer,
  discount_offer_en, per_person_cost_won, hidden_gem_eligible, hidden_gem_evaluated_at,
  boost_until, claim_verified_at, is_active, deactivated_at, created_at, updated_at, zipcode,
  road_address, jibun_address, building_name, address_detail, latitude, longitude
) on public.venues to anon, authenticated;

-- Profiles: the exact birthday and locations stay in the database (age comes from
-- profile_age()). Profiles were never readable by anon.
revoke select on public.profiles from anon, authenticated;
grant select (
  id, role, display_name, gender, primary_language, spoken_languages, bio, photo_url,
  home_district, big_five_openness, big_five_conscientiousness, big_five_extraversion,
  big_five_agreeableness, big_five_neuroticism, big_five_completed_at, mbti_type,
  activity_preferences, interests, social_energy, phone_verified, pass_verified, kakao_linked,
  photo_verified, photo_verification_status, subscription_tier, subscription_expires_at,
  onboarding_completed, deleted_at, created_at, updated_at, zodiac_sign, exercise_frequency,
  education_level, drinking_habits, smoking_habits, children_status, job_title,
  basic_signup_completed, is_matchable, last_active_at, account_type
) on public.profiles to authenticated;

-- Trust stats: private concern tags are counted for moderation only.
revoke select on public.user_trust_stats from anon, authenticated;
grant select (user_id, total_reviews_received, compliment_counts, vibe_counts, updated_at)
  on public.user_trust_stats to authenticated;
