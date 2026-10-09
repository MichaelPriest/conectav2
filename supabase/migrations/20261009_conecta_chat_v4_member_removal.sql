-- Chat V4: group owner may remove another member, but never delegate through direct RLS bypass.
-- Serialized with owner transfers/exits by locking the conversation row.
create or replace function public.remove_conversation_group_member(_conversation uuid,_member uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  me uuid := (select auth.uid());
  owner_id uuid;
  group_chat boolean;
begin
  if me is null or _member is null or _member=me or _conversation is null then
    raise exception 'Remoção inválida.' using errcode='22023';
  end if;
  select c.created_by,c.is_group into owner_id,group_chat
    from public.conversations c where c.id=_conversation for update;
  if owner_id is distinct from me or not coalesce(group_chat,false)
     or not app_private.is_conversation_member(_conversation) then
    raise exception 'Somente o administrador do grupo pode remover integrantes.'
      using errcode='42501';
  end if;
  if not exists(
    select 1 from public.conversation_members cm
    where cm.conversation_id=_conversation and cm.user_id=_member
  ) then
    raise exception 'A pessoa não participa deste grupo.' using errcode='23514';
  end if;
  delete from public.conversation_members
    where conversation_id=_conversation and user_id=_member;
  delete from public.conversation_typing
    where conversation_id=_conversation and user_id=_member;
end;
$$;
revoke all on function public.remove_conversation_group_member(uuid,uuid) from public,anon,authenticated;
grant execute on function public.remove_conversation_group_member(uuid,uuid) to authenticated;
