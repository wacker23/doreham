-- Doreham baseline schema snapshot
-- Generated 2026-09-28 from live Supabase project wuqfjeonhwglqjcrznvu (ap-northeast-2)
-- This captures the schema as it existed BEFORE the Sep 28 hardening migrations.
-- It is a reference/bootstrap file for new environments (staging, local). Do NOT re-run against production.

-- ============ EXTENSIONS ============
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ============ ENUM TYPES ============
CREATE TYPE public.activity_category AS ENUM ('conversation_coffee', 'board_games_casual', 'workshops_creative', 'active_outdoor', 'food_dining', 'learning_culture', 'nature_calm', 'escape_puzzles', 'movies_music_shows', 'career_networking', 'volunteering_community', 'nightlife_social');
CREATE TYPE public.children_status_type AS ENUM ('no_children', 'have_children', 'expecting', 'prefer_not_to_say');
CREATE TYPE public.drinking_habits_type AS ENUM ('no', 'occasionally', 'socially', 'regularly', 'prefer_not_to_say');
CREATE TYPE public.education_level_type AS ENUM ('high_school', 'college_student', 'bachelors', 'masters', 'doctoral', 'other');
CREATE TYPE public.exercise_frequency_type AS ENUM ('never', 'occasionally', 'weekly_1_2', 'weekly_3_4', 'daily');
CREATE TYPE public.gender_identity AS ENUM ('female', 'male', 'non_binary', 'prefer_not_to_say');
CREATE TYPE public.group_phase_type AS ENUM ('availability', 'voting', 'scheduled', 'cancelled', 'completed');
CREATE TYPE public.group_status AS ENUM ('proposed', 'forming', 'active', 'completed', 'expired', 'dissolved');
CREATE TYPE public.match_request_status AS ENUM ('searching', 'matched', 'no_match_found', 'cancelled_by_user', 'expired');
CREATE TYPE public.member_invite_state AS ENUM ('invited', 'accepted', 'declined', 'expired');
CREATE TYPE public.message_type AS ENUM ('user_text', 'system_notice', 'quest_proposal', 'schedule_poll', 'reminder');
CREATE TYPE public.notification_type AS ENUM ('match_invite', 'match_activated', 'match_cancelled', 'availability_reminder', 'check_in_reminder', 'quest_day_reminder', 'review_reminder', 'strike_issued', 'welcome');
CREATE TYPE public.penalty_reason AS ENUM ('cancelled_match', 'no_show', 'reported_behavior');
CREATE TYPE public.quest_status AS ENUM ('proposed', 'scheduled', 'completed', 'no_show', 'cancelled');
CREATE TYPE public.question_set AS ENUM ('warmup', 'getting_real', 'deep', 'depths');
CREATE TYPE public.report_status AS ENUM ('open', 'in_review', 'resolved', 'dismissed');
CREATE TYPE public.review_tag_type AS ENUM ('positive_public', 'neutral_private', 'concern_private');
CREATE TYPE public.smoking_habits_type AS ENUM ('non_smoker', 'occasionally', 'regular', 'former', 'vape', 'prefer_not_to_say');
CREATE TYPE public.social_energy_pref AS ENUM ('wants_conversation_starter', 'matches_my_energy', 'no_preference');
CREATE TYPE public.subscription_tier AS ENUM ('free', 'plus', 'venue_pro', 'venue_boost');
CREATE TYPE public.user_role AS ENUM ('user', 'venue_owner', 'admin');
CREATE TYPE public.venue_category AS ENUM ('cafe', 'restaurant', 'board_game_cafe', 'escape_room', 'bookshop', 'workshop_creative', 'active_sports', 'cultural_venue', 'nature_outdoor', 'music_movie', 'other');
CREATE TYPE public.venue_claim_method AS ENUM ('business_registration', 'phone_callback', 'postcard', 'admin_manual');
CREATE TYPE public.verification_method AS ENUM ('qr_scan', 'owner_manual', 'admin_override');
CREATE TYPE public.verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');

-- ============ TABLES ============
CREATE TABLE public.availability_submissions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  slots jsonb DEFAULT '[]'::jsonb NOT NULL,
  submitted_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.candidate_slots (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  group_id uuid NOT NULL,
  slot_time timestamp with time zone NOT NULL,
  available_user_ids uuid[] NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.conversation_questions (
  id text NOT NULL,
  set_name question_set NOT NULL,
  text_en text NOT NULL,
  text_ko text NOT NULL,
  is_aron_original boolean DEFAULT false NOT NULL,
  display_order integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.date_votes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  candidate_slot_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.group_members (
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  invited_at timestamp with time zone DEFAULT now() NOT NULL,
  accepted_at timestamp with time zone,
  declined_at timestamp with time zone,
  left_at timestamp with time zone,
  role_in_group text,
  last_read_at timestamp with time zone,
  invite_state member_invite_state,
  invite_expires_at timestamp with time zone,
  availability_nudge_sent_at timestamp with time zone
);

CREATE TABLE public.group_question_progress (
  group_id uuid NOT NULL,
  set_1_complete_at timestamp with time zone,
  set_2_complete_at timestamp with time zone,
  set_3_complete_at timestamp with time zone,
  set_4_complete_at timestamp with time zone,
  set_4_warning_acknowledged_at timestamp with time zone,
  set_1_question_ids text[],
  set_2_question_ids text[],
  set_3_question_ids text[],
  set_4_question_ids text[],
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.group_read_state (
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  last_read_message_id uuid,
  last_read_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.groups (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  status group_status DEFAULT 'proposed'::group_status NOT NULL,
  city text NOT NULL,
  centroid_location extensions.geography(Point,4326),
  shared_categories activity_category[] DEFAULT '{}'::activity_category[] NOT NULL,
  match_score numeric(5,4),
  proposed_at timestamp with time zone DEFAULT now() NOT NULL,
  formed_at timestamp with time zone,
  completed_at timestamp with time zone,
  dissolved_at timestamp with time zone,
  rematch_eligible_until timestamp with time zone,
  quests_completed_count integer DEFAULT 0 NOT NULL,
  is_persistent_friend_group boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid,
  availability_phase_ends_at timestamp with time zone,
  voting_phase_ends_at timestamp with time zone,
  quest_scheduled_at timestamp with time zone,
  phase group_phase_type DEFAULT 'availability'::group_phase_type,
  originated_by_request_id uuid,
  is_pending_invites boolean DEFAULT false NOT NULL,
  quest_day_reminded_at timestamp with time zone,
  activated_at timestamp with time zone
);

CREATE TABLE public.match_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  city text,
  group_size integer,
  status match_request_status DEFAULT 'searching'::match_request_status NOT NULL,
  matched_group_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  resolved_at timestamp with time zone,
  attempt_count integer DEFAULT 0 NOT NULL,
  last_attempt_at timestamp with time zone,
  excluded_user_ids uuid[] DEFAULT ARRAY[]::uuid[],
  preferred_categories text[]
);

CREATE TABLE public.messages (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  group_id uuid NOT NULL,
  sender_id uuid,
  message_type message_type DEFAULT 'user_text'::message_type NOT NULL,
  content text NOT NULL,
  metadata jsonb,
  reply_to_id uuid,
  is_hidden boolean DEFAULT false NOT NULL,
  hidden_at timestamp with time zone,
  hidden_reason text,
  edited_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.notifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  type notification_type NOT NULL,
  title_en text NOT NULL,
  title_ko text NOT NULL,
  body_en text,
  body_ko text,
  action_url text,
  is_important boolean DEFAULT false NOT NULL,
  read_at timestamp with time zone,
  dismissed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.points_ledger (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  delta integer NOT NULL,
  reason text NOT NULL,
  quest_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  role user_role DEFAULT 'user'::user_role NOT NULL,
  display_name text NOT NULL,
  date_of_birth date NOT NULL,
  gender gender_identity,
  primary_language text DEFAULT 'ko'::text NOT NULL,
  spoken_languages text[] DEFAULT '{ko}'::text[] NOT NULL,
  bio text,
  photo_url text,
  home_district text,
  home_location extensions.geography(Point,4326),
  current_location extensions.geography(Point,4326),
  big_five_openness numeric(3,2),
  big_five_conscientiousness numeric(3,2),
  big_five_extraversion numeric(3,2),
  big_five_agreeableness numeric(3,2),
  big_five_neuroticism numeric(3,2),
  big_five_completed_at timestamp with time zone,
  mbti_type character(4),
  activity_preferences activity_category[] DEFAULT '{}'::activity_category[] NOT NULL,
  interests text[] DEFAULT '{}'::text[] NOT NULL,
  social_energy social_energy_pref DEFAULT 'no_preference'::social_energy_pref NOT NULL,
  phone_verified boolean DEFAULT false NOT NULL,
  pass_verified boolean DEFAULT false NOT NULL,
  kakao_linked boolean DEFAULT false NOT NULL,
  photo_verified boolean DEFAULT false NOT NULL,
  photo_verification_status verification_status DEFAULT 'unverified'::verification_status NOT NULL,
  subscription_tier subscription_tier DEFAULT 'free'::subscription_tier NOT NULL,
  subscription_expires_at timestamp with time zone,
  onboarding_completed boolean DEFAULT false NOT NULL,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  zodiac_sign text,
  exercise_frequency exercise_frequency_type,
  education_level education_level_type,
  drinking_habits drinking_habits_type,
  smoking_habits smoking_habits_type,
  children_status children_status_type,
  job_title text,
  basic_signup_completed boolean DEFAULT false,
  is_matchable boolean DEFAULT true NOT NULL,
  last_active_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.quest_check_ins (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  quest_id uuid NOT NULL,
  user_id uuid NOT NULL,
  venue_id uuid NOT NULL,
  qr_code_id uuid,
  checked_in_at timestamp with time zone DEFAULT now() NOT NULL,
  latitude numeric,
  longitude numeric,
  distance_m numeric,
  location_verified boolean DEFAULT false NOT NULL
);

CREATE TABLE public.quest_checkins (
  quest_id uuid NOT NULL,
  user_id uuid NOT NULL,
  checked_in_at timestamp with time zone DEFAULT now() NOT NULL,
  checkin_location extensions.geography(Point,4326)
);

CREATE TABLE public.quest_menu_items (
  quest_id uuid NOT NULL,
  menu_item_id uuid NOT NULL
);

CREATE TABLE public.quest_reviews (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  quest_id uuid NOT NULL,
  group_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  reviewed_user_id uuid NOT NULL,
  compliment_tags text[] DEFAULT ARRAY[]::text[] NOT NULL,
  vibe_tags text[] DEFAULT ARRAY[]::text[] NOT NULL,
  concern_tags text[] DEFAULT ARRAY[]::text[] NOT NULL,
  submitted_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.quests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  group_id uuid NOT NULL,
  venue_id uuid NOT NULL,
  quest_type text,
  quest_description text,
  status quest_status DEFAULT 'proposed'::quest_status NOT NULL,
  proposed_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  scheduled_for timestamp with time zone,
  completed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  verification_method verification_method,
  verified_by_user_id uuid,
  was_hidden_gem_pick boolean DEFAULT false NOT NULL,
  was_paid_boost_pick boolean DEFAULT false NOT NULL,
  points_awarded_per_user integer,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  title text,
  title_en text,
  description_en text
);

CREATE TABLE public.reports (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  reporter_id uuid NOT NULL,
  target_user_id uuid,
  target_venue_id uuid,
  target_quest_id uuid,
  reason text NOT NULL,
  details text,
  status report_status DEFAULT 'open'::report_status NOT NULL,
  admin_notes text,
  resolved_at timestamp with time zone,
  resolved_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.review_compliment_tags (
  id text NOT NULL,
  emoji text NOT NULL,
  label_en text NOT NULL,
  label_ko text NOT NULL,
  category text NOT NULL,
  display_order integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.review_concern_tags (
  id text NOT NULL,
  emoji text NOT NULL,
  label_en text NOT NULL,
  label_ko text NOT NULL,
  category text NOT NULL,
  display_order integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.review_tags (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  slug text NOT NULL,
  label_en text NOT NULL,
  label_ko text NOT NULL,
  tag_type review_tag_type NOT NULL,
  display_order integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.review_vibe_tags (
  id text NOT NULL,
  emoji text NOT NULL,
  label_en text NOT NULL,
  label_ko text NOT NULL,
  display_order integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.reviews (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  quest_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  reviewee_id uuid NOT NULL,
  selected_tag_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  submitted_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.typing_indicators (
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  started_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_blocks (
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_penalties (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  reason penalty_reason NOT NULL,
  strike_number integer NOT NULL,
  freeze_until timestamp with time zone,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_trust_stats (
  user_id uuid NOT NULL,
  total_reviews_received integer DEFAULT 0 NOT NULL,
  compliment_counts jsonb DEFAULT '{}'::jsonb NOT NULL,
  vibe_counts jsonb DEFAULT '{}'::jsonb NOT NULL,
  concern_counts jsonb DEFAULT '{}'::jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.venue_compliment_tags (
  id text NOT NULL,
  emoji text NOT NULL,
  label_en text NOT NULL,
  label_ko text NOT NULL,
  display_order integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.venue_concern_tags (
  id text NOT NULL,
  emoji text NOT NULL,
  label_en text NOT NULL,
  label_ko text NOT NULL,
  display_order integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.venue_menu_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  venue_id uuid NOT NULL,
  name text NOT NULL,
  name_en text,
  description text,
  price_won integer,
  photo_url text,
  is_signature boolean DEFAULT false,
  is_available boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.venue_qr_codes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  venue_id uuid NOT NULL,
  code text NOT NULL,
  valid_date date NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.venue_reviews (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  quest_id uuid NOT NULL,
  venue_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  compliment_tags text[] DEFAULT ARRAY[]::text[] NOT NULL,
  concern_tags text[] DEFAULT ARRAY[]::text[] NOT NULL,
  short_text text,
  submitted_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.venues (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  map_provider text,
  map_provider_id text,
  business_registration_number text,
  business_name_legal text NOT NULL,
  business_name_display text NOT NULL,
  category venue_category NOT NULL,
  accepted_quest_types text[] DEFAULT '{}'::text[] NOT NULL,
  address text NOT NULL,
  district text,
  city text NOT NULL,
  location extensions.geography(Point,4326),
  map_rating numeric(2,1),
  map_review_count integer,
  business_opened_at date,
  description text,
  description_en text,
  photo_urls text[] DEFAULT '{}'::text[] NOT NULL,
  hours_json jsonb,
  discount_offer text,
  discount_offer_en text,
  per_person_cost_won integer,
  hidden_gem_eligible boolean DEFAULT false NOT NULL,
  hidden_gem_evaluated_at timestamp with time zone,
  boost_until timestamp with time zone,
  claim_method venue_claim_method,
  claim_verified_at timestamp with time zone,
  is_active boolean DEFAULT false NOT NULL,
  deactivated_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  contact_email text,
  contact_phone text,
  contact_name text,
  zipcode text,
  road_address text,
  jibun_address text,
  building_name text,
  address_detail text,
  latitude numeric,
  longitude numeric
);

CREATE TABLE public.waitlist (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  email text NOT NULL,
  preferred_city text,
  primary_language text,
  source text,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.weekly_leaderboard_snapshots (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  week_start date NOT NULL,
  city text NOT NULL,
  user_id uuid NOT NULL,
  rank integer NOT NULL,
  points_total integer NOT NULL,
  quests_completed integer NOT NULL
);

-- ============ CONSTRAINTS ============
ALTER TABLE public.availability_submissions ADD CONSTRAINT availability_submissions_pkey PRIMARY KEY (id);
ALTER TABLE public.candidate_slots ADD CONSTRAINT candidate_slots_pkey PRIMARY KEY (id);
ALTER TABLE public.conversation_questions ADD CONSTRAINT conversation_questions_pkey PRIMARY KEY (id);
ALTER TABLE public.date_votes ADD CONSTRAINT date_votes_pkey PRIMARY KEY (id);
ALTER TABLE public.group_members ADD CONSTRAINT group_members_pkey PRIMARY KEY (group_id, user_id);
ALTER TABLE public.group_question_progress ADD CONSTRAINT group_question_progress_pkey PRIMARY KEY (group_id);
ALTER TABLE public.group_read_state ADD CONSTRAINT group_read_state_pkey PRIMARY KEY (group_id, user_id);
ALTER TABLE public.groups ADD CONSTRAINT groups_pkey PRIMARY KEY (id);
ALTER TABLE public.match_requests ADD CONSTRAINT match_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.messages ADD CONSTRAINT messages_pkey PRIMARY KEY (id);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.points_ledger ADD CONSTRAINT points_ledger_pkey PRIMARY KEY (id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.quest_check_ins ADD CONSTRAINT quest_check_ins_pkey PRIMARY KEY (id);
ALTER TABLE public.quest_checkins ADD CONSTRAINT quest_checkins_pkey PRIMARY KEY (quest_id, user_id);
ALTER TABLE public.quest_menu_items ADD CONSTRAINT quest_menu_items_pkey PRIMARY KEY (quest_id, menu_item_id);
ALTER TABLE public.quest_reviews ADD CONSTRAINT quest_reviews_pkey PRIMARY KEY (id);
ALTER TABLE public.quests ADD CONSTRAINT quests_pkey PRIMARY KEY (id);
ALTER TABLE public.reports ADD CONSTRAINT reports_pkey PRIMARY KEY (id);
ALTER TABLE public.review_compliment_tags ADD CONSTRAINT review_compliment_tags_pkey PRIMARY KEY (id);
ALTER TABLE public.review_concern_tags ADD CONSTRAINT review_concern_tags_pkey PRIMARY KEY (id);
ALTER TABLE public.review_tags ADD CONSTRAINT review_tags_pkey PRIMARY KEY (id);
ALTER TABLE public.review_vibe_tags ADD CONSTRAINT review_vibe_tags_pkey PRIMARY KEY (id);
ALTER TABLE public.reviews ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);
ALTER TABLE public.typing_indicators ADD CONSTRAINT typing_indicators_pkey PRIMARY KEY (group_id, user_id);
ALTER TABLE public.user_blocks ADD CONSTRAINT user_blocks_pkey PRIMARY KEY (blocker_id, blocked_id);
ALTER TABLE public.user_penalties ADD CONSTRAINT user_penalties_pkey PRIMARY KEY (id);
ALTER TABLE public.user_trust_stats ADD CONSTRAINT user_trust_stats_pkey PRIMARY KEY (user_id);
ALTER TABLE public.venue_compliment_tags ADD CONSTRAINT venue_compliment_tags_pkey PRIMARY KEY (id);
ALTER TABLE public.venue_concern_tags ADD CONSTRAINT venue_concern_tags_pkey PRIMARY KEY (id);
ALTER TABLE public.venue_menu_items ADD CONSTRAINT venue_menu_items_pkey PRIMARY KEY (id);
ALTER TABLE public.venue_qr_codes ADD CONSTRAINT venue_qr_codes_pkey PRIMARY KEY (id);
ALTER TABLE public.venue_reviews ADD CONSTRAINT venue_reviews_pkey PRIMARY KEY (id);
ALTER TABLE public.venues ADD CONSTRAINT venues_pkey PRIMARY KEY (id);
ALTER TABLE public.waitlist ADD CONSTRAINT waitlist_pkey PRIMARY KEY (id);
ALTER TABLE public.weekly_leaderboard_snapshots ADD CONSTRAINT weekly_leaderboard_snapshots_pkey PRIMARY KEY (id);
ALTER TABLE public.availability_submissions ADD CONSTRAINT availability_submissions_group_id_user_id_key UNIQUE (group_id, user_id);
ALTER TABLE public.candidate_slots ADD CONSTRAINT candidate_slots_group_id_slot_time_key UNIQUE (group_id, slot_time);
ALTER TABLE public.date_votes ADD CONSTRAINT date_votes_group_id_user_id_key UNIQUE (group_id, user_id);
ALTER TABLE public.quest_check_ins ADD CONSTRAINT quest_check_ins_quest_id_user_id_key UNIQUE (quest_id, user_id);
ALTER TABLE public.quest_reviews ADD CONSTRAINT quest_reviews_quest_id_reviewer_id_reviewed_user_id_key UNIQUE (quest_id, reviewer_id, reviewed_user_id);
ALTER TABLE public.review_tags ADD CONSTRAINT review_tags_slug_key UNIQUE (slug);
ALTER TABLE public.reviews ADD CONSTRAINT reviews_quest_id_reviewer_id_reviewee_id_key UNIQUE (quest_id, reviewer_id, reviewee_id);
ALTER TABLE public.venue_qr_codes ADD CONSTRAINT venue_qr_codes_code_key UNIQUE (code);
ALTER TABLE public.venue_reviews ADD CONSTRAINT venue_reviews_quest_id_reviewer_id_key UNIQUE (quest_id, reviewer_id);
ALTER TABLE public.venues ADD CONSTRAINT venues_map_provider_map_provider_id_key UNIQUE (map_provider, map_provider_id);
ALTER TABLE public.waitlist ADD CONSTRAINT waitlist_email_key UNIQUE (email);
ALTER TABLE public.weekly_leaderboard_snapshots ADD CONSTRAINT weekly_leaderboard_snapshots_week_start_city_user_id_key UNIQUE (week_start, city, user_id);
ALTER TABLE public.group_members ADD CONSTRAINT group_member_status_check CHECK (((declined_at IS NULL) OR (accepted_at IS NULL)));
ALTER TABLE public.groups ADD CONSTRAINT groups_match_score_check CHECK (((match_score IS NULL) OR ((match_score >= (0)::numeric) AND (match_score <= (1)::numeric))));
ALTER TABLE public.groups ADD CONSTRAINT groups_quests_completed_count_check CHECK ((quests_completed_count >= 0));
ALTER TABLE public.match_requests ADD CONSTRAINT valid_group_size CHECK (((group_size IS NULL) OR ((group_size >= 2) AND (group_size <= 5))));
ALTER TABLE public.messages ADD CONSTRAINT messages_content_check CHECK (((length(content) >= 1) AND (length(content) <= 2000)));
ALTER TABLE public.profiles ADD CONSTRAINT profile_age_check CHECK ((date_of_birth <= (CURRENT_DATE - '19 years'::interval)));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_big_five_agreeableness_check CHECK (((big_five_agreeableness >= (0)::numeric) AND (big_five_agreeableness <= (1)::numeric)));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_big_five_conscientiousness_check CHECK (((big_five_conscientiousness >= (0)::numeric) AND (big_five_conscientiousness <= (1)::numeric)));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_big_five_extraversion_check CHECK (((big_five_extraversion >= (0)::numeric) AND (big_five_extraversion <= (1)::numeric)));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_big_five_neuroticism_check CHECK (((big_five_neuroticism >= (0)::numeric) AND (big_five_neuroticism <= (1)::numeric)));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_big_five_openness_check CHECK (((big_five_openness >= (0)::numeric) AND (big_five_openness <= (1)::numeric)));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_bio_check CHECK ((length(bio) <= 280));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_display_name_check CHECK (((length(display_name) >= 1) AND (length(display_name) <= 40)));
ALTER TABLE public.quests ADD CONSTRAINT quest_schedule_check CHECK (((scheduled_for IS NULL) OR (scheduled_for <= expires_at)));
ALTER TABLE public.quests ADD CONSTRAINT quests_points_awarded_per_user_check CHECK (((points_awarded_per_user IS NULL) OR (points_awarded_per_user >= 0)));
ALTER TABLE public.reports ADD CONSTRAINT report_has_target CHECK (((target_user_id IS NOT NULL) OR (target_venue_id IS NOT NULL) OR (target_quest_id IS NOT NULL)));
ALTER TABLE public.reviews ADD CONSTRAINT no_self_review CHECK ((reviewer_id <> reviewee_id));
ALTER TABLE public.user_blocks ADD CONSTRAINT no_self_block CHECK ((blocker_id <> blocked_id));
ALTER TABLE public.venues ADD CONSTRAINT venues_map_provider_check CHECK ((map_provider = ANY (ARRAY['kakao'::text, 'naver'::text])));
ALTER TABLE public.venues ADD CONSTRAINT venues_map_rating_check CHECK (((map_rating IS NULL) OR ((map_rating >= (0)::numeric) AND (map_rating <= (5)::numeric))));
ALTER TABLE public.venues ADD CONSTRAINT venues_map_review_count_check CHECK (((map_review_count IS NULL) OR (map_review_count >= 0)));
ALTER TABLE public.venues ADD CONSTRAINT venues_per_person_cost_won_check CHECK (((per_person_cost_won IS NULL) OR (per_person_cost_won >= 0)));
ALTER TABLE public.waitlist ADD CONSTRAINT email_format CHECK ((email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text));
ALTER TABLE public.weekly_leaderboard_snapshots ADD CONSTRAINT weekly_leaderboard_snapshots_quests_completed_check CHECK ((quests_completed >= 0));
ALTER TABLE public.weekly_leaderboard_snapshots ADD CONSTRAINT weekly_leaderboard_snapshots_rank_check CHECK ((rank > 0));
ALTER TABLE public.availability_submissions ADD CONSTRAINT availability_submissions_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE public.availability_submissions ADD CONSTRAINT availability_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.candidate_slots ADD CONSTRAINT candidate_slots_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE public.date_votes ADD CONSTRAINT date_votes_candidate_slot_id_fkey FOREIGN KEY (candidate_slot_id) REFERENCES candidate_slots(id) ON DELETE CASCADE;
ALTER TABLE public.date_votes ADD CONSTRAINT date_votes_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE public.date_votes ADD CONSTRAINT date_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.group_members ADD CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE public.group_members ADD CONSTRAINT group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.group_question_progress ADD CONSTRAINT group_question_progress_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE public.group_read_state ADD CONSTRAINT group_read_state_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE public.group_read_state ADD CONSTRAINT group_read_state_last_read_message_id_fkey FOREIGN KEY (last_read_message_id) REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE public.group_read_state ADD CONSTRAINT group_read_state_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.groups ADD CONSTRAINT groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public.groups ADD CONSTRAINT groups_originated_by_request_id_fkey FOREIGN KEY (originated_by_request_id) REFERENCES match_requests(id) ON DELETE SET NULL;
ALTER TABLE public.match_requests ADD CONSTRAINT match_requests_matched_group_id_fkey FOREIGN KEY (matched_group_id) REFERENCES groups(id) ON DELETE SET NULL;
ALTER TABLE public.match_requests ADD CONSTRAINT match_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD CONSTRAINT messages_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD CONSTRAINT messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.points_ledger ADD CONSTRAINT points_ledger_quest_id_fkey FOREIGN KEY (quest_id) REFERENCES quests(id);
ALTER TABLE public.points_ledger ADD CONSTRAINT points_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.quest_check_ins ADD CONSTRAINT quest_check_ins_qr_code_id_fkey FOREIGN KEY (qr_code_id) REFERENCES venue_qr_codes(id) ON DELETE SET NULL;
ALTER TABLE public.quest_check_ins ADD CONSTRAINT quest_check_ins_quest_id_fkey FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE;
ALTER TABLE public.quest_check_ins ADD CONSTRAINT quest_check_ins_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.quest_check_ins ADD CONSTRAINT quest_check_ins_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
ALTER TABLE public.quest_checkins ADD CONSTRAINT quest_checkins_quest_id_fkey FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE;
ALTER TABLE public.quest_checkins ADD CONSTRAINT quest_checkins_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.quest_menu_items ADD CONSTRAINT quest_menu_items_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES venue_menu_items(id) ON DELETE CASCADE;
ALTER TABLE public.quest_menu_items ADD CONSTRAINT quest_menu_items_quest_id_fkey FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE;
ALTER TABLE public.quest_reviews ADD CONSTRAINT quest_reviews_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE public.quest_reviews ADD CONSTRAINT quest_reviews_quest_id_fkey FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE;
ALTER TABLE public.quest_reviews ADD CONSTRAINT quest_reviews_reviewed_user_id_fkey FOREIGN KEY (reviewed_user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.quest_reviews ADD CONSTRAINT quest_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.quests ADD CONSTRAINT quests_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE public.quests ADD CONSTRAINT quests_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id);
ALTER TABLE public.quests ADD CONSTRAINT quests_verified_by_user_id_fkey FOREIGN KEY (verified_by_user_id) REFERENCES profiles(id);
ALTER TABLE public.reports ADD CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES profiles(id);
ALTER TABLE public.reports ADD CONSTRAINT reports_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES profiles(id);
ALTER TABLE public.reports ADD CONSTRAINT reports_target_quest_id_fkey FOREIGN KEY (target_quest_id) REFERENCES quests(id);
ALTER TABLE public.reports ADD CONSTRAINT reports_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES profiles(id);
ALTER TABLE public.reports ADD CONSTRAINT reports_target_venue_id_fkey FOREIGN KEY (target_venue_id) REFERENCES venues(id);
ALTER TABLE public.reviews ADD CONSTRAINT reviews_quest_id_fkey FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_reviewee_id_fkey FOREIGN KEY (reviewee_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.typing_indicators ADD CONSTRAINT typing_indicators_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE public.typing_indicators ADD CONSTRAINT typing_indicators_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.user_blocks ADD CONSTRAINT user_blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.user_blocks ADD CONSTRAINT user_blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.user_penalties ADD CONSTRAINT user_penalties_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.user_trust_stats ADD CONSTRAINT user_trust_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.venue_menu_items ADD CONSTRAINT venue_menu_items_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
ALTER TABLE public.venue_qr_codes ADD CONSTRAINT venue_qr_codes_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
ALTER TABLE public.venue_reviews ADD CONSTRAINT venue_reviews_quest_id_fkey FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE;
ALTER TABLE public.venue_reviews ADD CONSTRAINT venue_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.venue_reviews ADD CONSTRAINT venue_reviews_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
ALTER TABLE public.venues ADD CONSTRAINT venues_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.weekly_leaderboard_snapshots ADD CONSTRAINT weekly_leaderboard_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ============ INDEXES ============
CREATE INDEX idx_availability_group ON public.availability_submissions USING btree (group_id);
CREATE INDEX idx_candidate_slots_group ON public.candidate_slots USING btree (group_id);
CREATE INDEX idx_conversation_questions_set ON public.conversation_questions USING btree (set_name, display_order);
CREATE INDEX idx_date_votes_group ON public.date_votes USING btree (group_id);
CREATE INDEX idx_group_members_group ON public.group_members USING btree (group_id);
CREATE INDEX idx_group_members_invite_state ON public.group_members USING btree (invite_state) WHERE (invite_state IS NOT NULL);
CREATE INDEX idx_group_members_user ON public.group_members USING btree (user_id);
CREATE INDEX idx_group_read_state_user ON public.group_read_state USING btree (user_id);
CREATE INDEX idx_groups_city ON public.groups USING btree (city);
CREATE INDEX idx_groups_pending ON public.groups USING btree (is_pending_invites) WHERE (is_pending_invites = true);
CREATE INDEX idx_groups_status ON public.groups USING btree (status);
CREATE INDEX idx_match_requests_status ON public.match_requests USING btree (status);
CREATE INDEX idx_match_requests_user ON public.match_requests USING btree (user_id);
CREATE INDEX idx_messages_group_created ON public.messages USING btree (group_id, created_at DESC);
CREATE INDEX idx_messages_sender ON public.messages USING btree (sender_id);
CREATE INDEX idx_messages_type ON public.messages USING btree (message_type);
CREATE INDEX idx_notifications_user_created ON public.notifications USING btree (user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id, read_at) WHERE ((read_at IS NULL) AND (dismissed_at IS NULL));
CREATE INDEX idx_points_created ON public.points_ledger USING btree (created_at);
CREATE INDEX idx_points_quest ON public.points_ledger USING btree (quest_id);
CREATE INDEX idx_points_user ON public.points_ledger USING btree (user_id);
CREATE INDEX idx_profiles_activity_prefs ON public.profiles USING gin (activity_preferences);
CREATE INDEX idx_profiles_current_location ON public.profiles USING gist (current_location);
CREATE INDEX idx_profiles_deleted_at ON public.profiles USING btree (deleted_at) WHERE (deleted_at IS NULL);
CREATE INDEX idx_profiles_home_location ON public.profiles USING gist (home_location);
CREATE INDEX idx_profiles_matchable ON public.profiles USING btree (is_matchable) WHERE (is_matchable = true);
CREATE INDEX idx_profiles_not_deleted ON public.profiles USING btree (deleted_at) WHERE (deleted_at IS NULL);
CREATE INDEX idx_profiles_role ON public.profiles USING btree (role);
CREATE INDEX idx_quest_check_ins_quest ON public.quest_check_ins USING btree (quest_id);
CREATE INDEX idx_quest_check_ins_user ON public.quest_check_ins USING btree (user_id);
CREATE INDEX idx_quest_checkins_user ON public.quest_checkins USING btree (user_id);
CREATE INDEX idx_quest_reviews_quest ON public.quest_reviews USING btree (quest_id);
CREATE INDEX idx_quest_reviews_reviewed ON public.quest_reviews USING btree (reviewed_user_id);
CREATE INDEX idx_quest_reviews_reviewer ON public.quest_reviews USING btree (reviewer_id);
CREATE INDEX idx_quests_expires ON public.quests USING btree (expires_at) WHERE (status = ANY (ARRAY['proposed'::quest_status, 'scheduled'::quest_status]));
CREATE INDEX idx_quests_group ON public.quests USING btree (group_id);
CREATE INDEX idx_quests_scheduled ON public.quests USING btree (scheduled_for) WHERE (status = 'scheduled'::quest_status);
CREATE INDEX idx_quests_status ON public.quests USING btree (status);
CREATE INDEX idx_quests_venue ON public.quests USING btree (venue_id);
CREATE INDEX idx_reports_status ON public.reports USING btree (status) WHERE (status = ANY (ARRAY['open'::report_status, 'in_review'::report_status]));
CREATE INDEX idx_reports_target_user ON public.reports USING btree (target_user_id);
CREATE INDEX idx_reports_target_venue ON public.reports USING btree (target_venue_id);
CREATE INDEX idx_review_tags_type ON public.review_tags USING btree (tag_type) WHERE (is_active = true);
CREATE INDEX idx_reviews_quest ON public.reviews USING btree (quest_id);
CREATE INDEX idx_reviews_reviewee ON public.reviews USING btree (reviewee_id);
CREATE INDEX idx_reviews_reviewer ON public.reviews USING btree (reviewer_id);
CREATE INDEX idx_blocks_blocked ON public.user_blocks USING btree (blocked_id);
CREATE INDEX idx_user_penalties_user ON public.user_penalties USING btree (user_id);
CREATE INDEX idx_venue_menu_items_signature ON public.venue_menu_items USING btree (venue_id, is_signature) WHERE (is_signature = true);
CREATE INDEX idx_venue_menu_items_venue_id ON public.venue_menu_items USING btree (venue_id);
CREATE INDEX idx_venue_qr_codes_code ON public.venue_qr_codes USING btree (code);
CREATE INDEX idx_venue_qr_codes_venue_date ON public.venue_qr_codes USING btree (venue_id, valid_date);
CREATE INDEX idx_venue_reviews_quest ON public.venue_reviews USING btree (quest_id);
CREATE INDEX idx_venue_reviews_venue ON public.venue_reviews USING btree (venue_id);
CREATE INDEX idx_venues_active ON public.venues USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_venues_boost_until ON public.venues USING btree (boost_until) WHERE (boost_until IS NOT NULL);
CREATE INDEX idx_venues_category ON public.venues USING btree (category);
CREATE INDEX idx_venues_city ON public.venues USING btree (city);
CREATE INDEX idx_venues_hidden_gem ON public.venues USING btree (hidden_gem_eligible) WHERE (hidden_gem_eligible = true);
CREATE INDEX idx_venues_location ON public.venues USING gist (location);
CREATE INDEX idx_venues_owner ON public.venues USING btree (owner_id);
CREATE INDEX idx_waitlist_created ON public.waitlist USING btree (created_at);
CREATE INDEX idx_leaderboard_lookup ON public.weekly_leaderboard_snapshots USING btree (week_start, city, rank);

-- ============ FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.cleanup_stale_typing()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  rows_deleted INTEGER;
BEGIN
  DELETE FROM public.typing_indicators
  WHERE started_at < NOW() - INTERVAL '15 seconds';
  GET DIAGNOSTICS rows_deleted = ROW_COUNT;
  RETURN rows_deleted;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.evaluate_hidden_gem_status()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  rows_updated INTEGER;
BEGIN
  UPDATE public.venues
  SET
    hidden_gem_eligible = (
      business_opened_at >= (CURRENT_DATE - INTERVAL '2 years')::DATE
      AND COALESCE(map_review_count, 0) < 200
      AND COALESCE(map_rating, 0) >= 4.0
      AND is_active = TRUE
    ),
    hidden_gem_evaluated_at = NOW()
  WHERE is_active = TRUE;

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  provider_name TEXT;
  display_name_from_provider TEXT;
  photo_from_provider TEXT;
BEGIN
  -- Which provider did they sign in with?
  -- Supabase stores this in raw_app_meta_data
  provider_name := COALESCE(
    NEW.raw_app_meta_data ->> 'provider',
    'email'
  );

  -- Try to pull display name from the provider's user metadata.
  -- Different providers name this field differently.
  display_name_from_provider := COALESCE(
    NEW.raw_user_meta_data ->> 'name',              -- Google
    NEW.raw_user_meta_data ->> 'full_name',         -- some providers
    NEW.raw_user_meta_data ->> 'nickname',          -- Kakao
    NEW.raw_user_meta_data ->> 'preferred_username',
    'New user'                                       -- ultimate fallback
  );

  -- Try to pull a profile photo URL
  photo_from_provider := COALESCE(
    NEW.raw_user_meta_data ->> 'avatar_url',        -- Google
    NEW.raw_user_meta_data ->> 'picture',           -- Google (older key)
    NEW.raw_user_meta_data ->> 'profile_image_url'  -- Kakao
  );

  -- Insert into profiles. We use a placeholder date_of_birth that the
  -- user will fill in during real onboarding. The onboarding_completed
  -- flag stays FALSE until the user finishes the real profile setup form.
  INSERT INTO public.profiles (
    id,
    display_name,
    date_of_birth,
    photo_url,
    kakao_linked,
    onboarding_completed
  )
  VALUES (
    NEW.id,
    LEFT(display_name_from_provider, 40),   -- profile constraint: max 40 chars
    -- Placeholder DOB. We use a value that satisfies the >=19 years constraint
    -- and is clearly a placeholder (Jan 1, 2000). Real onboarding will overwrite.
    '2000-01-01'::DATE,
    photo_from_provider,
    (provider_name = 'kakao'),
    FALSE
  )
  ON CONFLICT (id) DO NOTHING;  -- idempotent — if already exists, skip

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND p.role = 'admin'::public.user_role
      AND p.deleted_at IS NULL
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = p_group_id
      AND gm.user_id = p_user_id
      AND gm.accepted_at IS NOT NULL
      AND gm.left_at IS NULL
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_quest_group_member(p_quest_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.quests q
    JOIN public.group_members gm ON gm.group_id = q.group_id
    WHERE q.id = p_quest_id
      AND gm.user_id = p_user_id
      AND gm.accepted_at IS NOT NULL
      AND gm.left_at IS NULL
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_user_frozen(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM user_penalties
    WHERE user_id = uid
      AND freeze_until IS NOT NULL
      AND freeze_until > NOW()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_venue_owner(p_venue_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.venues v
    WHERE v.id = p_venue_id
      AND v.owner_id = p_user_id
  );
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.user_is_in_group(gid uuid, uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = gid AND user_id = uid
  );
$function$
;

CREATE OR REPLACE FUNCTION public.user_strike_count(uid uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT COALESCE(MAX(strike_number), 0)::INT
  FROM user_penalties
  WHERE user_id = uid;
$function$
;

CREATE OR REPLACE FUNCTION public.users_share_quest(p_quest_id uuid, p_reviewer_id uuid, p_reviewee_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.quests q
    JOIN public.group_members reviewer
      ON reviewer.group_id = q.group_id
     AND reviewer.user_id = p_reviewer_id
     AND reviewer.accepted_at IS NOT NULL
     AND reviewer.left_at IS NULL
    JOIN public.group_members reviewee
      ON reviewee.group_id = q.group_id
     AND reviewee.user_id = p_reviewee_id
     AND reviewee.accepted_at IS NOT NULL
     AND reviewee.left_at IS NULL
    WHERE q.id = p_quest_id
  );
$function$
;

-- ============ VIEWS ============
CREATE OR REPLACE VIEW public.profile_top_tags AS
 SELECT r.reviewee_id AS user_id,
    rt.slug,
    rt.label_en,
    rt.label_ko,
    count(*) AS tag_count
   FROM reviews r
     JOIN review_tags rt ON rt.id = ANY (r.selected_tag_ids)
  WHERE rt.tag_type = 'positive_public'::review_tag_type AND rt.is_active = true
  GROUP BY r.reviewee_id, rt.id, rt.slug, rt.label_en, rt.label_ko
  ORDER BY (count(*)) DESC;

CREATE OR REPLACE VIEW public.public_profiles AS
 SELECT id,
    display_name,
    EXTRACT(year FROM age(date_of_birth::timestamp with time zone))::integer AS age,
    gender,
    primary_language,
    spoken_languages,
    bio,
    photo_url,
    home_district,
    activity_preferences,
    interests,
    mbti_type,
    phone_verified,
    pass_verified,
    kakao_linked,
    photo_verified,
    created_at
   FROM profiles
  WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW public.unread_message_counts AS
 SELECT gm.user_id,
    gm.group_id,
    count(m.id) AS unread_count
   FROM group_members gm
     LEFT JOIN group_read_state grs ON grs.group_id = gm.group_id AND grs.user_id = gm.user_id
     LEFT JOIN messages m ON m.group_id = gm.group_id AND m.is_hidden = false AND (grs.last_read_at IS NULL OR m.created_at > grs.last_read_at) AND m.sender_id <> gm.user_id
  WHERE gm.accepted_at IS NOT NULL AND gm.left_at IS NULL
  GROUP BY gm.user_id, gm.group_id;

-- ============ TRIGGERS ============
CREATE TRIGGER groups_updated_at BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER quests_updated_at BEFORE UPDATE ON public.quests FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE TRIGGER venues_updated_at BEFORE UPDATE ON public.venues FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============ EVENT TRIGGERS ============
CREATE EVENT TRIGGER ensure_rls ON ddl_command_end WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO') EXECUTE FUNCTION public.rls_auto_enable();

-- ============ ROW LEVEL SECURITY ============
ALTER TABLE public.availability_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.date_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_question_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_read_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_compliment_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_concern_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_vibe_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_penalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_trust_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_compliment_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_concern_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin sees all submissions" ON public.availability_submissions AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = 'dc511479-3d65-4dc4-a2da-55cbca7f9456'::uuid));

CREATE POLICY "Members can see group submissions" ON public.availability_submissions AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM group_members gm
  WHERE ((gm.group_id = availability_submissions.group_id) AND (gm.user_id = auth.uid()) AND (gm.accepted_at IS NOT NULL) AND (gm.left_at IS NULL)))));

CREATE POLICY "Users insert own submission" ON public.availability_submissions AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM group_members gm
  WHERE ((gm.group_id = availability_submissions.group_id) AND (gm.user_id = auth.uid()) AND (gm.accepted_at IS NOT NULL) AND (gm.left_at IS NULL))))));

CREATE POLICY "Users update own submission" ON public.availability_submissions AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Admin sees all candidates" ON public.candidate_slots AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = 'dc511479-3d65-4dc4-a2da-55cbca7f9456'::uuid));

CREATE POLICY "Members see candidates" ON public.candidate_slots AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM group_members gm
  WHERE ((gm.group_id = candidate_slots.group_id) AND (gm.user_id = auth.uid()) AND (gm.accepted_at IS NOT NULL) AND (gm.left_at IS NULL)))));

CREATE POLICY questions_read_all ON public.conversation_questions AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "Members see group votes" ON public.date_votes AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM group_members gm
  WHERE ((gm.group_id = date_votes.group_id) AND (gm.user_id = auth.uid()) AND (gm.accepted_at IS NOT NULL) AND (gm.left_at IS NULL)))));

CREATE POLICY "Users delete own vote" ON public.date_votes AS PERMISSIVE FOR DELETE TO authenticated
  USING ((user_id = auth.uid()));

CREATE POLICY "Users insert own vote" ON public.date_votes AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM group_members gm
  WHERE ((gm.group_id = date_votes.group_id) AND (gm.user_id = auth.uid()) AND (gm.accepted_at IS NOT NULL) AND (gm.left_at IS NULL))))));

CREATE POLICY "Users update own vote" ON public.date_votes AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Admin can delete group members" ON public.group_members AS PERMISSIVE FOR DELETE TO authenticated
  USING ((auth.uid() = 'dc511479-3d65-4dc4-a2da-55cbca7f9456'::uuid));

CREATE POLICY "Admin can insert group members" ON public.group_members AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = 'dc511479-3d65-4dc4-a2da-55cbca7f9456'::uuid));

CREATE POLICY "Admin can see all group members" ON public.group_members AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = 'dc511479-3d65-4dc4-a2da-55cbca7f9456'::uuid));

CREATE POLICY "Members read own membership" ON public.group_members AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = auth.uid()) OR is_group_member(group_id, auth.uid()) OR is_admin(auth.uid())));

CREATE POLICY "Users can see members of their groups" ON public.group_members AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_is_in_group(group_id, auth.uid()));

CREATE POLICY "Users update own group membership" ON public.group_members AS PERMISSIVE FOR UPDATE TO public
  USING (((user_id = auth.uid()) OR is_admin(auth.uid())))
  WITH CHECK (((user_id = auth.uid()) OR is_admin(auth.uid())));

CREATE POLICY progress_read_members ON public.group_question_progress AS PERMISSIVE FOR SELECT TO public
  USING ((group_id IN ( SELECT group_members.group_id
   FROM group_members
  WHERE (group_members.user_id = auth.uid()))));

CREATE POLICY progress_update_members ON public.group_question_progress AS PERMISSIVE FOR UPDATE TO public
  USING ((group_id IN ( SELECT group_members.group_id
   FROM group_members
  WHERE (group_members.user_id = auth.uid()))));

CREATE POLICY "Users manage own read state" ON public.group_read_state AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid()));

CREATE POLICY "Admin can delete groups" ON public.groups AS PERMISSIVE FOR DELETE TO authenticated
  USING ((auth.uid() = 'dc511479-3d65-4dc4-a2da-55cbca7f9456'::uuid));

CREATE POLICY "Admin can insert groups" ON public.groups AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = 'dc511479-3d65-4dc4-a2da-55cbca7f9456'::uuid));

CREATE POLICY "Admin can see all groups" ON public.groups AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = 'dc511479-3d65-4dc4-a2da-55cbca7f9456'::uuid));

CREATE POLICY "Admin can update groups" ON public.groups AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = 'dc511479-3d65-4dc4-a2da-55cbca7f9456'::uuid));

CREATE POLICY "Members read own groups" ON public.groups AS PERMISSIVE FOR SELECT TO public
  USING ((is_group_member(id, auth.uid()) OR is_admin(auth.uid())));

CREATE POLICY "Users can see groups where they are a member" ON public.groups AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM group_members
  WHERE ((group_members.group_id = groups.id) AND (group_members.user_id = auth.uid())))));

CREATE POLICY "Admin sees all requests" ON public.match_requests AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = 'dc511479-3d65-4dc4-a2da-55cbca7f9456'::uuid));

CREATE POLICY "Admin updates any request" ON public.match_requests AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = 'dc511479-3d65-4dc4-a2da-55cbca7f9456'::uuid));

CREATE POLICY "Users insert own requests" ON public.match_requests AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Users see own requests" ON public.match_requests AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));

CREATE POLICY "Users update own requests" ON public.match_requests AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Admin can see all messages" ON public.messages AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = 'dc511479-3d65-4dc4-a2da-55cbca7f9456'::uuid));

CREATE POLICY "Group members read messages" ON public.messages AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM group_members gm
  WHERE ((gm.group_id = messages.group_id) AND (gm.user_id = auth.uid()) AND (gm.accepted_at IS NOT NULL) AND (gm.left_at IS NULL)))) AND (is_hidden = false)));

CREATE POLICY "Group members send messages" ON public.messages AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((sender_id = auth.uid()) AND (message_type = 'user_text'::message_type) AND (EXISTS ( SELECT 1
   FROM group_members gm
  WHERE ((gm.group_id = messages.group_id) AND (gm.user_id = auth.uid()) AND (gm.accepted_at IS NOT NULL) AND (gm.left_at IS NULL))))));

CREATE POLICY "Users can edit messages" ON public.messages AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((((sender_id = auth.uid()) AND (created_at > (now() - '00:15:00'::interval))) OR (auth.uid() = 'dc511479-3d65-4dc4-a2da-55cbca7f9456'::uuid)))
  WITH CHECK (((sender_id = auth.uid()) OR (auth.uid() = 'dc511479-3d65-4dc4-a2da-55cbca7f9456'::uuid)));

CREATE POLICY notifications_read_own ON public.notifications AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));

CREATE POLICY notifications_update_own ON public.notifications AS PERMISSIVE FOR UPDATE TO public
  USING ((user_id = auth.uid()));

CREATE POLICY "Users read own points" ON public.points_ledger AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = auth.uid()) OR is_admin(auth.uid())));

CREATE POLICY "Admin can see all profiles" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = 'dc511479-3d65-4dc4-a2da-55cbca7f9456'::uuid));

CREATE POLICY "Admins read all profiles" ON public.profiles AS PERMISSIVE FOR SELECT TO public
  USING (is_admin(auth.uid()));

CREATE POLICY "Users can see group members profiles" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (group_members gm1
     JOIN group_members gm2 ON ((gm1.group_id = gm2.group_id)))
  WHERE ((gm1.user_id = auth.uid()) AND (gm2.user_id = profiles.id)))));

CREATE POLICY "Users insert own profile" ON public.profiles AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = id));

CREATE POLICY "Users read own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = id));

CREATE POLICY "Users update own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = id))
  WITH CHECK ((auth.uid() = id));

CREATE POLICY quest_check_ins_select ON public.quest_check_ins AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = auth.uid()) OR (quest_id IN ( SELECT q.id
   FROM (quests q
     JOIN group_members gm ON ((gm.group_id = q.group_id)))
  WHERE ((gm.user_id = auth.uid()) AND (gm.left_at IS NULL))))));

CREATE POLICY "Group members see checkins" ON public.quest_checkins AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = auth.uid()) OR is_quest_group_member(quest_id, auth.uid()) OR is_admin(auth.uid())));

CREATE POLICY "Users check themselves in" ON public.quest_checkins AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((user_id = auth.uid()) AND is_quest_group_member(quest_id, auth.uid())));

CREATE POLICY "Admin can insert quest menu items" ON public.quest_menu_items AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = 'dc511479-3d65-4dc4-a2da-55cbca7f9456'::uuid));

CREATE POLICY "Users can see quest menu items" ON public.quest_menu_items AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (quests q
     JOIN group_members gm ON ((gm.group_id = q.group_id)))
  WHERE ((q.id = quest_menu_items.quest_id) AND (gm.user_id = auth.uid())))));

CREATE POLICY quest_reviews_own_or_public_partial ON public.quest_reviews AS PERMISSIVE FOR SELECT TO public
  USING ((reviewer_id = auth.uid()));

CREATE POLICY "Admin can insert quests" ON public.quests AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = 'dc511479-3d65-4dc4-a2da-55cbca7f9456'::uuid));

CREATE POLICY "Admin can see all quests" ON public.quests AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = 'dc511479-3d65-4dc4-a2da-55cbca7f9456'::uuid));

CREATE POLICY "Admin can update quests" ON public.quests AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = 'dc511479-3d65-4dc4-a2da-55cbca7f9456'::uuid));

CREATE POLICY "Group members read quest" ON public.quests AS PERMISSIVE FOR SELECT TO public
  USING ((is_group_member(group_id, auth.uid()) OR is_venue_owner(venue_id, auth.uid()) OR is_admin(auth.uid())));

CREATE POLICY "Users can see quests for their groups" ON public.quests AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM group_members
  WHERE ((group_members.group_id = quests.group_id) AND (group_members.user_id = auth.uid())))));

CREATE POLICY "Reporters read own reports" ON public.reports AS PERMISSIVE FOR SELECT TO public
  USING (((reporter_id = auth.uid()) OR is_admin(auth.uid())));

CREATE POLICY "Users file reports" ON public.reports AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((reporter_id = auth.uid()));

CREATE POLICY read_compliment_tags ON public.review_compliment_tags AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY read_concern_tags ON public.review_concern_tags AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "Read review tags" ON public.review_tags AS PERMISSIVE FOR SELECT TO public
  USING (((auth.role() = 'authenticated'::text) OR is_admin(auth.uid())));

CREATE POLICY read_vibe_tags ON public.review_vibe_tags AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "Reviewee reads own reviews" ON public.reviews AS PERMISSIVE FOR SELECT TO public
  USING (((reviewee_id = auth.uid()) OR (reviewer_id = auth.uid()) OR is_admin(auth.uid())));

CREATE POLICY "Users write reviews" ON public.reviews AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((reviewer_id = auth.uid()) AND (reviewee_id <> auth.uid()) AND users_share_quest(quest_id, reviewer_id, reviewee_id)));

CREATE POLICY "Group members see typing" ON public.typing_indicators AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM group_members gm
  WHERE ((gm.group_id = typing_indicators.group_id) AND (gm.user_id = auth.uid()) AND (gm.accepted_at IS NOT NULL) AND (gm.left_at IS NULL)))));

CREATE POLICY "Users manage own typing" ON public.typing_indicators AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid()));

CREATE POLICY "Users manage own blocks" ON public.user_blocks AS PERMISSIVE FOR ALL TO public
  USING (((blocker_id = auth.uid()) OR is_admin(auth.uid())))
  WITH CHECK (((blocker_id = auth.uid()) OR is_admin(auth.uid())));

CREATE POLICY "Admin inserts penalties" ON public.user_penalties AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = 'dc511479-3d65-4dc4-a2da-55cbca7f9456'::uuid));

CREATE POLICY "Admin sees all penalties" ON public.user_penalties AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = 'dc511479-3d65-4dc4-a2da-55cbca7f9456'::uuid));

CREATE POLICY "Users see own penalties" ON public.user_penalties AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));

CREATE POLICY trust_stats_public ON public.user_trust_stats AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY read_venue_comp_tags ON public.venue_compliment_tags AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY read_venue_concern_tags ON public.venue_concern_tags AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "Admin can see all menu items" ON public.venue_menu_items AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = 'dc511479-3d65-4dc4-a2da-55cbca7f9456'::uuid));

CREATE POLICY "Menu items are readable by anyone" ON public.venue_menu_items AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "Venue owners can manage their menu items" ON public.venue_menu_items AS PERMISSIVE FOR ALL TO public
  USING ((venue_id IN ( SELECT venues.id
   FROM venues
  WHERE (venues.owner_id = auth.uid()))));

CREATE POLICY venue_qr_codes_select ON public.venue_qr_codes AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY venue_reviews_public ON public.venue_reviews AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "Admin can delete any venue" ON public.venues AS PERMISSIVE FOR DELETE TO authenticated
  USING ((auth.uid() = 'dc511479-3d65-4dc4-a2da-55cbca7f9456'::uuid));

CREATE POLICY "Admin can see all venues" ON public.venues AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = 'dc511479-3d65-4dc4-a2da-55cbca7f9456'::uuid));

CREATE POLICY "Admin can update any venue" ON public.venues AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = 'dc511479-3d65-4dc4-a2da-55cbca7f9456'::uuid));

CREATE POLICY "Owners manage own venues" ON public.venues AS PERMISSIVE FOR ALL TO public
  USING (((owner_id = auth.uid()) OR is_admin(auth.uid())))
  WITH CHECK (((owner_id = auth.uid()) OR is_admin(auth.uid())));

CREATE POLICY "Read active venues" ON public.venues AS PERMISSIVE FOR SELECT TO public
  USING (((is_active = true) OR (owner_id = auth.uid()) OR is_admin(auth.uid())));

CREATE POLICY "Anyone signs up to waitlist" ON public.waitlist AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Read leaderboard" ON public.weekly_leaderboard_snapshots AS PERMISSIVE FOR SELECT TO public
  USING (((auth.role() = 'authenticated'::text) OR is_admin(auth.uid())));

CREATE POLICY "Anyone can view menu photos" ON storage.objects AS PERMISSIVE FOR SELECT TO public
  USING ((bucket_id = 'venue-menu-photos'::text));

CREATE POLICY "Anyone can view profile photos" ON storage.objects AS PERMISSIVE FOR SELECT TO public
  USING ((bucket_id = 'profile-photos'::text));

CREATE POLICY "Anyone can view venue photos" ON storage.objects AS PERMISSIVE FOR SELECT TO public
  USING ((bucket_id = 'venue-photos'::text));

CREATE POLICY "Users can delete their own profile photo" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'profile-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "Users can update their own profile photo" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'profile-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "Users can upload their own profile photo" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'profile-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "Venue owners can upload menu photos" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((bucket_id = 'venue-menu-photos'::text));

CREATE POLICY "Venue owners can upload venue photos" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((bucket_id = 'venue-photos'::text));

-- ============ STORAGE BUCKETS ============
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('profile-photos', 'profile-photos', t, 10485760, '{image/jpeg,image/jpg,image/png,image/webp}') ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('venue-menu-photos', 'venue-menu-photos', t, 31457280, '{image/jpeg,image/png,image/webp}') ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('venue-photos', 'venue-photos', t, 20971520, '{image/jpeg,image/png,image/webp}') ON CONFLICT (id) DO NOTHING;

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_read_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;
