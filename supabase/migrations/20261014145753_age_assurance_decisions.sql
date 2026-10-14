-- ECA Digital: minimal server-authoritative age-assurance result.
-- This table intentionally stores no date of birth, document image, QR/JWS,
-- selfie, biometric template, or raw provider payload.
-- Only trusted server-side integrations may write through the service role.
create table if not exists public.age_assurance_decisions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  age_band text not null check (age_band in ('0_12', '13_15', '16_17', '18_plus')),
  method text not null check (method in (
    'verified_platform_age_signal',
    'verified_age_credential',
    'authorized_provider_callback'
  )),
  policy_version text not null check (length(policy_version) between 1 and 64),
  evidence_reference_hash text not null check (evidence_reference_hash ~ '^[0-9a-f]{64}$'),
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.age_assurance_decisions is
  'Minimal server-authoritative age assurance result; never store source documents or biometric data here.';
comment on column public.age_assurance_decisions.age_band is
  'Coarse age band only. No exact date of birth is stored.';
comment on column public.age_assurance_decisions.evidence_reference_hash is
  'SHA-256 hash of an opaque verification evidence reference, not the raw reference or document data.';

alter table public.age_assurance_decisions enable row level security;
revoke all on table public.age_assurance_decisions from public, anon, authenticated;
grant select on table public.age_assurance_decisions to service_role;
