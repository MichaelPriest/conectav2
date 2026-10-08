-- Fixes a trigger runtime SQL error: current_user is a SQL keyword, not a schema-qualified function.
-- Kept SECURITY DEFINER in a non-exposed schema with explicit owner checks.
-- Authenticated users may only update attempt_count; cannot self-verify identity or age.
CREATE OR REPLACE FUNCTION conecta_internal.guard_identity_signature_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
 IF auth.uid() IS NULL
    OR OLD.user_id IS DISTINCT FROM auth.uid()
    OR OLD.status <> 'issued'
    OR OLD.expires_at <= pg_catalog.now()
    OR OLD.attempt_count >= 5 THEN
   RAISE EXCEPTION 'Challenge expired or attempts exceeded' USING ERRCODE='42501';
 END IF;
 IF (pg_catalog.to_jsonb(NEW) - 'attempt_count') IS DISTINCT FROM
    (pg_catalog.to_jsonb(OLD) - 'attempt_count') THEN
   RAISE EXCEPTION 'Only attempt_count may be changed' USING ERRCODE='42501';
 END IF;
 NEW.attempt_count := OLD.attempt_count + 1;
 RETURN NEW;
END;
$fn$;
