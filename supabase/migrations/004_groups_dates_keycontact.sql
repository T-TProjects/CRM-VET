-- ============================================================
-- 004_groups_dates_keycontact.sql
-- Tonia CRM — contact groups, per-attendee accommodation dates,
-- and an optional key contact (coordinator) per event.
-- Safe to re-run.
-- ============================================================

-- Contact groups: free-form labels for organising/filtering (e.g. "Speakers", "VIPs").
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS groups TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS contacts_groups_idx ON public.contacts USING GIN (groups);

-- Per-attendee accommodation arrival/departure (may differ from the event dates).
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS arrival_date   DATE;
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS departure_date DATE;

-- Key contact = the coordinator who supplies the attendee list for an event.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS key_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;
