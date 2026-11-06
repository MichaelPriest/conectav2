-- Selfie age estimates are age-only, never proof of document ownership.
-- Service role is the sole writer. Do not persist photos, embeddings or raw age.
alter table public.age_assurance_decisions
  drop constraint if exists age_assurance_decisions_method_check;
alter table public.age_assurance_decisions
  add constraint age_assurance_decisions_method_check
  check (method in (
    'verified_platform_age_signal','verified_age_credential',
    'authorized_provider_callback','conecta_free_document_face',
    'conecta_document_age_only','conecta_selfie_age_estimate'
  ));

create or replace function public.complete_conecta_selfie_age_assurance(
  p_user_id uuid,p_evidence_reference_hash text,p_verified_at timestamptz
) returns boolean language plpgsql security definer
set search_path = public,pg_catalog as $$
begin
  if p_user_id is null
    or p_evidence_reference_hash is null
    or p_evidence_reference_hash !~ '^[0-9a-f]{64}$'
    or p_verified_at is null
    or p_verified_at > now()+interval '1 minute'
    or p_verified_at < now()-interval '1 minute'
    or not exists(select 1 from public.registration_age_declarations r
      where r.user_id=p_user_id and r.declared_band='18_plus') then
    raise exception 'Invalid age assurance arguments';
  end if;
  insert into public.age_assurance_decisions(
    user_id,age_band,method,policy_version,evidence_reference_hash,verified_at,updated_at
  ) values (
    p_user_id,'18_plus','conecta_selfie_age_estimate',
    'conecta-selfie-age-v1',p_evidence_reference_hash,p_verified_at,p_verified_at
  )
  on conflict (user_id) do update set
    age_band=excluded.age_band,method=excluded.method,
    policy_version=excluded.policy_version,
    evidence_reference_hash=excluded.evidence_reference_hash,
    verified_at=excluded.verified_at,updated_at=excluded.updated_at
  where public.age_assurance_decisions.method='conecta_selfie_age_estimate';
  return true;
end;
$$;
revoke all on function public.complete_conecta_selfie_age_assurance(uuid,text,timestamptz)
  from public,anon,authenticated;
grant execute on function public.complete_conecta_selfie_age_assurance(uuid,text,timestamptz)
  to service_role;

-- Reuse existing server-authorized adult-only ordinary social gate.
-- Private chat and identity-protected operations remain unchanged.
create or replace function app_private.conecta_basic_feed_allowed(p_user_id uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog,public,app_private as $function$
 select p_user_id is not null and exists (
   select 1 from public.age_assurance_decisions d
   join public.registration_age_declarations rd on rd.user_id=d.user_id
   join public.profiles pr on pr.id=d.user_id
   where d.user_id=p_user_id
     and rd.declared_band='18_plus' and d.age_band='18_plus'
     and d.method in ('conecta_document_age_only','conecta_selfie_age_estimate')
     and d.verified_at <= now()+interval '1 minute'
     and d.verified_at >= now()-interval '60 days'
     and d.evidence_reference_hash ~ '^[0-9a-f]{64}$'
 );
$function$;
revoke all on function app_private.conecta_basic_feed_allowed(uuid) from public,anon;
grant usage on schema app_private to authenticated,service_role;
grant execute on function app_private.conecta_basic_feed_allowed(uuid) to authenticated,service_role;
