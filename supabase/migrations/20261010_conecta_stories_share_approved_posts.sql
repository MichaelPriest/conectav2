-- Conecta Stories: native share of an already-approved PUBLIC feed post.
-- Uses the original post as the content source, not a second media upload.
alter table public.stories add column if not exists shared_post_id uuid
  references public.posts(id) on delete cascade;
alter table public.stories alter column media_path drop not null;
alter table public.stories alter column media_type drop not null;
alter table public.stories drop constraint if exists stories_owner_path;
alter table public.stories add constraint stories_owner_path check (
  (shared_post_id is null and media_path is not null and media_type in ('image','video')
    and media_path like author_id::text||'/stories/%' and char_length(media_path)<=250)
  or
  (shared_post_id is not null and media_path is null and media_type is null
    and caption='')
);
create index if not exists stories_shared_post_idx
  on public.stories(shared_post_id) where shared_post_id is not null;

-- Server sets the review outcome, regardless of any client-supplied status.
create or replace function app_private.guard_story_post_share()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.shared_post_id is not null then
  if new.media_path is not null or new.media_type is not null or btrim(new.caption)<>'' then
   raise exception 'Um Story de publicação não aceita mídia ou legenda adicional'
     using errcode='22023';
  end if;
  if not exists (
    select 1 from public.posts p where p.id=new.shared_post_id
      and p.visibility='public' and p.community_id is null
      and p.moderation_status='approved'
  ) then
   raise exception 'Compartilhe somente publicações públicas e aprovadas'
     using errcode='22023';
  end if;
  new.caption:='';
  new.moderation_status:='approved';
 else
  new.moderation_status:='pending';
 end if;
 return new;
end;
$$;
drop trigger if exists zz_guard_story_post_share on public.stories;
create trigger zz_guard_story_post_share
before insert on public.stories
for each row execute function app_private.guard_story_post_share();
revoke all on function app_private.guard_story_post_share() from public,anon,authenticated;

-- Existing SELECT RLS remains enforced; a story share never grants access
-- to the original post (which is still subject to posts RLS).
