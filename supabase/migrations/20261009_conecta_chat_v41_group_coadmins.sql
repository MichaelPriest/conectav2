-- Chat V4 — explicitly scoped co-administrators and owner-controlled group permissions.
-- No browser role may write the moderator table. All writes validate the current
-- authenticated owner on the server under a conversation row lock.
create table if not exists app_private.conversation_group_moderators (
  conversation_id uuid not null,
  user_id uuid not null,
  granted_by uuid not null references public.profiles(id),
  granted_at timestamptz not null default now(),
  primary key(conversation_id,user_id),
  foreign key(conversation_id,user_id)
    references public.conversation_members(conversation_id,user_id) on delete cascade
);
alter table app_private.conversation_group_moderators enable row level security;
revoke all on app_private.conversation_group_moderators from public,anon,authenticated;
alter table public.conversations
  add column if not exists coadmins_can_invite boolean not null default true,
  add column if not exists coadmins_can_remove boolean not null default false;
revoke update on public.conversations from anon,authenticated;

create or replace function public.get_conversation_group_permissions(_conversation uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me uuid:=(select auth.uid());result jsonb;
begin
 if me is null or not app_private.is_conversation_member(_conversation) then
   raise exception 'Conversa indisponível.' using errcode='42501';
 end if;
 select pg_catalog.jsonb_build_object(
   'coadmins',coalesce((select pg_catalog.jsonb_agg(m.user_id)
      from app_private.conversation_group_moderators m
      where m.conversation_id=c.id),'[]'::jsonb),
   'coadmins_can_invite',c.coadmins_can_invite,
   'coadmins_can_remove',c.coadmins_can_remove
 ) into result
 from public.conversations c
 where c.id=_conversation and c.is_group;
 return coalesce(result,'{"coadmins":[],"coadmins_can_invite":false,"coadmins_can_remove":false}'::jsonb);
end;$$;
revoke all on function public.get_conversation_group_permissions(uuid) from public,anon,authenticated;
grant execute on function public.get_conversation_group_permissions(uuid) to authenticated;

create or replace function public.set_conversation_group_moderator(
 _conversation uuid,_member uuid,_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid()); owner_id uuid;group_chat boolean;
begin
 if me is null or _conversation is null or _member is null or _enabled is null then
   raise exception 'Parâmetros inválidos.' using errcode='22023';end if;
 select c.created_by,c.is_group into owner_id,group_chat
   from public.conversations c where c.id=_conversation for update;
 if owner_id is distinct from me or not coalesce(group_chat,false)
   or not app_private.is_conversation_member(_conversation) then
   raise exception 'Somente o proprietário pode gerenciar coadministradores.'
     using errcode='42501';end if;
 if _member=me or not exists(select 1 from public.conversation_members m
   where m.conversation_id=_conversation and m.user_id=_member) then
   raise exception 'Selecione outro integrante atual do grupo.' using errcode='23514';end if;
 if _enabled then
   insert into app_private.conversation_group_moderators(conversation_id,user_id,granted_by)
   values (_conversation,_member,me)
   on conflict(conversation_id,user_id) do nothing;
 else
   delete from app_private.conversation_group_moderators
   where conversation_id=_conversation and user_id=_member;
 end if;
end;$$;
revoke all on function public.set_conversation_group_moderator(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.set_conversation_group_moderator(uuid,uuid,boolean) to authenticated;

create or replace function public.set_conversation_group_permissions(
 _conversation uuid,_can_invite boolean,_can_remove boolean)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid());owner_id uuid;group_chat boolean;
begin
 if me is null or _can_invite is null or _can_remove is null then
   raise exception 'Parâmetros inválidos.' using errcode='22023';end if;
 select c.created_by,c.is_group into owner_id,group_chat
 from public.conversations c where c.id=_conversation for update;
 if owner_id is distinct from me or not coalesce(group_chat,false)
    or not app_private.is_conversation_member(_conversation) then
    raise exception 'Somente o proprietário define permissões.' using errcode='42501';
 end if;
 update public.conversations set coadmins_can_invite=_can_invite,
   coadmins_can_remove=_can_remove where id=_conversation;
end;$$;
revoke all on function public.set_conversation_group_permissions(uuid,boolean,boolean) from public,anon,authenticated;
grant execute on function public.set_conversation_group_permissions(uuid,boolean,boolean) to authenticated;

-- The owner keeps exclusive control of ownership, title and promotion.
-- Coadministrators can invite only when the owner enables that privilege.
create or replace function public.add_conversation_group_member(_conversation uuid,_friend uuid)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid());owner_id uuid;group_chat boolean;members bigint;can_invite boolean;
begin
 if me is null or _friend is null or me=_friend or _conversation is null then
  raise exception 'Convite inválido.' using errcode='22023';end if;
 select c.created_by,c.is_group,c.coadmins_can_invite
   into owner_id,group_chat,can_invite from public.conversations c
   where c.id=_conversation for update;
 if not coalesce(group_chat,false) or not app_private.is_conversation_member(_conversation)
 or (owner_id is distinct from me and not (can_invite and exists(
   select 1 from app_private.conversation_group_moderators m
   where m.conversation_id=_conversation and m.user_id=me
 ))) then
  raise exception 'Sem permissão para convidar.' using errcode='42501';end if;
 select count(*) into members from public.conversation_members where conversation_id=_conversation;
 if members>=21 then raise exception 'Limite de 21 participantes.' using errcode='23514';end if;
 if exists(select 1 from public.conversation_members
 where conversation_id=_conversation and user_id=_friend) then
  raise exception 'Esta pessoa já participa do grupo.' using errcode='23505';end if;
 if not exists(select 1 from public.friendships f where f.status='accepted' and
  ((f.requester_id=me and f.addressee_id=_friend) or
  (f.requester_id=_friend and f.addressee_id=me))) then
  raise exception 'Convide somente conexões aceitas.' using errcode='42501';end if;
 if exists(select 1 from public.user_blocks b where
  (b.blocker_id=me and b.blocked_id=_friend) or
  (b.blocker_id=_friend and b.blocked_id=me)) then
  raise exception 'Convite impedido pelo bloqueio.' using errcode='42501';end if;
 if exists(select 1 from public.teen_safety_preferences p
  where p.user_id in(me,_friend) and p.mode='youth_protection') then
  raise exception 'Proteção etária impede o convite.' using errcode='42501';end if;
 insert into public.conversation_members(conversation_id,user_id) values(_conversation,_friend);
end;$$;
revoke all on function public.add_conversation_group_member(uuid,uuid) from public,anon,authenticated;
grant execute on function public.add_conversation_group_member(uuid,uuid) to authenticated;

create or replace function public.remove_conversation_group_member(_conversation uuid,_member uuid)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid());owner_id uuid;group_chat boolean;can_remove boolean;
begin
 if me is null or _member is null or _member=me or _conversation is null then
   raise exception 'Remoção inválida.' using errcode='22023';end if;
 select c.created_by,c.is_group,c.coadmins_can_remove
  into owner_id,group_chat,can_remove from public.conversations c
  where c.id=_conversation for update;
 if not coalesce(group_chat,false) or not app_private.is_conversation_member(_conversation)
   or (owner_id is distinct from me and not(can_remove and exists(
    select 1 from app_private.conversation_group_moderators m
    where m.conversation_id=_conversation and m.user_id=me))) then
   raise exception 'Sem permissão para remover integrantes.' using errcode='42501';end if;
 if _member=owner_id or
   (owner_id is distinct from me and exists(
     select 1 from app_private.conversation_group_moderators m
     where m.conversation_id=_conversation and m.user_id=_member)) then
   raise exception 'Coadministradores não podem remover o proprietário ou outros administradores.'
     using errcode='42501';end if;
 if not exists(select 1 from public.conversation_members cm
     where cm.conversation_id=_conversation and cm.user_id=_member) then
   raise exception 'A pessoa não participa deste grupo.' using errcode='23514';end if;
 delete from public.conversation_members where conversation_id=_conversation and user_id=_member;
 delete from public.conversation_typing where conversation_id=_conversation and user_id=_member;
end;$$;
revoke all on function public.remove_conversation_group_member(uuid,uuid) from public,anon,authenticated;
grant execute on function public.remove_conversation_group_member(uuid,uuid) to authenticated;

-- If the new owner used to be a coadministrator, remove the now redundant role.
create or replace function public.transfer_conversation_group_owner(_conversation uuid,_new_owner uuid)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid());owner_id uuid;group_chat boolean;
begin
 if me is null or _new_owner is null or _new_owner=me then
  raise exception 'Selecione outro participante.' using errcode='22023';end if;
 select c.created_by,c.is_group into owner_id,group_chat
  from public.conversations c where c.id=_conversation for update;
 if owner_id is distinct from me or not coalesce(group_chat,false)
 or not app_private.is_conversation_member(_conversation) then
  raise exception 'Só o proprietário pode transferir o grupo.' using errcode='42501';end if;
 if not exists(select 1 from public.conversation_members
  where conversation_id=_conversation and user_id=_new_owner) then
  raise exception 'O novo proprietário deve participar do grupo.' using errcode='23514';end if;
 update public.conversations set created_by=_new_owner where id=_conversation;
 delete from app_private.conversation_group_moderators
 where conversation_id=_conversation and user_id=_new_owner;
end;$$;
revoke all on function public.transfer_conversation_group_owner(uuid,uuid) from public,anon,authenticated;
grant execute on function public.transfer_conversation_group_owner(uuid,uuid) to authenticated;
