-- Enforce an immutable group type: only validated creator RPC can mark a room as a group.
create or replace function app_private.initialize_conversation_type()
returns trigger language plpgsql set search_path='' as $$
begin
 new.is_group:=false;
 return new;
end;$$;
revoke all on function app_private.initialize_conversation_type() from public,anon,authenticated;
drop trigger if exists chat_conversation_force_direct_on_create on public.conversations;
create trigger chat_conversation_force_direct_on_create
before insert on public.conversations for each row
execute function app_private.initialize_conversation_type();
