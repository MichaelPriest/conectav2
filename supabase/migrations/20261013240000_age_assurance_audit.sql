-- Append-only audit trail for accepted age-assurance decisions.
-- This table contains only coarse age bands and opaque evidence hashes.
create table if not exists public.age_assurance_audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('verified_minor', 'verified_adult')),
  age_band text not null check (age_band in ('0_12', '13_15', '16_17', '18_plus')),
  method text not null check (method in (
    'verified_platform_age_signal',
    'verified_age_credential',
    'authorized_provider_callback'
  )),
  policy_version text not null check (length(policy_version) between 1 and 64),
  evidence_reference_hash text not null check (evidence_reference_hash ~ '^[0-9a-f]{64}$'),
  verified_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists age_assurance_audit_events_user_created_idx
  on public.age_assurance_audit_events (user_id, created_at desc);

alter table public.age_assurance_audit_events enable row level security;
revoke all on table public.age_assurance_audit_events from public, anon, authenticated;
grant select, insert, update, delete on table public.age_assurance_audit_events to service_role;

-- Write the current decision and append its audit event atomically.
create or replace function public.record_age_assurance_decision(
  p_user_id uuid,
  p_age_band text,
  p_method text,
  p_policy_version text,
  p_evidence_reference_hash text,
  p_verified_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_age_band not in ('0_12', '13_15', '16_17', '18_plus')
     or p_method not in ('verified_platform_age_signal', 'verified_age_credential', 'authorized_provider_callback')
     or p_evidence_reference_hash !~ '^[0-9a-f]{64}$'
     or p_policy_version is null
     or length(p_policy_version) < 1
     or length(p_policy_version) > 64
     or p_verified_at is null
     or p_verified_at > now() + interval '1 minute'
     or p_verified_at < now() - interval '2 minutes' then
    return false;
  end if;

  insert into public.age_assurance_decisions (
    user_id, age_band, method, policy_version, evidence_reference_hash, verified_at, updated_at
  ) values (
    p_user_id, p_age_band, p_method, p_policy_version, p_evidence_reference_hash, p_verified_at, now()
  )
  on conflict (user_id) do update set
    age_band = excluded.age_band,
    method = excluded.method,
    policy_version = excluded.policy_version,
    evidence_reference_hash = excluded.evidence_reference_hash,
    verified_at = excluded.verified_at,
    updated_at = now();

  insert into public.age_assurance_audit_events (
    user_id, event_type, age_band, method, policy_version, evidence_reference_hash, verified_at
  ) values (
    p_user_id,
    case when p_age_band = '18_plus' then 'verified_adult' else 'verified_minor' end,
    p_age_band,
    p_method,
    p_policy_version,
    p_evidence_reference_hash,
    p_verified_at
  );

  return true;
end;
$$;

revoke all on function public.record_age_assurance_decision(uuid, text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.record_age_assurance_decision(uuid, text, text, text, text, timestamptz) to service_role;
