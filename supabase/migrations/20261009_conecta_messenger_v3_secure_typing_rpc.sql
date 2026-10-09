-- Never require the client to upsert protected identity columns to broadcast typing.
-- Presence is best-effort, short-lived, and visible only to chat participants.
revoke insert,update,delete on public.conversation_typing from authenticated;
create or replace function public.set_chat_typing(_conversation uuid,_typing boolean)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid());
begin
 if me is null or _conversation is null or
 not app_private.is_conversation_member(_conversation) then
  raise exception 'Conversa não autorizada.' using errcode='42501';
 end if;
 if coalesce(_typing,false) then
  if exists(select 1 from public.conversation_members cm
     join public.teen_safety_preferences tsp on tsp.user_id=cm.user_id
     where cm.conversation_id=_conversation and tsp.mode='youth_protection') then
    raise exception 'Digitação indisponível em conversa sob proteção etária.' using errcode='42501';
  end if;
  insert into public.conversation_typing(conversation_id,user_id)
   values(_conversation,me)
   on conflict(conversation_id,user_id) do update
   set updated_at=now(),expires_at=now()+interval '7 seconds';
 else
  delete from public.conversation_typing
   where conversation_id=_conversation and user_id=me;
 end if;
end;$$;
revoke all on function public.set_chat_typing(uuid,boolean) from public,anon,authenticated;
grant execute on function public.set_chat_typing(uuid,boolean) to authenticated;
