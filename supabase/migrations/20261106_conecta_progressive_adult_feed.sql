-- Adult age assurance may permit reading publicly approved posts while
-- identity-protected social mutations, messages, and private networks stay closed.
-- Children, adolescents, unknown ages, and mismatched declarations get no feed grant.
create or replace function app_private.conecta_basic_feed_allowed(p_user_id uuid)
returns boolean
language sql stable security definer
set search_path = pg_catalog, public, app_private
as $function$
 select p_user_id is not null and exists (
   select 1
   from public.age_assurance_decisions d
   join public.registration_age_declarations rd on rd.user_id=d.user_id
   join public.profiles pr on pr.id=d.user_id
   where d.user_id=p_user_id
     and rd.declared_band='18_plus'
     and d.age_band='18_plus'
     and d.method='conecta_document_age_only'
     and d.verified_at <= now()+interval '1 minute'
     and d.verified_at >= now()-interval '60 days'
     and d.evidence_reference_hash ~ '^[0-9a-f]{64}$'
 );
$function$;

revoke all on function app_private.conecta_basic_feed_allowed(uuid) from public, anon;
grant usage on schema app_private to authenticated, service_role;
grant execute on function app_private.conecta_basic_feed_allowed(uuid) to authenticated, service_role;
comment on function app_private.conecta_basic_feed_allowed(uuid) is
 'Age-assured adult-only public feed read; not an identity approval or permission for any social write.';

-- Split the old restrictive ALL gate on posts so SELECT can be read-only;
-- mutations retain the unchanged verified-identity network gate.
drop policy if exists conecta_id_network_access_required on public.posts;
create policy conecta_id_posts_basic_select on public.posts
 as restrictive for select to authenticated
 using (
   app_private.conecta_network_access_allowed((select auth.uid()))
   or (
     app_private.conecta_basic_feed_allowed((select auth.uid()))
     and visibility = 'public'
     and moderation_status = 'approved'
     and community_id is null
   )
 );
create policy conecta_id_posts_full_insert on public.posts
 as restrictive for insert to authenticated
 with check (app_private.conecta_network_access_allowed((select auth.uid())));
create policy conecta_id_posts_full_update on public.posts
 as restrictive for update to authenticated
 using (app_private.conecta_network_access_allowed((select auth.uid())))
 with check (app_private.conecta_network_access_allowed((select auth.uid())));
create policy conecta_id_posts_full_delete on public.posts
 as restrictive for delete to authenticated
 using (app_private.conecta_network_access_allowed((select auth.uid())));

-- Restrict identity-pending adults to public-post authors, not all accounts.
drop policy if exists conecta_id_verified_profile_discovery on public.profiles;
create policy conecta_id_verified_profile_discovery on public.profiles
 as restrictive for select to anon, authenticated
 using (
   auth.uid() is not null
   and (
     id=(select auth.uid())
     or app_private.conecta_network_access_allowed((select auth.uid()))
     or app_private.conecta_network_access_allowed(id)
     or (
       app_private.conecta_basic_feed_allowed((select auth.uid()))
       and exists(
         select 1 from public.posts p
         where p.author_id=profiles.id
           and p.visibility='public'
           and p.moderation_status='approved'
           and p.community_id is null
       )
     )
   )
 );
