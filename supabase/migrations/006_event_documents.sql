-- ============================================================
-- 006_event_documents.sql
-- Tonia CRM — a list of named document links per conference
-- (e.g. Agenda, Pre-reading, Map). Stored as JSON:
--   [{ "label": "Agenda", "url": "https://..." }, ...]
-- Safe to re-run.
-- ============================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS documents JSONB NOT NULL DEFAULT '[]'::jsonb;
