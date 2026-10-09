-- Prevent bypassing ownership transfer through the legacy member DELETE policy.
create or replace function app_private.prevent_owner_leaving_group()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.conversations c where c.id=old.conversation_id
  and c.is_group and c.created_by=old.user_id) then
  raise exception 'Transfira a administração antes de sair do grupo.' using errcode='23514';
 end if;
 return old;
end;$$;
revoke all on function app_private.prevent_owner_leaving_group() from public,anon,authenticated;
drop trigger if exists guard_chat_group_owner_exit on public.conversation_members;
create trigger guard_chat_group_owner_exit before delete on public.conversation_members
for each row execute function app_private.prevent_owner_leaving_group();
