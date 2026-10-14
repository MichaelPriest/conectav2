-- Conecta ID is the server-authoritative gate for social-network access.
-- This migration deliberately fails closed: experimental OCR/QR/liveness and
-- client declarations never grant access. No source documents are stored here.
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
    join public.identity_verifications iv on iv.user_id = d.user_id
    where d.user_id = p_user_id
      and d.age_band in ('13_15', '16_17', '18_plus')
      and d.method in ('verified_age_credential', 'authorized_provider_callback')
      and d.verified_at <= now() + interval '1 minute'
      and d.verified_at >= now() - interval '60 days'
      and iv.status = 'approved'
      and iv.verified_at is not null
      and iv.verified_at <= now() + interval '1 minute'
      and iv.verified_at >= now() - interval '60 days'
      and (
        d.age_band = '18_plus'
        or exists (
          select 1
          from public.conecta_guardian_links gl
          join public.age_assurance_decisions gd
            on gd.user_id = gl.guardian_user_id
          join public.identity_verifications giv
            on giv.user_id = gl.guardian_user_id
          where gl.child_user_id = p_user_id
            and gl.status = 'accepted'
            and gd.age_band = '18_plus'
            and gd.method in ('verified_age_credential', 'authorized_provider_callback')
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
  'Server-side access gate. Requires a recent trusted identity approval and trusted age decision; minors also require an accepted link to an identity- and age-verified adult guardian.';

revoke all on function app_private.conecta_network_access_allowed(uuid) from public, anon;
grant usage on schema app_private to authenticated, service_role;
grant execute on function app_private.conecta_network_access_allowed(uuid) to anon, authenticated, service_role;

-- The user's own profile remains available for onboarding. An unverified user
-- can discover only verified profiles, which permits finding an adult guardian
-- without opening the social graph to unverified accounts.
alter table public.profiles enable row level security;
drop policy if exists conecta_id_verified_profile_discovery on public.profiles;
create policy conecta_id_verified_profile_discovery
  on public.profiles as restrictive for select to anon, authenticated
  using (
    auth.uid() is not null
    and (id = auth.uid()
    or app_private.conecta_network_access_allowed(auth.uid())
    or app_private.conecta_network_access_allowed(id))
  );

-- Restrictive policies combine with the existing per-table authorization rules;
-- they do not replace friendship, membership, privacy, or moderation checks.
do $policy$
declare
  table_name text;
  network_tables text[] := array[
    'communities',
    'community_members',
    'community_settings',
    'community_staff',
    'friendships',
    'conversations',
    'conversation_members',
    'conversation_pins',
    'conversation_typing',
    'messages',
    'message_reactions',
    'chat_calls',
    'chat_call_ice_candidates',
    'group_call_sessions',
    'group_call_participants',
    'group_call_signals',
    'chat_user_presence',
    'chat_push_subscriptions',
    'mobile_push_devices',
    'notifications',
    'posts',
    'post_comments',
    'post_likes',
    'post_media',
    'post_polls',
    'post_poll_options',
    'post_poll_votes',
    'stories',
    'saved_posts',
    'profile_details',
    'profile_favorites',
    'profile_guestbook',
    'profile_testimonials',
    'profile_visits',
    'user_achievements',
    'user_blocks',
    'monetization_interests'
  ];
begin
  foreach table_name in array network_tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('drop policy if exists conecta_id_network_access_required on public.%I', table_name);
      execute format(
        'create policy conecta_id_network_access_required on public.%I as restrictive for all to anon, authenticated using (app_private.conecta_network_access_allowed(auth.uid())) with check (app_private.conecta_network_access_allowed(auth.uid()))',
        table_name
      );
    end if;
  end loop;
end
$policy$;
