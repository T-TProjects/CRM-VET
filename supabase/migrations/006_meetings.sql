-- ============================================================
-- 006_meetings.sql
-- Tonia CRM — Board Meeting Recorder.
--   * meetings table: one row per recorded board / committee meeting
--   * private storage bucket for the audio recordings
--   * RLS: same "authenticated full access" pattern as the other tables
-- Safe to re-run.
-- ============================================================

-- One row per recorded meeting.
CREATE TABLE IF NOT EXISTS public.meetings (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title            TEXT NOT NULL,
  meeting_date     DATE,
  location         TEXT,
  -- Optionally tie a meeting to a conference/event in the CRM.
  event_id         UUID REFERENCES public.events(id) ON DELETE SET NULL,
  -- Free-text attendee names (board members present).
  attendees        TEXT[] NOT NULL DEFAULT '{}',
  -- Lifecycle: draft -> transcribing -> transcribed -> drafting -> ready -> failed
  status           TEXT NOT NULL DEFAULT 'draft',
  -- Storage path of the uploaded audio (in the meeting-audio bucket).
  audio_path       TEXT,
  -- AssemblyAI transcript job id (used while transcription is in progress).
  assembly_id      TEXT,
  -- Full plain-text transcript once transcription finishes.
  transcript       TEXT,
  -- Speaker-labelled segments: [{ speaker, text, start, end }]
  utterances       JSONB,
  -- Structured minutes drafted by the AI (attendees, decisions, actions, etc.).
  minutes          JSONB,
  duration_seconds INTEGER,
  -- Last error message, if a step failed.
  error            TEXT,
  created_by       UUID,
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS meetings_created_idx ON public.meetings(created_at DESC);
CREATE INDEX IF NOT EXISTS meetings_event_idx ON public.meetings(event_id);
COMMENT ON TABLE public.meetings IS 'Board / committee meeting recordings, transcripts, and AI-drafted minutes';

-- RLS: same "authenticated full access" pattern as the other CRM tables.
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "authenticated full access" ON public.meetings;';
  EXECUTE
    'CREATE POLICY "authenticated full access" ON public.meetings
       FOR ALL TO authenticated USING (true) WITH CHECK (true);';
END $$;

-- ------------------------------------------------------------
-- Private storage bucket for the raw audio recordings.
-- The browser uploads the recording here, then hands AssemblyAI a
-- short-lived signed URL — this keeps large files off the Vercel
-- API routes (which cap request bodies at ~4.5 MB).
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-audio', 'meeting-audio', false)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can read/write/remove objects in this bucket only.
DO $$
DECLARE
  op TEXT;
  policy_name TEXT;
BEGIN
  FOREACH op IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']
  LOOP
    policy_name := 'meeting-audio auth ' || lower(op);
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects;', policy_name);
    IF op = 'INSERT' THEN
      EXECUTE format(
        'CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated
           WITH CHECK (bucket_id = ''meeting-audio'');', policy_name);
    ELSE
      EXECUTE format(
        'CREATE POLICY %I ON storage.objects FOR %s TO authenticated
           USING (bucket_id = ''meeting-audio'');', policy_name, op);
    END IF;
  END LOOP;
END $$;
