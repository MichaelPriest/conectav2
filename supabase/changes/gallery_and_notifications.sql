-- Applied through Supabase migrations to project "conecta Project".
-- Original migration: gallery_and_notifications (2026-10-08).
-- For a new empty project: apply initial schema.sql first, then this script.
-- Do not apply twice to the same Supabase project.
create table public.post_media (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.posts(id) on delete cascade,
 owner_id uuid not null references public.profiles(id) on delete cascade,
 storage_path text not null unique,
 media_type text not null check (media_type in ('image','video')),
 position smallint not null check (position between 0 and 4),
 created_at timestamptz not null default now(),
 unique (post_id, position),
 constraint owner_folder check (storage_path like owner_id::text || '/%')
);
create index post_media_post_position on public.post_media(post_id, position);
alter table public.post_media enable row level security;
grant select, insert, delete on public.post_media to authenticated;
create policy "gallery visible with parent post" on public.post_media
 for select to authenticated using (
   exists (select 1 from public.posts p where p.id = post_media.post_id)
 );
create policy "author creates own gallery" on public.post_media
 for insert to authenticated with check (
   owner_id = (select auth.uid())
   and exists (select 1 from public.posts p where p.id = post_media.post_id and p.author_id = (select auth.uid()))
 );
create policy "author removes own gallery item" on public.post_media
 for delete to authenticated using (owner_id = (select auth.uid()));
drop policy "media read by owner or visible post" on storage.objects;
create policy "media read by owner or visible post" on storage.objects
 for select to authenticated using (
   bucket_id = 'social-media'
   and (
     (storage.foldername(name))[1] = (select auth.uid())::text
     or exists (select 1 from public.posts p where p.media_path = name)
     or exists (select 1 from public.post_media m where m.storage_path = name)
   )
 );
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create function app_private.notify_post_like() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare recipient uuid;
begin
  select p.author_id into recipient from public.posts p where p.id = new.post_id;
  if recipient is not null and recipient <> new.user_id then
    insert into public.notifications(recipient_id,actor_id,kind,entity_id)
    values(recipient,new.user_id,'like',new.post_id);
  end if;
  return new;
end
$$;

create function app_private.notify_post_comment() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare recipient uuid;
begin
  select p.author_id into recipient from public.posts p where p.id = new.post_id;
  if recipient is not null and recipient <> new.author_id then
    insert into public.notifications(recipient_id,actor_id,kind,entity_id)
    values(recipient,new.author_id,'comment',new.post_id);
  end if;
  return new;
end
$$;

create function app_private.notify_friendship() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notifications(recipient_id,actor_id,kind,entity_id)
    values(new.addressee_id,new.requester_id,'friend_request',new.id);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    insert into public.notifications(recipient_id,actor_id,kind,entity_id)
    values(new.requester_id,new.addressee_id,'friend_accept',new.id);
  end if;
  return new;
end
$$;
revoke all on function app_private.notify_post_like() from public, anon, authenticated;
revoke all on function app_private.notify_post_comment() from public, anon, authenticated;
revoke all on function app_private.notify_friendship() from public, anon, authenticated;
create trigger post_like_notification after insert on public.post_likes
 for each row execute function app_private.notify_post_like();
create trigger post_comment_notification after insert on public.post_comments
 for each row execute function app_private.notify_post_comment();
create trigger friendship_notification after insert or update of status on public.friendships
 for each row execute function app_private.notify_friendship();
