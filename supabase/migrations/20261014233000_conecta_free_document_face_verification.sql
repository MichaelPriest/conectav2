-- Enable Conecta's own free document + face-match method.
-- Source images/QR data are not stored. The decision is a platform risk signal,
-- not an official issuer validation. RG/CNH QR formats may not have a public
-- cryptographic verifier, so the application must communicate that limitation.
alter table public.identity_verifications
  drop constraint if exists identity_verifications_provider_check;
alter table public.identity_verifications
  add constraint identity_verifications_provider_check
  check (provider in ('persona','conecta_free'));

alter table public.age_assurance_decisions
  drop constraint if exists age_assurance_decisions_method_check;
alter table public.age_assurance_decisions
  add constraint age_assurance_decisions_method_check
  check (method in (
    'verified_platform_age_signal',
    'verified_age_credential',
    'authorized_provider_callback',
    'conecta_free_document_face'
  ));

create or replace function app_private.conecta_network_access_allowed(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $function$
  select coalesce(exists (
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
  'Server-side gate: recent trusted identity + age decision. Conecta free document/face checks are platform checks, not official issuer validation. Minors require an accepted link to a verified adult guardian.';
