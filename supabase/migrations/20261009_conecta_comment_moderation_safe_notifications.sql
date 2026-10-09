
-- Comment moderation with database-enforced quarantine. No model provider required.
alter table public.post_comments
  add column if not exists moderation_status text not null default 'approved',
  add column if not exists moderation_reason text not null default '',
  add column if not exists checked_at timestamptz,
  add column if not exists ai_provider text;
alter table public.post_comments
  add constraint post_comments_moderation_status_check
  check(moderation_status in ('pending','approved','rejected'));
alter table public.post_comments alter column moderation_status set default 'pending';

create or replace function app_private.guard_new_comment_moderation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 new.moderation_status:='pending';
 new.moderation_reason:='Aguardando análise de segurança';
 new.checked_at:=null;new.ai_provider:=null;
 return new;
end;
$$;
revoke all on function app_private.guard_new_comment_moderation() from public,anon,authenticated;
drop trigger if exists z_comment_moderation_insert on public.post_comments;
create trigger z_comment_moderation_insert before insert on public.post_comments
for each row execute function app_private.guard_new_comment_moderation();

drop policy if exists "comments readable for visible posts" on public.post_comments;
create policy "comments readable for visible posts"
on public.post_comments for select to authenticated using(
  exists(select 1 from public.posts p where p.id=post_comments.post_id
    and (post_comments.moderation_status='approved'
      or post_comments.author_id=(select auth.uid())
      or app_private.is_platform_moderator()
      or (p.community_id is not null and app_private.can_moderate_community(p.community_id))))
);
-- Never let the client set moderation status after insert.
revoke update on public.post_comments from public,anon,authenticated;

-- Existing notifications must NOT leak comments while their safety review is pending.
CREATE OR REPLACE FUNCTION app_private.notify_post_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare recipient uuid;
begin
  if new.moderation_status<>'approved' then return new; end if;
  select p.author_id into recipient from public.posts p where p.id = new.post_id;
  if recipient is not null and recipient <> new.author_id then
    insert into public.notifications(recipient_id,actor_id,kind,entity_id)
    values(recipient,new.author_id,'comment',new.post_id);
  end if;
  return new;
end
$function$
;

CREATE OR REPLACE FUNCTION app_private.notify_social_mentions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  text_body text; origin_post public.posts%rowtype; author uuid; mention_handle text;
  target uuid; max_mentions int := 0; prior_text text := '';
begin
  if TG_TABLE_NAME='post_comments' and new.moderation_status<>'approved' then return new; end if;
  if TG_TABLE_NAME='posts' then
    author:=new.author_id; text_body:=new.content;
    select * into origin_post from public.posts where id=new.id;
    if TG_OP='UPDATE' then prior_text:=old.content; end if;
  elsif TG_TABLE_NAME='post_comments' then
    author:=new.author_id; text_body:=new.body;
    select * into origin_post from public.posts where id=new.post_id;
  else return new; end if;
  if origin_post.id is null or (origin_post.community_id is not null and origin_post.moderation_status<>'approved')
    or origin_post.visibility='private' then return new; end if;
  for mention_handle in
    select distinct lower((m)[2]) from regexp_matches(coalesce(text_body,''),'(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{3,30})','g') m
    limit 8
  loop
    if TG_OP='UPDATE' and prior_text ~* ('(^|[^a-zA-Z0-9_])@'||mention_handle||'([^a-zA-Z0-9_]|$)') then
      continue;
    end if;
    select p.id into target from public.profiles p where p.handle=mention_handle;
    if target is null or target=author then continue; end if;
    if exists(select 1 from public.user_blocks b where
      (b.blocker_id=target and b.blocked_id=author) or
      (b.blocker_id=author and b.blocked_id=target)) then continue; end if;
    if origin_post.visibility='friends' and not exists(
      select 1 from public.friendships f where f.status='accepted' and
       ((f.requester_id=target and f.addressee_id=origin_post.author_id)
         or (f.addressee_id=target and f.requester_id=origin_post.author_id))
    ) then continue; end if;
    if origin_post.community_id is not null and not exists(
      select 1 from public.community_members cm where cm.community_id=origin_post.community_id and cm.user_id=target
    ) then continue; end if;
    -- Conservative protective gate; age self-declaration never counts as proof of adulthood.
    if not exists(select 1 from public.registration_age_declarations a where a.user_id=target and a.declared_band='18_plus')
      or exists(select 1 from public.teen_safety_preferences s where s.user_id=target and s.mode='youth_protection')
    then continue; end if;
    insert into public.notifications(recipient_id,actor_id,kind,entity_id)
    values(target,author,'mention',origin_post.id);
  end loop;
  return new;
end;
$function$
;
drop trigger if exists comment_notification_on_approval on public.post_comments;
create trigger comment_notification_on_approval after update of moderation_status on public.post_comments
for each row when (old.moderation_status<>'approved' and new.moderation_status='approved')
execute function app_private.notify_post_comment();
drop trigger if exists comment_mentions_on_approval on public.post_comments;
create trigger comment_mentions_on_approval after update of moderation_status on public.post_comments
for each row when (old.moderation_status<>'approved' and new.moderation_status='approved')
execute function app_private.notify_social_mentions();

create table if not exists public.comment_moderation_events(
 id uuid primary key default gen_random_uuid(),
 comment_id uuid not null references public.post_comments(id) on delete cascade,
 reviewer_id uuid references public.profiles(id) on delete set null,
 decision text not null check(decision in ('approve','reject')),
 reason text not null check(char_length(btrim(reason)) between 10 and 500),
 created_at timestamptz not null default now()
);
alter table public.comment_moderation_events enable row level security;
revoke all on public.comment_moderation_events from public,anon,authenticated;
grant select,insert,update,delete on public.comment_moderation_events to service_role;
create index if not exists comment_moderation_events_comment_idx
 on public.comment_moderation_events(comment_id,created_at desc);
create index if not exists post_comments_pending_idx
 on public.post_comments(created_at) where moderation_status='pending';

create or replace function public.get_pending_comments(_limit integer default 50)
returns table(
 comment_id uuid,post_id uuid,community_id uuid,author_handle text,
 body text,created_at timestamptz
) language plpgsql stable security definer set search_path='' as $$
begin
 if not app_private.is_platform_moderator() and not exists(
   select 1 from public.community_staff cs where cs.user_id=(select auth.uid())
 ) and not exists(
   select 1 from public.communities c where c.owner_id=(select auth.uid())
 ) then
   raise exception 'Acesso restrito à moderação' using errcode='42501';
 end if;
 return query
 select cm.id,cm.post_id,p.community_id,pr.handle,cm.body,cm.created_at
 from public.post_comments cm
 join public.posts p on p.id=cm.post_id
 left join public.profiles pr on pr.id=cm.author_id
 where cm.moderation_status='pending'
   and (app_private.is_platform_moderator()
        or (p.community_id is not null and app_private.can_moderate_community(p.community_id)))
 order by cm.created_at asc
 limit least(greatest(coalesce(_limit,50),1),100);
end;$$;
revoke all on function public.get_pending_comments(integer) from public,anon,authenticated;
grant execute on function public.get_pending_comments(integer) to authenticated;

create or replace function public.review_pending_comment(
 _comment_id uuid,_decision text,_reason text
) returns void language plpgsql security definer set search_path='' as $$
declare c_id uuid;status text;community uuid;why text;
begin
 if (select auth.uid()) is null then
   raise exception 'Faça login para continuar' using errcode='42501';
 end if;
 why:=btrim(coalesce(_reason,''));
 if _decision not in ('approve','reject') or char_length(why) not between 10 and 500 then
    raise exception 'Decisão e justificativa (10 a 500 caracteres) são obrigatórias' using errcode='22023';
 end if;
 select cm.id,cm.moderation_status,p.community_id into c_id,status,community
 from public.post_comments cm join public.posts p on p.id=cm.post_id
 where cm.id=_comment_id for update of cm;
 if c_id is null then raise exception 'Comentário indisponível' using errcode='22023'; end if;
 if not app_private.is_platform_moderator()
   and not (community is not null and app_private.can_moderate_community(community)) then
    raise exception 'Acesso restrito à moderação' using errcode='42501';
 end if;
 if status<>'pending' then raise exception 'Este comentário já foi analisado' using errcode='23514'; end if;
 update public.post_comments
  set moderation_status=case when _decision='approve' then 'approved' else 'rejected' end,
      moderation_reason=why
  where id=_comment_id;
 insert into public.comment_moderation_events(comment_id,reviewer_id,decision,reason)
 values(_comment_id,(select auth.uid()),_decision,why);
end;$$;
revoke all on function public.review_pending_comment(uuid,text,text) from public,anon,authenticated;
grant execute on function public.review_pending_comment(uuid,text,text) to authenticated;
