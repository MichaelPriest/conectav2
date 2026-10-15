-- Roll back the proposed broad access exemption. The exception is now limited to
-- opening/editing @edilenesilva's own profile page; all server-side social-table gates
-- continue to require the existing trusted identity/age decision.
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
  'Server-side access gate: recent trusted identity + age decision. Minors require an accepted link to a verified adult guardian.';
drop table if exists public.identity_access_exemptions;
