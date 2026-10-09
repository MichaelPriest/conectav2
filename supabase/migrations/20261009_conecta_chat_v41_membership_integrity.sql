-- Protect group integrity even when the authenticated owner uses direct table INSERT.
-- The creation RPC inserts 3+ members *before* marking is_group=true in the
-- same transaction, so enforcement must be checked at COMMIT, not on each row.
create or replace function app_private.lock_conversation_for_member_insert()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.conversations c
  where c.id=new.conversation_id for update;
  if not found then
    raise exception 'Conversa inválida.' using errcode='23503';
  end if;
  return new;
end;
$$;
revoke all on function app_private.lock_conversation_for_member_insert() from public,anon,authenticated;
drop trigger if exists guard_conversation_member_insert_lock on public.conversation_members;
create trigger guard_conversation_member_insert_lock
 before insert on public.conversation_members
 for each row execute function app_private.lock_conversation_for_member_insert();

create or replace function app_private.check_chat_membership_integrity()
returns trigger language plpgsql security definer set search_path='' as $$
declare group_chat boolean; member_count integer;
begin
 select c.is_group into group_chat from public.conversations c
 where c.id=new.conversation_id;
 if not found then return null;end if;
 select count(*) into member_count from public.conversation_members cm
 where cm.conversation_id=new.conversation_id;
 if member_count>21 then
   raise exception 'Limite de 21 participantes por conversa.' using errcode='23514';
 end if;
 if not group_chat and member_count>2 then
   raise exception 'Uma conversa individual não pode incluir mais de duas pessoas.'
   using errcode='23514';
 end if;
 if group_chat and exists(
  select 1 from public.conversation_members cm
  join public.teen_safety_preferences p on p.user_id=cm.user_id
  where cm.conversation_id=new.conversation_id and p.mode='youth_protection'
 ) then
   raise exception 'Proteção etária impede a participação neste grupo.'
   using errcode='42501';
 end if;
 return null;
end;
$$;
revoke all on function app_private.check_chat_membership_integrity() from public,anon,authenticated;
drop trigger if exists enforce_chat_membership_integrity on public.conversation_members;
create constraint trigger enforce_chat_membership_integrity
 after insert or update on public.conversation_members
 deferrable initially deferred
 for each row execute function app_private.check_chat_membership_integrity();
