-- ============================================================
-- 003_rls_policies.sql
-- Tonia CRM — Row Level Security
--
-- This is a small internal tool: any signed-in user is trusted
-- staff/owner, so authenticated users get full read/write on the
-- CRM tables. gmail_tokens holds OAuth secrets and is locked to
-- the service role only (used by server-side sync routes).
-- ============================================================

ALTER TABLE public.users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_tokens     ENABLE ROW LEVEL SECURITY;

-- Users: a user can read their own profile.
CREATE POLICY "users read own profile" ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Full access for authenticated users on the CRM tables.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'contacts', 'interactions', 'reminders',
    'events', 'registrations', 'emails', 'email_templates'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY "authenticated full access" ON public.%I
         FOR ALL TO authenticated USING (true) WITH CHECK (true);', t
    );
  END LOOP;
END $$;

-- gmail_tokens: no authenticated/anon access. Service role bypasses RLS,
-- so server routes using the service key can still read/write tokens.
-- (No policies created = deny all to authenticated/anon.)
