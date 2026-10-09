-- Ensure new gallery assets invalidate a previous automatic review, even
-- if an upload races the server's review update transaction.
create or replace function app_private.requeue_post_on_new_gallery_media()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 update public.posts set
  moderation_status='pending',
  moderation_reason='Mídia nova na galeria aguardando triagem automática',
  moderated_at=null,
  moderated_by=null,
  ai_checked_at=null,
  ai_provider=null
 where id=new.post_id and author_id=new.owner_id;
 return new;
end;$$;
revoke all on function app_private.requeue_post_on_new_gallery_media() from public,anon,authenticated;
drop trigger if exists requeue_gallery_auto_review on public.post_media;
create trigger requeue_gallery_auto_review
after insert on public.post_media for each row
execute function app_private.requeue_post_on_new_gallery_media();
