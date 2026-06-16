# Tonia CRM — Spec & Build Checklist

A small CRM to track client relationships and run conference signups, built on the
same stack as the CCAU dashboard but with only the CRM core carried over (no Stripe,
accounting, or financial logic).

## Stack
- Next.js 14 (App Router) + TypeScript
- Supabase (Postgres + Auth)
- Tailwind CSS + shadcn/ui
- Gmail API (email notifications + reply tracking)
- Vercel (hosting + cron)

## Core features
1. **Contacts** — clients/people, status, standing dietary + accommodation notes, notes, last-contact.
2. **Conferences/Events** — name, dates, location, agenda link, status.
3. **Registrations** — a contact signed up to an event, with per-event accommodation
   + dietary needs and response tracking (invited / signed up / declined / attended).
4. **Grouping** — view everyone for a given event and see, at a glance, who has responded.
5. **Email notifications** — send invites/agenda via connected Gmail.
6. **Reply tracking** — Gmail sync detects replies on the thread and stamps `replied_at`.
7. **Template auto-responses** — send the agenda on signup; chase contacts with no reply
   after N days. Templates are editable, with `{{placeholders}}`.
8. **Reminders** — manual follow-ups.

## Data model
- `users` — app profiles linked to Supabase auth (role: owner | staff).
- `contacts` — people/clients.
- `events` — conferences.
- `registrations` — contact ↔ event join + per-event needs + response tracking.
- `interactions` — relationship log.
- `reminders` — follow-ups.
- `emails` + `gmail_tokens` — Gmail sync, reply tracking.
- `email_templates` — template auto-responses (seeded: event_invite, agenda, no_reply_chase).

## Build phases
- [x] **Phase 1 — Foundation:** config, Supabase clients, types, schema migrations (001–003).
- [x] **Phase 2 — Auth + shell:** UI kit, login, middleware, dashboard layout + sidebar, dashboard home.
- [x] **Phase 3 — CRM + events UI:** contacts, events, event detail (registrations + who-responded), reminders.
- [x] **Phase 4 — Email + automation:** Gmail connect/sync, reply tracking, template send, no-reply chase cron.
- [x] **Phase 5 — Polish:** seed script, README deploy guide.

## Verification status
- `tsc --noEmit` passes; `next build` builds all 19 routes; dev server serves `/login` (200).
- Not yet exercised against a live Supabase project (needs the setup steps below).

## What still needs the user (cannot be done without credentials)
1. Create a Supabase project; run `supabase/migrations/*.sql` in order.
2. Create the first auth user + matching `public.users` row (role `owner`).
3. Create a Google OAuth client; set redirect URI `{APP_URL}/api/gmail/callback`.
4. Fill `.env.local` / Vercel env from `.env.example`, then deploy.

## Deployment (high level)
1. Create a Supabase project; run `supabase/migrations/*.sql` in order.
2. Create a Google OAuth client; set redirect URI to `{APP_URL}/api/gmail/callback`.
3. Deploy to Vercel; set env vars from `.env.example`; add the cron jobs (in `vercel.json`).
4. Create the first user in Supabase Auth and a matching row in `public.users`.
