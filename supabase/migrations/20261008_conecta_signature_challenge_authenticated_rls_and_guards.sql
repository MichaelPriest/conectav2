BEGIN;
CREATE SCHEMA IF NOT EXISTS conecta_internal;
REVOKE ALL ON SCHEMA conecta_internal FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION conecta_internal.guard_identity_signature_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
 IF v_uid IS NULL OR NEW.user_id IS DISTINCT FROM v_uid THEN
  RAISE EXCEPTION 'Invalid identity challenge owner' USING ERRCODE='42501';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_uid::text)::bigint);
 IF (SELECT pg_catalog.count(*) FROM public.identity_signature_challenges
     WHERE user_id=v_uid AND created_at>pg_catalog.now()-interval '24 hours')>=3 THEN
  RAISE EXCEPTION 'Limite de 3 declaracoes a cada 24 horas' USING ERRCODE='P0001';
 END IF;
 NEW.nonce := pg_catalog.upper(pg_catalog.replace(pg_catalog.gen_random_uuid()::text,'-','')||
                               pg_catalog.replace(pg_catalog.gen_random_uuid()::text,'-',''));
 NEW.status := 'issued';
 NEW.created_at := pg_catalog.now();
 NEW.expires_at := pg_catalog.now()+interval '24 hours';
 NEW.attempt_count := 0;
 NEW.document_digest := NULL;
 NEW.inspected_at := NULL;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION conecta_internal.guard_identity_signature_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF pg_catalog.current_user='service_role' THEN RETURN NEW; END IF;
 IF auth.uid() IS NULL OR OLD.user_id IS DISTINCT FROM auth.uid()
   OR OLD.status <> 'issued' OR OLD.expires_at <= pg_catalog.now()
   OR OLD.attempt_count >= 5 THEN
    RAISE EXCEPTION 'Challenge expired or attempts exceeded' USING ERRCODE='42501';
 END IF;
 NEW.attempt_count:=OLD.attempt_count+1;
 RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_identity_signature_insert ON public.identity_signature_challenges;
CREATE TRIGGER guard_identity_signature_insert
BEFORE INSERT ON public.identity_signature_challenges
FOR EACH ROW EXECUTE FUNCTION conecta_internal.guard_identity_signature_insert();

DROP TRIGGER IF EXISTS guard_identity_signature_update ON public.identity_signature_challenges;
CREATE TRIGGER guard_identity_signature_update
BEFORE UPDATE ON public.identity_signature_challenges
FOR EACH ROW EXECUTE FUNCTION conecta_internal.guard_identity_signature_update();

CREATE POLICY conecta_signature_owner_select ON public.identity_signature_challenges
FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
CREATE POLICY conecta_signature_owner_insert ON public.identity_signature_challenges
FOR INSERT TO authenticated WITH CHECK (user_id=(SELECT auth.uid()) AND status='issued');
CREATE POLICY conecta_signature_owner_attempt ON public.identity_signature_challenges
FOR UPDATE TO authenticated USING (user_id=(SELECT auth.uid()) AND status='issued')
WITH CHECK (user_id=(SELECT auth.uid()) AND status='issued');

REVOKE ALL ON public.identity_signature_challenges FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.identity_signature_challenges TO authenticated;
GRANT UPDATE (attempt_count) ON public.identity_signature_challenges TO authenticated;
GRANT ALL ON public.identity_signature_challenges TO service_role;
COMMIT;
