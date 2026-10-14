-- One-time challenges used to bind Play Integrity tokens to age-signal payloads.
-- Raw challenges are returned once to the authenticated caller; only SHA-256
-- hashes are stored. Client roles cannot read or mutate these records.
create table if not exists public.age_assurance_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_hash text not null check (challenge_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint age_assurance_challenges_hash_unique unique (challenge_hash)
);

create index if not exists age_assurance_challenges_user_created_idx
  on public.age_assurance_challenges (user_id, created_at desc);

alter table public.age_assurance_challenges enable row level security;
revoke all on table public.age_assurance_challenges from public, anon, authenticated;
grant select, insert on table public.age_assurance_challenges to service_role;

create or replace function public.consume_age_assurance_challenge(
  p_user_id uuid,
  p_challenge_hash text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.age_assurance_challenges
     set consumed_at = now()
   where user_id = p_user_id
     and challenge_hash = p_challenge_hash
     and consumed_at is null
     and expires_at > now();

  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

revoke all on function public.consume_age_assurance_challenge(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_age_assurance_challenge(uuid, text) to service_role;
