-- Applied to Conecta Supabase on 2026-10-09.
-- Edits and soft deletes are restricted by RLS and immutable identity guards.
alter table public.messages add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;
alter table public.conversation_members add column if not exists last_read_at timestamptz;

create or replace function app_private.guard_message_revision()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.deleted_at is not null then
   raise exception 'Mensagem excluída não pode ser alterada.' using errcode='23514';
 end if;
 if new.id is distinct from old.id or new.sender_id is distinct from old.sender_id
  or new.conversation_id is distinct from old.conversation_id
  or new.created_at is distinct from old.created_at then
   raise exception 'Identidade da mensagem não pode ser alterada.' using errcode='23514';
 end if;
 if new.deleted_at is not null then
   new.deleted_at:=now();
   new.content:='Mensagem apagada';
   new.media_path:=null;
   new.media_type:=null;
   new.edited_at:=old.edited_at;
   return new;
 end if;
 if new.media_path is distinct from old.media_path
    or new.media_type is distinct from old.media_type then
   raise exception 'Anexos não podem ser substituídos na edição.' using errcode='23514';
 end if;
 if not exists(select 1 from public.registration_age_declarations a
      where a.user_id=old.sender_id and a.declared_band='18_plus')
    or exists(select 1 from public.teen_safety_preferences t
      where t.user_id=old.sender_id and t.mode='youth_protection') then
   raise exception 'Edição indisponível para conta com proteção etária pendente.' using errcode='42501';
 end if;
 if new.content is not distinct from old.content then
   raise exception 'A mensagem não foi alterada.' using errcode='22023';
 end if;
 if length(btrim(new.content)) < 1 or length(btrim(new.content)) > 4000 then
   raise exception 'A edição precisa conter entre 1 e 4000 caracteres.' using errcode='22023';
 end if;
 new.edited_at:=now();
 new.deleted_at:=null;
 return new;
end;
$$;
revoke all on function app_private.guard_message_revision() from public,anon,authenticated;
drop trigger if exists messages_guard_revision on public.messages;
create trigger messages_guard_revision before update on public.messages
 for each row execute function app_private.guard_message_revision();

create or replace function app_private.guard_member_read_receipt()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.user_id is distinct from old.user_id
   or new.conversation_id is distinct from old.conversation_id
   or new.joined_at is distinct from old.joined_at then
   raise exception 'Vínculo e data de entrada não podem ser modificados.' using errcode='23514';
 end if;
 new.last_read_at:=greatest(now(),coalesce(old.last_read_at,'-infinity'::timestamptz));
 return new;
end;
$$;
revoke all on function app_private.guard_member_read_receipt() from public,anon,authenticated;
drop trigger if exists conversation_member_read_receipt_guard on public.conversation_members;
create trigger conversation_member_read_receipt_guard before update on public.conversation_members
 for each row execute function app_private.guard_member_read_receipt();

drop policy if exists "author can revise own message" on public.messages;
create policy "author can revise own message" on public.messages for update to authenticated
using (sender_id=(select auth.uid()) and deleted_at is null
 and app_private.is_conversation_member(conversation_id))
with check (sender_id=(select auth.uid())
 and app_private.is_conversation_member(conversation_id));

drop policy if exists "member records own reading" on public.conversation_members;
create policy "member records own reading" on public.conversation_members for update to authenticated
using (user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

revoke update on public.messages from public,anon,authenticated;
revoke update on public.conversation_members from public,anon,authenticated;
grant update(content,deleted_at) on public.messages to authenticated;
grant update(last_read_at) on public.conversation_members to authenticated;
create index if not exists conversation_members_receipt_idx
 on public.conversation_members(conversation_id,last_read_at)
 where last_read_at is not null;
