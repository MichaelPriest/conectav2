-- Conecta ID: only provider attestations. Never store raw selfies, CPF, ID photos,
-- biometric templates or official document numbers in this database.
create table if not exists public.identity_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'persona' check (provider = 'persona'),
  provider_inquiry_id text unique,
  status text not null default 'pending'
    check (status in ('pending','approved','declined','failed','expired')),
  age_band text not null default 'unknown'
    check (age_band in ('unknown','under_13','13_to_16','17','18_plus')),
  guardian_status text not null default 'pending'
    check (guardian_status in ('pending','approved','not_required')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_at timestamptz
);
create index if not exists identity_verifications_status_idx
  on public.identity_verifications(status, updated_at);
alter table public.identity_verifications enable row level security;
revoke all on public.identity_verifications from anon, authenticated;
grant select on public.identity_verifications to authenticated;
create policy "user reads own provider attestation"
  on public.identity_verifications for select to authenticated
  using (user_id = (select auth.uid()));
-- No INSERT, UPDATE or DELETE for client roles: provider decision is server-only.
