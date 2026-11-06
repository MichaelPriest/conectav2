-- Restore ordinary social features for adults whose age was classified
-- by Conecta ID without falsely approving document ownership.
-- Chat, calls and other sensitive account flows remain identity-gated.
create or replace function app_private.conecta_social_access_allowed(p_user_id uuid)
returns boolean
language sql stable security definer
set search_path = pg_catalog, public, app_private
as $function$
 select p_user_id is not null and (
   app_private.conecta_network_access_allowed(p_user_id)
   or app_private.conecta_basic_feed_allowed(p_user_id)
   or exists (
     select 1 from public.platform_moderators pm
     where pm.user_id = p_user_id and pm.role = 'admin'
   )
 );
$function$;
revoke all on function app_private.conecta_social_access_allowed(uuid) from public, anon;
grant usage on schema app_private to authenticated, service_role;
grant execute on function app_private.conecta_social_access_allowed(uuid) to authenticated, service_role;
comment on function app_private.conecta_social_access_allowed(uuid) is
 'Trusted-identity users, server age-classified adults and platform admins can use ordinary social features. This does not attest identity and does not unlock private messaging.';

-- Existing per-table permissive policies still check ownership, moderation,
-- visibility, membership and author rights. Replace only the broad identity
-- gate, not those more specific restrictions.
do $policy$
declare table_name text;
 social_tables text[] := array[
  'communities', 'community_members', 'community_settings', 'community_staff',
  'post_comments', 'post_likes', 'post_media', 'post_polls',
  'post_poll_options', 'post_poll_votes', 'stories', 'saved_posts',
  'profile_details', 'profile_favorites', 'profile_guestbook',
  'profile_testimonials', 'profile_visits', 'user_achievements',
  'user_blocks', 'notifications', 'monetization_interests'
 ];
begin
 foreach table_name in array social_tables loop
  if to_regclass(format('public.%I',table_name)) is not null then
   execute format('drop policy if exists conecta_id_network_access_required on public.%I',table_name);
   execute format(
    'create policy conecta_id_social_access_required on public.%I as restrictive for all to authenticated using (app_private.conecta_social_access_allowed((select auth.uid()))) with check (app_private.conecta_social_access_allowed((select auth.uid())))',
    table_name
   );
  end if;
 end loop;
end
$policy$;

-- Reuse the established post privacy and moderation policies, including the
-- ability to read one's pending posts. Identity-pending adults may create and
-- interact with their own ordinary social content, not private messages.
drop policy if exists conecta_id_posts_basic_select on public.posts;
drop policy if exists conecta_id_posts_full_insert on public.posts;
drop policy if exists conecta_id_posts_full_update on public.posts;
drop policy if exists conecta_id_posts_full_delete on public.posts;
create policy conecta_id_posts_social_select on public.posts
 as restrictive for select to authenticated
 using (app_private.conecta_social_access_allowed((select auth.uid())));
create policy conecta_id_posts_social_insert on public.posts
 as restrictive for insert to authenticated
 with check (app_private.conecta_social_access_allowed((select auth.uid())));
create policy conecta_id_posts_social_update on public.posts
 as restrictive for update to authenticated
 using (app_private.conecta_social_access_allowed((select auth.uid())))
 with check (app_private.conecta_social_access_allowed((select auth.uid())));
create policy conecta_id_posts_social_delete on public.posts
 as restrictive for delete to authenticated
 using (app_private.conecta_social_access_allowed((select auth.uid())));

-- Let authenticated, eligible adult accounts discover other eligible adult
-- accounts, while not making unverified or minor profiles globally visible.
drop policy if exists conecta_id_verified_profile_discovery on public.profiles;
create policy conecta_id_verified_profile_discovery on public.profiles
 as restrictive for select to anon, authenticated
 using (
  (select auth.uid()) is not null
  and (
   id = (select auth.uid())
   or app_private.conecta_network_access_allowed((select auth.uid()))
   or app_private.conecta_network_access_allowed(id)
   or (
     app_private.conecta_social_access_allowed((select auth.uid()))
     and (
      app_private.conecta_social_access_allowed(id)
      or exists(
       select 1 from public.posts p
       where p.author_id=profiles.id
         and p.visibility='public'
         and p.moderation_status='approved'
         and p.community_id is null
      )
     )
   )
  )
 );
