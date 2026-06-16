# Tonia CRM

A small CRM for tracking client relationships and running conference signups:
contacts, conferences, per-event accommodation/dietary needs, email notifications
with reply tracking, and template-based auto follow-ups.

Built on the same stack as the CCAU dashboard (Next.js 14 + Supabase + Vercel),
with only the CRM core carried over. No payments/accounting.

## Features
- **Contacts** — people/clients with status, standing dietary + accommodation notes.
- **Conferences** — events with dates, location, agenda link, status.
- **Registrations** — sign contacts up to a conference; track per-event accommodation
  and dietary needs, and who has responded (invited / signed up / declined / attended).
- **Email notifications** — send invites and the agenda through a connected Gmail account.
- **Reply tracking** — hourly Gmail sync stamps who has replied; the rest show as "waiting".
- **Template auto-responses** — editable templates; a daily job chases attendees who
  were notified but haven't replied after a few days.
- **Reminders** — manual follow-ups.

## Local development
```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # http://localhost:3000
```

## Setup
1. **Supabase** — create a project. In the SQL editor, run the files in
   `supabase/migrations/` in order (001, 002, 003).
2. **First user** — in Supabase Auth, create a user (email + password). Then add a
   matching row in `public.users` (`id` = the auth user id, `role` = `owner`).
3. **Gmail** — create an OAuth client (Web application) in Google Cloud Console with
   redirect URI `{NEXT_PUBLIC_APP_URL}/api/gmail/callback`. Put the client id/secret in
   the env. Connect the account in-app under **Settings → Gmail**.
4. **Env** — fill `.env.local` from `.env.example`.

## Deploy (Vercel)
1. Push to GitHub and import the repo in Vercel (Next.js auto-detected).
2. Add all env vars from `.env.example` (set `NEXT_PUBLIC_APP_URL` to the production URL).
3. The cron jobs in `vercel.json` run automatically:
   - `/api/cron/gmail-sync` — hourly inbox sync + reply detection.
   - `/api/cron/no-reply-chase` — daily chase of un-replied invitations.
   Both authenticate with the `CRON_SECRET` header.

## Email templates
Edit under **Settings**. Placeholders: `{{contact_name}}`, `{{event_name}}`,
`{{event_date}}`, `{{event_location}}`, `{{agenda_url}}`.

See `SPEC.md` for the full data model and build notes.
