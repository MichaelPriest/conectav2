-- Count actual verification submissions, but do not penalize users for server failures.
-- Old ledger rows are treated as completed to preserve the existing rate limit.
alter table public.identity_free_verification_attempts
  add column if not exists status text not null default 'completed';

alter table public.identity_free_verification_attempts
  drop constraint if exists identity_free_verification_attempts_status_check;

alter table public.identity_free_verification_attempts
  add constraint identity_free_verification_attempts_status_check
  check (status in ('pending', 'completed'));

grant update on table public.identity_free_verification_attempts to service_role;

create or replace function public.start_conecta_identity_verification_attempt(
  p_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_attempt_count integer;
  v_attempt_id bigint;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  -- Serialize each user's reservation so parallel requests cannot race past 5.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select count(*)::integer
    into v_attempt_count
    from public.identity_free_verification_attempts a
   where a.user_id = p_user_id
     and a.attempted_at >= now() - interval '30 minutes'
     and (
       a.status = 'completed'
       or (
         a.status = 'pending'
         and a.attempted_at >= now() - interval '2 minutes'
       )
     );

  if v_attempt_count >= 5 then
    return jsonb_build_object(
      'allowed', false,
      'attempts_count', v_attempt_count,
      'attempt_id', null
    );
  end if;

  insert into public.identity_free_verification_attempts (user_id, status)
  values (p_user_id, 'pending')
  returning id into v_attempt_id;

  return jsonb_build_object(
    'allowed', true,
    'attempts_count', v_attempt_count + 1,
    'attempt_id', v_attempt_id
  );
end;
$function$;

revoke all on function public.start_conecta_identity_verification_attempt(uuid)
  from public, anon, authenticated;
grant execute on function public.start_conecta_identity_verification_attempt(uuid)
  to service_role;
