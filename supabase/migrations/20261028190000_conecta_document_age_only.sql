-- Age classification is distinct from identity ownership verification.
-- The service-role-only RPC never sets identity_verifications.status to approved.
alter table public.age_assurance_decisions
  drop constraint if exists age_assurance_decisions_method_check;
alter table public.age_assurance_decisions
  add constraint age_assurance_decisions_method_check
  check (method in (
    'verified_platform_age_signal',
    'verified_age_credential',
    'authorized_provider_callback',
    'conecta_free_document_face',
    'conecta_document_age_only'
  ));

create or replace function public.complete_conecta_document_age_assurance(
  p_user_id uuid,
  p_age_band text,
  p_evidence_reference_hash text,
  p_verified_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if p_user_id is null
     or p_age_band not in ('13_15','16_17','18_plus')
     or p_evidence_reference_hash is null
     or p_evidence_reference_hash !~ '^[0-9a-f]{64}$'
     or p_verified_at is null
     or p_verified_at > now() + interval '1 minute'
     or p_verified_at < now() - interval '1 minute' then
    raise exception 'Invalid age assurance arguments';
  end if;

  -- Never downgrade an existing stronger identity-backed age decision.
  insert into public.age_assurance_decisions (
    user_id, age_band, method, policy_version,
    evidence_reference_hash, verified_at, updated_at
  ) values (
    p_user_id, p_age_band, 'conecta_document_age_only',
    'conecta-document-age-only-v1', p_evidence_reference_hash,
    p_verified_at, p_verified_at
  )
  on conflict (user_id) do update set
    age_band = excluded.age_band,
    method = excluded.method,
    policy_version = excluded.policy_version,
    evidence_reference_hash = excluded.evidence_reference_hash,
    verified_at = excluded.verified_at,
    updated_at = excluded.updated_at
  where public.age_assurance_decisions.method not in
    ('verified_age_credential','authorized_provider_callback','conecta_free_document_face');

  return true;
end;
$$;
revoke all on function public.complete_conecta_document_age_assurance(uuid,text,text,timestamptz)
  from public, anon, authenticated;
grant execute on function public.complete_conecta_document_age_assurance(uuid,text,text,timestamptz)
  to service_role;
comment on function public.complete_conecta_document_age_assurance(uuid,text,text,timestamptz) is
  'Document-derived age classification only. Does not assert document ownership or unlock identity-gated access.';
