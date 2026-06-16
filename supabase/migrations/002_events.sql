-- ============================================================
-- 002_events.sql
-- Tonia CRM — conference/events layer + email templates
-- ============================================================

-- Events = conferences (or any event people sign up to).
CREATE TABLE IF NOT EXISTS public.events (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  location    TEXT,
  starts_at   TIMESTAMPTZ,
  ends_at     TIMESTAMPTZ,
  agenda_url  TEXT,
  status      TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'upcoming', 'active', 'completed', 'cancelled')),
  created_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS events_status_idx ON public.events(status);
CREATE INDEX IF NOT EXISTS events_starts_idx ON public.events(starts_at);

COMMENT ON TABLE public.events IS 'Conferences / events that contacts sign up to';

-- Registrations = a contact's signup to an event (the join + per-event needs).
CREATE TABLE IF NOT EXISTS public.registrations (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id              UUID NOT NULL REFERENCES public.events(id)   ON DELETE CASCADE,
  contact_id            UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'invited'
                          CHECK (status IN ('invited', 'signed_up', 'declined', 'attended', 'no_show')),
  accommodation_needed  BOOLEAN NOT NULL DEFAULT FALSE,
  accommodation_notes   TEXT,
  dietary_needs         TEXT,
  agenda_sent_at        TIMESTAMPTZ,
  notified_at           TIMESTAMPTZ,
  replied_at            TIMESTAMPTZ,
  response_notes        TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (event_id, contact_id)
);

CREATE INDEX IF NOT EXISTS registrations_event_idx   ON public.registrations(event_id);
CREATE INDEX IF NOT EXISTS registrations_contact_idx ON public.registrations(contact_id);
CREATE INDEX IF NOT EXISTS registrations_status_idx  ON public.registrations(status);

COMMENT ON TABLE public.registrations IS 'A contact signed up to an event, with per-event needs and response tracking';

-- Now that events/registrations exist, wire the deferred foreign keys.
ALTER TABLE public.interactions
  ADD CONSTRAINT interactions_event_fk
  FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;

ALTER TABLE public.reminders
  ADD CONSTRAINT reminders_event_fk
  FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;

ALTER TABLE public.emails
  ADD CONSTRAINT emails_event_fk
  FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;

ALTER TABLE public.emails
  ADD CONSTRAINT emails_registration_fk
  FOREIGN KEY (registration_id) REFERENCES public.registrations(id) ON DELETE SET NULL;

-- Email templates for template auto-responses.
CREATE TABLE IF NOT EXISTS public.email_templates (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.email_templates IS 'Reusable email templates; bodies support {{placeholders}}';

-- Seed the default templates the automation relies on.
INSERT INTO public.email_templates (key, name, subject, body) VALUES
  (
    'event_invite',
    'Event invitation',
    'You''re invited: {{event_name}}',
    E'Hi {{contact_name}},\n\nWe''d love to have you at {{event_name}} on {{event_date}} at {{event_location}}.\n\nPlease reply to let us know if you can make it, and tell us about any accommodation or dietary needs.\n\nWarm regards,\nTonia'
  ),
  (
    'agenda',
    'Agenda send',
    'Agenda for {{event_name}}',
    E'Hi {{contact_name}},\n\nThanks for signing up to {{event_name}}. Here is the agenda:\n\n{{agenda_url}}\n\nIf you have any accommodation or dietary requirements, just reply to this email.\n\nSee you there,\nTonia'
  ),
  (
    'no_reply_chase',
    'No-reply follow-up',
    'Following up: {{event_name}}',
    E'Hi {{contact_name}},\n\nJust following up on my note about {{event_name}}. Are you able to join us?\n\nA quick reply either way would be a big help.\n\nThanks,\nTonia'
  )
ON CONFLICT (key) DO NOTHING;
