-- Short-lived, single-use server challenges for guided identity liveness.
-- Only hashes are stored; browser roles cannot read or mutate challenge records.
create table if not exists public.identity_liveness_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_hash text not null unique check (challenge_hash ~ '^[0-9a-f]{64}$'),
  turn_order text[] not null check (
    cardinality(turn_order) = 2
    and turn_order <@ array['left','right']::text[]
    and turn_order[1] <> turn_order[2]
  ),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists identity_liveness_challenges_user_created_idx
  on public.identity_liveness_challenges (user_id, created_at desc);

alter table public.identity_liveness_challenges enable row level security;
revoke all on table public.identity_liveness_challenges from public, anon, authenticated;
grant select, insert on table public.identity_liveness_challenges to service_role;

create or replace function public.consume_identity_liveness_challenge(
  p_user_id uuid,
  p_challenge_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  challenge_row public.identity_liveness_challenges%rowtype;
begin
  update public.identity_liveness_challenges
     set consumed_at = now()
   where user_id = p_user_id
     and challenge_hash = p_challenge_hash
     and consumed_at is null
     and expires_at > now()
  returning * into challenge_row;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'turn_order', challenge_row.turn_order,
    'expires_at', challenge_row.expires_at,
    'created_at', challenge_row.created_at
  );
end;
$$;

revoke all on function public.consume_identity_liveness_challenge(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_identity_liveness_challenge(uuid, text) to service_role;


-- The final Conecta ID flow stores only a minimal verdict and coarse age band.
-- Explicitly grant the service role the write permissions required by the server route.
grant select, insert, update on table public.age_assurance_decisions to service_role;
grant select, insert, update on table public.identity_verifications to service_role;
