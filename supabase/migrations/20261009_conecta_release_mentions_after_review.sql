-- A pending post should notify mentions ONLY after human or provider approval.
-- When a post changes content and approval in the same UPDATE, send one notification.
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
    if TG_OP='UPDATE' and old.moderation_status='approved' then prior_text:=old.content; end if;
  elsif TG_TABLE_NAME='post_comments' then
    author:=new.author_id; text_body:=new.body;
    select * into origin_post from public.posts where id=new.post_id;
  else return new; end if;
  if origin_post.id is null or origin_post.moderation_status<>'approved'
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
drop trigger if exists social_mentions_post_update on public.posts;
create trigger social_mentions_post_update after update of content on public.posts
for each row when (
 old.content is distinct from new.content
 and old.moderation_status='approved' and new.moderation_status='approved'
)
execute function app_private.notify_social_mentions();
drop trigger if exists social_mentions_post_approved on public.posts;
create trigger social_mentions_post_approved after update of moderation_status on public.posts
for each row when (old.moderation_status<>'approved' and new.moderation_status='approved')
execute function app_private.notify_social_mentions();
