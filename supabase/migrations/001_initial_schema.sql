-- ============================================================
-- 001_initial_schema.sql
-- Tonia CRM — core CRM tables (contacts, interactions,
-- reminders, emails, gmail tokens)
-- ============================================================

-- App user profiles, linked to Supabase auth.
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'staff')),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.users IS 'App user profiles linked to Supabase auth';

-- Contacts = the people/clients whose relationships are tracked.
CREATE TABLE IF NOT EXISTS public.contacts (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name                TEXT NOT NULL,
  organization        TEXT,
  email               TEXT,
  phone               TEXT,
  status              TEXT NOT NULL DEFAULT 'prospect'
                        CHECK (status IN ('prospect', 'active', 'inactive')),
  dietary_needs       TEXT,
  accommodation_notes TEXT,
  notes               TEXT,
  last_contact_date   TIMESTAMPTZ,
  created_by          UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS contacts_email_idx  ON public.contacts(email);
CREATE INDEX IF NOT EXISTS contacts_status_idx ON public.contacts(status);

COMMENT ON TABLE public.contacts IS 'People / clients tracked in the CRM';

-- Interactions = a relationship log (calls, meetings, notes, etc.).
CREATE TABLE IF NOT EXISTS public.interactions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type        TEXT NOT NULL DEFAULT 'note'
                CHECK (type IN ('call', 'email', 'meeting', 'conference', 'note', 'other')),
  subject     TEXT NOT NULL,
  notes       TEXT,
  outcome     TEXT,
  date        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  contact_id  UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  event_id    UUID,  -- FK added in 002 once events exists
  logged_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS interactions_contact_idx ON public.interactions(contact_id);
CREATE INDEX IF NOT EXISTS interactions_date_idx    ON public.interactions(date);

COMMENT ON TABLE public.interactions IS 'Relationship activity log';

-- Reminders / follow-ups.
CREATE TABLE IF NOT EXISTS public.reminders (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title         TEXT NOT NULL,
  notes         TEXT,
  due_date      TIMESTAMPTZ NOT NULL,
  completed     BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  contact_id    UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  event_id      UUID,  -- FK added in 002
  created_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS reminders_due_idx       ON public.reminders(due_date);
CREATE INDEX IF NOT EXISTS reminders_completed_idx ON public.reminders(completed);

COMMENT ON TABLE public.reminders IS 'Follow-up reminders';

-- Emails synced from Gmail (notifications + reply tracking).
CREATE TABLE IF NOT EXISTS public.emails (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gmail_id         TEXT,
  message_id       TEXT,
  thread_id        TEXT,
  from_email       TEXT NOT NULL,
  from_name        TEXT,
  subject          TEXT NOT NULL,
  body_text        TEXT,
  received_at      TIMESTAMPTZ NOT NULL,
  is_read          BOOLEAN NOT NULL DEFAULT FALSE,
  contact_id       UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  event_id         UUID,  -- FK added in 002
  registration_id  UUID,  -- FK added in 002
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS emails_gmail_id_idx   ON public.emails(gmail_id)   WHERE gmail_id IS NOT NULL;
CREATE INDEX        IF NOT EXISTS emails_thread_idx     ON public.emails(thread_id);
CREATE INDEX        IF NOT EXISTS emails_from_idx       ON public.emails(from_email);
CREATE INDEX        IF NOT EXISTS emails_received_idx   ON public.emails(received_at);

COMMENT ON TABLE public.emails IS 'Emails synced from connected Gmail accounts';

-- Gmail OAuth tokens for connected inboxes.
CREATE TABLE IF NOT EXISTS public.gmail_tokens (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  access_token   TEXT NOT NULL,
  refresh_token  TEXT NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.gmail_tokens IS 'OAuth tokens for connected Gmail inboxes';
