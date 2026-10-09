-- Chat anti-flood without inspecting DMs with third-party AI.
-- Serializes inserts per sender/conversation, blocks bursts and repeated copies.
create or replace function app_private.guard_chat_message_flood()
returns trigger language plpgsql security definer set search_path='' as $$
declare recent_count integer;duplicate_count integer;me uuid:=(select auth.uid());
begin
 if me is not null and new.sender_id<>me then
  raise exception 'O remetente deve ser sua própria conta.' using errcode='42501';
 end if;
 perform pg_advisory_xact_lock(
  hashtextextended(new.conversation_id::text||'/'||new.sender_id::text,771));
 select count(*) into recent_count from public.messages m
 where m.conversation_id=new.conversation_id and m.sender_id=new.sender_id
 and m.created_at>now()-interval '60 seconds' and m.deleted_at is null;
 if recent_count>=18 then
  raise exception 'Muitas mensagens em pouco tempo. Tente novamente em instantes.'
  using errcode='23514';
 end if;
 if length(btrim(new.content))>0 then
  select count(*) into duplicate_count from public.messages m
  where m.conversation_id=new.conversation_id and m.sender_id=new.sender_id
  and m.content=new.content and m.created_at>now()-interval '30 seconds'
  and m.deleted_at is null;
  if duplicate_count>=2 then
   raise exception 'Mensagem repetida diversas vezes. Evite envios duplicados.'
   using errcode='23514';
  end if;
 end if;
 return new;
end;$$;
revoke all on function app_private.guard_chat_message_flood() from public,anon,authenticated;
drop trigger if exists chat_messages_guard_flood on public.messages;
create trigger chat_messages_guard_flood before insert on public.messages
for each row execute function app_private.guard_chat_message_flood();
