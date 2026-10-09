-- Source: applied Supabase migration 20261009030435.
-- Start strict media quarantine without requiring a paid AI service.
-- Existing published posts/stories remain as-is; only new media or risky text is held.
alter table public.posts
 add column if not exists ai_checked_at timestamptz,
 add column if not exists ai_provider text;
alter table public.stories
 add column if not exists moderation_status text not null default 'approved';
alter table public.stories
 add constraint stories_moderation_state check (moderation_status in ('approved','pending','rejected'));
alter table public.stories alter column moderation_status set default 'pending';

create or replace function app_private.guard_publication_screening()
returns trigger language plpgsql security definer set search_path=''
as $$
declare risky boolean;
begin
 risky := coalesce(new.content,'') ~* '(pix[[:space:]]+urgente|renda[[:space:]]+garantida|conte[uú]do[[:space:]]+ilegal|ameac[ao]|amea[çc]o[[:space:]]+voc[eê])';
 if tg_op='INSERT' then
  if new.media_path is not null or risky then
   new.moderation_status:='pending';
   new.moderation_reason:=case when new.media_path is not null
    then 'Mídia aguardando análise de segurança'
    else 'Texto encaminhado à revisão de segurança' end;
   new.moderated_at:=null;new.moderated_by:=null;
  end if;
  new.ai_checked_at:=null;new.ai_provider:=null;
 elsif new.content is distinct from old.content or new.media_path is distinct from old.media_path then
  new.ai_checked_at:=null;new.ai_provider:=null;
  if new.media_path is not null or risky then
   new.moderation_status:='pending';
   new.moderation_reason:='Conteúdo alterado; nova revisão necessária';
   new.moderated_by:=null;new.moderated_at:=null;
  end if;
 end if;
 return new;
end;
$$;
revoke all on function app_private.guard_publication_screening() from public,anon,authenticated;
drop trigger if exists zz_screen_publication on public.posts;
create trigger zz_screen_publication before insert or update of content,media_path on public.posts
for each row execute function app_private.guard_publication_screening();

-- The previous privacy conditions are preserved, but unapproved feed posts
-- are now also hidden from other ordinary users.
drop policy if exists "read posts by privacy" on public.posts;
create policy "read posts by privacy" on public.posts for select to authenticated
using (
 (author_id=(select auth.uid())
  or (moderation_status='approved' and
   (visibility='public'
    or (visibility='friends' and exists(
       select 1 from public.friendships f where f.status='accepted'
        and ((f.requester_id=posts.author_id and f.addressee_id=(select auth.uid()))
         or (f.addressee_id=posts.author_id and f.requester_id=(select auth.uid())))))))
  or (community_id is not null and app_private.can_moderate_community(community_id))
  or app_private.is_platform_moderator())
 and
 (community_id is null or moderation_status='approved'
    or author_id=(select auth.uid())
    or app_private.can_moderate_community(community_id)
    or app_private.is_platform_moderator())
);

drop policy if exists "view permitted active stories" on public.stories;
create policy "view permitted active stories" on public.stories for select to authenticated using (
 expires_at > now()
 and exists(select 1 from public.registration_age_declarations a
   where a.user_id=(select auth.uid()) and a.declared_band='18_plus')
 and not exists(select 1 from public.teen_safety_preferences y
   where y.user_id=(select auth.uid()) and y.mode='youth_protection')
 and (
  author_id=(select auth.uid())
  or (moderation_status='approved'
    and not exists(select 1 from public.user_blocks b
      where (b.blocker_id=stories.author_id and b.blocked_id=(select auth.uid()))
       or (b.blocker_id=(select auth.uid()) and b.blocked_id=stories.author_id))
    and (visibility='public' or
      (visibility='friends' and exists(select 1 from public.friendships f
        where f.status='accepted' and
         ((f.requester_id=stories.author_id and f.addressee_id=(select auth.uid()))
          or (f.addressee_id=stories.author_id and f.requester_id=(select auth.uid())))))))
 )
);
-- Author cannot bypass the pending queue through direct UPDATE grants.
revoke update on public.posts from public,anon,authenticated;
grant update(content,visibility,media_path,media_type) on public.posts to authenticated;
revoke update on public.stories from public,anon,authenticated;

-- Trusted human decision on a pending feed post.
create table if not exists public.feed_moderation_events(
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.posts(id) on delete cascade,
 reviewer_id uuid references public.profiles(id) on delete set null,
 decision text not null check(decision in ('approve','reject')),
 reason text not null check(length(btrim(reason)) between 10 and 500),
 created_at timestamptz not null default now()
);
alter table public.feed_moderation_events enable row level security;
revoke all on public.feed_moderation_events from public,anon,authenticated;
grant select,insert on public.feed_moderation_events to service_role;
create or replace function public.review_pending_feed_post(_post_id uuid,_decision text,_reason text)
returns void language plpgsql security definer set search_path=''
as $$
declare current_status text;
begin
 if not app_private.is_platform_moderator() then
  raise exception 'Acesso restrito à equipe geral.' using errcode='42501';
 end if;
 if _decision not in ('approve','reject') or length(btrim(coalesce(_reason,''))) not between 10 and 500 then
  raise exception 'Decisão e justificativa de 10 a 500 caracteres obrigatórias.' using errcode='22023';
 end if;
 select moderation_status into current_status from public.posts
  where id=_post_id and community_id is null for update;
 if current_status is null then raise exception 'Publicação de feed não encontrada.' using errcode='22023'; end if;
 if current_status<>'pending' then raise exception 'Somente publicações pendentes podem ser revisadas.' using errcode='23514'; end if;
 update public.posts set
  moderation_status=case when _decision='approve' then 'approved' else 'rejected' end,
  moderation_reason=left(btrim(_reason),500),
  moderated_by=(select auth.uid()),moderated_at=now()
 where id=_post_id;
 insert into public.feed_moderation_events(post_id,reviewer_id,decision,reason)
 values(_post_id,(select auth.uid()),_decision,btrim(_reason));
end; $$;
revoke all on function public.review_pending_feed_post(uuid,text,text) from public,anon,authenticated;
grant execute on function public.review_pending_feed_post(uuid,text,text) to authenticated;

