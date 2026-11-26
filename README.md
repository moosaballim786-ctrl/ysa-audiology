# Yusuf Suder Audiology (YSA) — practice app

**We're hear for you.** *(the pun is deliberate)*

Mobile-first PWA for the practice: online booking, schedule, patient history with recalls and scans, takings, ENT referrals, notifications and WhatsApp messaging.

| | |
|---|---|
| Frontend | Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS 4 · shadcn-style UI kit · framer-motion · recharts |
| Backend | Supabase — Auth, Postgres (RLS on every table), Storage (`patient-scans`, private), Edge Functions, `pg_cron` + `pg_net` |
| Hosting | Netlify (auto-deploys `main`) |
| Time zone | Africa/Johannesburg · weeks start Monday · ZAR |

## Local development

```bash
cp .env.example .env.local   # fill in the publishable key
npm install
npm run dev
```

Environment variables (Netlify → Site configuration → Environment variables):

| Name | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase **publishable** key |
| `NEXT_PUBLIC_SITE_URL` | Public base URL (booking links, embed code). Change to `https://ysa-is-hear.co.za` when the domain is live. |

Secrets that live **only** in Supabase (never in the repo or frontend): `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, optional `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`. The cron secret lives in Supabase Vault (`ysa_cron_secret`).

## Structure

```
src/app/(app)/…            staff screens (Home, Schedule, Takings, Scan, Patients, ENT, Notifications, Settings)
src/app/book               public booking page (no login) — embeddable with ?embed=1
src/app/login|setup        sign-in, first-run doctor account
src/components/…           UI kit, brand (YSA badge/wordmark), feature components
src/proxy.ts               route guard (Next 16 "proxy", formerly middleware)
supabase/migrations        all schema changes (applied in order)
supabase/functions         send-whatsapp, scheduled-jobs, staff-admin, whatsapp-webhook
docs/whatsapp-templates.md templates to submit to Meta
```

## How things work

- **Access:** only active rows in `staff` can read/write anything (`private.is_staff()` in every RLS policy). Anonymous visitors can only call `get_booking_options`, `get_available_dates`, `get_available_slots` (times only) and `request_booking` (honeypot, consent check, per-IP/per-phone/global rate limits, advisory lock against double booking).
- **First run:** open `/setup` to create Dr Yusuf's account. It refuses once any staff account exists. Further staff are added in Settings → Staff.
- **Completing an appointment** creates a visit (DB trigger) → recalls recalculate (`next_due = last relevant visit + interval`, unless set manually) → the app opens "Record payment".
- **Scheduled jobs** (`pg_cron`, UTC): 06:00 UTC = 08:00 SAST daily (birthdays, recall reminders 7 days ahead, overdue recalls, ENT follow-ups) and hourly at :05 (24-hour appointment reminders, sent 08:00–19:59 SAST). The SQL functions are idempotent (dedupe keys / sent markers) and log to `job_runs`; the `scheduled-jobs` Edge Function sends the WhatsApp messages.
- **Scans** are compressed on the device (≤2000 px, JPEG 0.8), stored at `patients/{patient_id}/visits/{visit_id}/{front|back|audiogram}-{timestamp}.jpg`, and shown via short-lived signed URLs. `visit_scans.ai_status/ai_text` and `visits.ai_notes` are reserved for a future "Extract notes with AI" button.
