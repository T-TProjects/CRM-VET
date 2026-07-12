-- ============================================================
-- 005_organiser.sql
-- Tonia CRM — conference organiser fields.
--   * event venue / dinner / catering details
--   * per-attendee day & dinner attendance, room type, travel
--   * run sheet (order of the day) line items
--   * budget line items
-- Safe to re-run.
-- ============================================================

-- Event organising details.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue            TEXT,
  ADD COLUMN IF NOT EXISTS dinner_venue     TEXT,
  ADD COLUMN IF NOT EXISTS catering_contact TEXT;

-- Per-attendee attendance + logistics for this event.
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS day1_attending    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS day2_attending    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dinner1_attending BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dinner2_attending BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS room_type         TEXT,
  ADD COLUMN IF NOT EXISTS travel_notes      TEXT;

-- Run sheet (order of the day) — one row per session / activity.
CREATE TABLE IF NOT EXISTS public.event_agenda_items (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  day        TEXT,
  start_time TEXT,
  title      TEXT,
  presenter  TEXT,
  location   TEXT,
  notes      TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS event_agenda_items_event_idx ON public.event_agenda_items(event_id);
COMMENT ON TABLE public.event_agenda_items IS 'Run sheet: sessions / activities for an event day';

-- Budget line items — one row per cost line.
CREATE TABLE IF NOT EXISTS public.event_budget_items (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  category   TEXT,
  estimated  NUMERIC(12,2),
  actual     NUMERIC(12,2),
  notes      TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS event_budget_items_event_idx ON public.event_budget_items(event_id);
COMMENT ON TABLE public.event_budget_items IS 'Budget line items for an event';

-- RLS: same "authenticated full access" pattern as the other CRM tables.
ALTER TABLE public.event_agenda_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_budget_items ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['event_agenda_items', 'event_budget_items']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "authenticated full access" ON public.%I;', t);
    EXECUTE format(
      'CREATE POLICY "authenticated full access" ON public.%I
         FOR ALL TO authenticated USING (true) WITH CHECK (true);', t
    );
  END LOOP;
END $$;
