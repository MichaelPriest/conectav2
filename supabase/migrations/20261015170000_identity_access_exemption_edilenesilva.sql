-- Explicit per-account exception: do not require document-based identity verification for
-- @edilenesilva. This is an access exception only; it does not create a verified identity
-- or age credential. It is usable only while the account retains an 18+ self-declaration.
create table if not exists public.identity_access_exemptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 8 and 500),
  is_active boolean not null default true,
  granted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.identity_access_exemptions enable row level security;
revoke all on table public.identity_access_exemptions from public, anon, authenticated;
grant select, insert, update, delete on table public.identity_access_exemptions to service_role;

comment on table public.identity_access_exemptions is
  'Private-by-RLS account exceptions to the document-based Conecta ID gate. An exemption is not identity verification and never writes an approved identity or age decision.';

do $migration$
declare
  target_user_id uuid;
begin
  select p.id into target_user_id
  from public.profiles p
  where lower(p.handle) = 'edilenesilva'
  limit 1;

  if target_user_id is null then
    raise exception 'Cannot grant the requested exception: profile @edilenesilva was not found';
  end if;

  if not exists (
    select 1
    from public.registration_age_declarations d
    where d.user_id = target_user_id
      and d.declared_band = '18_plus'
  ) then
    raise exception 'Cannot grant the requested exception: @edilenesilva does not have an 18+ age declaration';
  end if;

  insert into public.identity_access_exemptions (user_id, reason, is_active)
  values (
    target_user_id,
    'Specific account exemption requested by the account owner: do not require document submission. This does not establish or claim verified identity or verified age; an 18+ self-declaration remains required.',
    true
  )
  on conflict (user_id) do update
    set reason = excluded.reason,
        is_active = true,
        updated_at = now();
end;
$migration$;

-- Keep the navigation/API gate and database RLS gate consistent.
-- Normal users still require recent trusted identity + age checks. This one explicit
-- exception only bypasses that requirement while the account declares 18+.
create or replace function app_private.conecta_network_access_allowed(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $function$
  select
    coalesce(exists (
      select 1
      from public.identity_access_exemptions e
      join public.registration_age_declarations rd on rd.user_id = e.user_id
      where e.user_id = p_user_id
        and e.is_active
        and rd.declared_band = '18_plus'
    ), false)
    or
    coalesce(exists (
      select 1
      from public.age_assurance_decisions d
      join public.registration_age_declarations rd on rd.user_id = d.user_id
      join public.identity_verifications iv on iv.user_id = d.user_id
      where d.user_id = p_user_id
        and d.age_band in ('13_15', '16_17', '18_plus')
        and d.method in ('verified_age_credential', 'authorized_provider_callback', 'conecta_free_document_face')
        and d.verified_at <= now() + interval '1 minute'
        and d.verified_at >= now() - interval '60 days'
        and iv.status = 'approved'
        and iv.verified_at is not null
        and iv.verified_at <= now() + interval '1 minute'
        and iv.verified_at >= now() - interval '60 days'
        and (
          (d.age_band = '18_plus' and rd.declared_band = '18_plus')
          or exists (
            select 1
            from public.conecta_guardian_links gl
            join public.age_assurance_decisions gd on gd.user_id = gl.guardian_user_id
            join public.identity_verifications giv on giv.user_id = gl.guardian_user_id
            where gl.child_user_id = p_user_id
              and gl.status = 'accepted'
              and gd.age_band = '18_plus'
              and gd.method in ('verified_age_credential', 'authorized_provider_callback', 'conecta_free_document_face')
              and gd.verified_at <= now() + interval '1 minute'
              and gd.verified_at >= now() - interval '60 days'
              and giv.status = 'approved'
              and giv.verified_at is not null
              and giv.verified_at <= now() + interval '1 minute'
              and giv.verified_at >= now() - interval '60 days'
          )
        )
    ), false);
$function$;

comment on function app_private.conecta_network_access_allowed(uuid) is
  'Server-side access gate. Normally requires recent trusted identity and age evidence; an explicit account exemption permits app access only while the 18+ self-declaration remains and does not mark identity or age as verified. Minors normally require an accepted link to a verified adult guardian.';
