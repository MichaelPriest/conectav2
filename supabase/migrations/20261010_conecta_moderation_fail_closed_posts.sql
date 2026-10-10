-- Fail-closed moderation: no client can publish a new post before server checks.
-- Preserve real RLS, platform/community reviewer functions and gallery requeue.
alter table public.posts alter column moderation_status set default 'pending';

create or replace function app_private.guard_publication_screening()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.moderation_status := 'pending';
    new.moderation_reason := case when new.media_path is null
      then 'Aguardando triagem automática de texto'
      else 'Mídia aguardando análise de segurança' end;
    new.moderated_at := null;
    new.moderated_by := null;
    new.ai_checked_at := null;
    new.ai_provider := null;
  elsif new.content is distinct from old.content
    or new.media_path is distinct from old.media_path then
    new.moderation_status := 'pending';
    new.moderation_reason := 'Conteúdo alterado; nova revisão necessária';
    new.moderated_at := null;
    new.moderated_by := null;
    new.ai_checked_at := null;
    new.ai_provider := null;
  end if;
  return new;
end;
$$;

-- Authors can edit their post, but must never forge an automatic or human
-- review decision via the Data API's column-level update payload.
create or replace function app_private.protect_post_moderation_fields()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(auth.jwt()->>'role','') <> 'authenticated'
    or app_private.is_platform_moderator()
    or (coalesce(new.community_id,old.community_id) is not null
      and app_private.can_moderate_community(coalesce(new.community_id,old.community_id))) then
    return new;
  end if;

  if new.content is distinct from old.content
    or new.media_path is distinct from old.media_path then
    new.moderation_status := 'pending';
    new.moderation_reason := 'Conteúdo alterado; nova revisão necessária';
    new.moderated_at := null;
    new.moderated_by := null;
    new.ai_checked_at := null;
    new.ai_provider := null;
  elsif new.moderation_status = 'pending'
    and (old.moderation_status <> 'pending'
      or new.ai_checked_at is distinct from old.ai_checked_at) then
    -- The gallery-append trigger uses this requeue path too.
    new.moderation_status := 'pending';
    new.moderation_reason := 'Nova triagem solicitada';
    new.moderated_at := null;
    new.moderated_by := null;
    new.ai_checked_at := null;
    new.ai_provider := null;
  else
    new.moderation_status := old.moderation_status;
    new.moderation_reason := old.moderation_reason;
    new.moderated_at := old.moderated_at;
    new.moderated_by := old.moderated_by;
    new.ai_checked_at := old.ai_checked_at;
    new.ai_provider := old.ai_provider;
  end if;
  return new;
end;
$$;

drop trigger if exists zzz_protect_post_moderation_fields on public.posts;
create trigger zzz_protect_post_moderation_fields
before update on public.posts
for each row execute function app_private.protect_post_moderation_fields();

revoke all on function app_private.protect_post_moderation_fields() from public, anon, authenticated;
revoke all on function app_private.guard_publication_screening() from public, anon, authenticated;
