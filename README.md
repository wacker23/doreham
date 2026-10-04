# Doreham 도레함

Friendship app for internationals in Korea: small matched groups, partner venues and 봉사
volunteer quests, community events, points and levels. Live at https://doreham.co.kr.

Next.js 16 (App Router) · React 19 · Supabase (Postgres, Auth, Storage, Realtime) · Vercel (Seoul, `icn1`) · Resend · Web Push.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in the values (never commit .env.local)
npm run dev                         # http://localhost:3000 (uses the live database)
```

## Environment variables

| Name | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | public by design; data is protected by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | bypasses RLS: only used in `lib/server/*` (`server-only`) |
| `CRON_SECRET` | server | Vercel Cron sends it; cron routes fail closed without it |
| `PERK_CODE_SECRET` | server | perk "code of the day" key (falls back to `CRON_SECRET`) |
| `RESEND_API_KEY` | server | email |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | push | without them push is off |
| `DATA_GO_KR_API_KEY`, `VOLUNTEER_1365_API_BASE` | server | business-number check, 1365 volunteer API |
| `KAKAO_REST_API_KEY` | server | Kakao Local address → map pin for venues (QR check-in GPS); without it an admin sets pins by hand |
| `AI_GATEWAY_API_KEY` / Vercel OIDC, `TRANSLATION_MODELS` | server | KO↔EN translation |
| `NEXT_PUBLIC_APP_URL` | both | links in emails |

## Security model (short)

- **Never trust the browser.** API routes get the caller from the session cookie
  (`requireUser` / `requireAdmin` in `lib/server/auth.ts`), never from a body field.
  Cron routes need `CRON_SECRET` (constant-time compare) or an admin session.
- **RLS everywhere.** Browser queries use the anon key; Row Level Security and guard
  triggers (`guard_*` functions) decide what each user can read and write. Private columns
  (venue owner contact details and registration numbers, exact birthdays, locations, private
  review tags) are not readable from the browser; owners and admins read them through the API.
- **Service role only on the server**, and every use is preceded by an ownership/admin check.
- **Errors:** 5xx responses only carry short error codes; details are logged on the server.
- **Emails:** every user-written value is HTML-escaped (`escapeHtml` in `lib/server/emails/common.ts`).
- **Uploads:** checked by magic bytes, size-capped, stored under server-made paths
  (or the uploader's own folder for public photos).
- **Headers:** see `next.config.ts` (no framing, nosniff, HSTS, permissions, CSP).

Audit log: the "Doreham Security Audit & Ship Readiness" doc in the project (Oct 3, 2026).

## Database

Migrations live in `supabase/migrations/` (timestamped) and are applied to the Supabase
project as well as committed. `supabase/seed.sql` holds the tag catalogs and icebreaker
questions. `supabase/storage_policies_2026-10-03.sql` must be run by the project owner
(storage policies can't be changed by a normal migration).
