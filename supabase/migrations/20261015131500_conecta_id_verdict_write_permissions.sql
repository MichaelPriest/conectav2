-- Atomic final verdict write for the free Conecta ID method.
-- The RPC records only identity status, coarse age band, and a hash reference.
grant select, insert, update on table public.age_assurance_decisions to service_role;
grant select, insert, update on table public.identity_verifications to service_role;

create or replace function public.complete_conecta_free_identity_verification(
  p_user_id uuid,
  p_age_band text,
  p_evidence_reference_hash text,
  p_verified_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null
     or p_age_band is null
     or p_age_band not in ('13_15','16_17','18_plus')
     or p_evidence_reference_hash is null
     or p_evidence_reference_hash !~ '^[0-9a-f]{64}$'
     or p_verified_at is null
     or p_verified_at > now() + interval '1 minute'
     or p_verified_at < now() - interval '1 minute' then
    raise exception 'Invalid Conecta ID verdict arguments';
  end if;

  insert into public.identity_verifications (
    user_id, provider, status, age_band, verified_at, updated_at
  ) values (
    p_user_id, 'conecta_free', 'approved', p_age_band, p_verified_at, p_verified_at
  )
  on conflict (user_id) do update set
    provider = excluded.provider,
    status = excluded.status,
    age_band = excluded.age_band,
    verified_at = excluded.verified_at,
    updated_at = excluded.updated_at;

  insert into public.age_assurance_decisions (
    user_id, age_band, method, policy_version,
    evidence_reference_hash, verified_at, updated_at
  ) values (
    p_user_id, p_age_band, 'conecta_free_document_face',
    'conecta-free-document-face-v1', p_evidence_reference_hash,
    p_verified_at, p_verified_at
  )
  on conflict (user_id) do update set
    age_band = excluded.age_band,
    method = excluded.method,
    policy_version = excluded.policy_version,
    evidence_reference_hash = excluded.evidence_reference_hash,
    verified_at = excluded.verified_at,
    updated_at = excluded.updated_at;

  return true;
end;
$$;

revoke all on function public.complete_conecta_free_identity_verification(uuid,text,text,timestamptz)
  from public, anon, authenticated;
grant execute on function public.complete_conecta_free_identity_verification(uuid,text,text,timestamptz)
  to service_role;
