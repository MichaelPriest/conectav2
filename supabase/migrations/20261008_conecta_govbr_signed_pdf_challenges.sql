-- Conecta ID gov.br signed PDF challenge. Created in Supabase 2026-10-08.
-- PDFs and personal data are never stored; no badge/age access granted.
CREATE TABLE IF NOT EXISTS public.identity_signature_challenges (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 nonce text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','integrity_checked')),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT (now()+interval '24 hours'),
 inspected_at timestamptz,
 document_digest text,
 attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 20)
);
CREATE INDEX IF NOT EXISTS identity_signature_challenges_user_created ON public.identity_signature_challenges(user_id,created_at DESC);
ALTER TABLE public.identity_signature_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.identity_signature_challenges FROM anon,authenticated,public;
GRANT ALL ON public.identity_signature_challenges TO service_role;
