-- Conecta chat upgrade: contextual replies, private emoji reactions, unread counters.
-- Keep private messages private: never feed entire DM content into third-party AI.
alter table public.messages
 add column if not exists reply_to uuid references public.messages(id) on delete set null;

create index if not exists messages_conversation_recent_idx
 on public.messages(conversation_id,created_at desc,id desc);
create index if not exists messages_reply_to_idx
 on public.messages(reply_to) where reply_to is not null;

create or replace function app_private.validate_message_reply()
returns trigger language plpgsql security definer set search_path='' as $$
declare parent_conversation uuid;parent_deleted timestamptz;
begin
 if new.reply_to is null then return new;end if;
 if TG_OP='UPDATE' and new.reply_to is distinct from old.reply_to then
   raise exception 'A referência de resposta não pode ser modificada.' using errcode='23514';
 end if;
 select m.conversation_id,m.deleted_at into parent_conversation,parent_deleted
 from public.messages m where m.id=new.reply_to;
 if parent_conversation is distinct from new.conversation_id or parent_deleted is not null then
   raise exception 'Responda somente a uma mensagem existente desta conversa.' using errcode='23514';
 end if;
 return new;
end;$$;
revoke all on function app_private.validate_message_reply() from public,anon,authenticated;
drop trigger if exists messages_validate_reply_insert on public.messages;
create trigger messages_validate_reply_insert before insert on public.messages
 for each row execute function app_private.validate_message_reply();
drop trigger if exists messages_validate_reply_update on public.messages;
create trigger messages_validate_reply_update before update of reply_to on public.messages
 for each row execute function app_private.validate_message_reply();

-- Messages have an existing update guard; additionally freeze reply references.
create or replace function app_private.freeze_message_reply_update()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.reply_to is distinct from old.reply_to then
  raise exception 'A mensagem original respondida não pode ser alterada.' using errcode='23514';
 end if;
 return new;
end;$$;
drop trigger if exists messages_freeze_reply_update on public.messages;
create trigger messages_freeze_reply_update before update on public.messages
 for each row execute function app_private.freeze_message_reply_update();
revoke all on function app_private.freeze_message_reply_update() from public,anon,authenticated;

create table if not exists public.message_reactions(
 message_id uuid not null references public.messages(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 emoji text not null check(emoji in ('❤️','👍','😂','😮','😢','👏')),
 created_at timestamptz not null default now(),
 primary key(message_id,user_id,emoji)
);
create index if not exists message_reactions_message_idx
 on public.message_reactions(message_id);
alter table public.message_reactions enable row level security;
revoke all on public.message_reactions from public,anon,authenticated;
grant select,insert,delete on public.message_reactions to authenticated;
grant all on public.message_reactions to service_role;
drop policy if exists "members view message reactions" on public.message_reactions;
create policy "members view message reactions" on public.message_reactions for select to authenticated
 using(exists(
  select 1 from public.messages m where m.id=message_id
  and m.deleted_at is null and app_private.is_conversation_member(m.conversation_id)
 ));
drop policy if exists "members react to messages" on public.message_reactions;
create policy "members react to messages" on public.message_reactions for insert to authenticated
 with check(user_id=(select auth.uid()) and exists(
  select 1 from public.messages m where m.id=message_id and m.deleted_at is null
   and app_private.is_conversation_member(m.conversation_id)
   and not exists(
     select 1 from public.conversation_members cm
     join public.teen_safety_preferences tsp on tsp.user_id=cm.user_id
     where cm.conversation_id=m.conversation_id and tsp.mode='youth_protection'
   )
 ));
drop policy if exists "users remove own reactions" on public.message_reactions;
create policy "users remove own reactions" on public.message_reactions for delete to authenticated
 using(user_id=(select auth.uid()) and exists(
  select 1 from public.messages m where m.id=message_id
   and app_private.is_conversation_member(m.conversation_id)
 ));

-- Client must not be able to forge a read receipt for any other member.
revoke update on public.conversation_members from anon,authenticated;
grant update(last_read_at) on public.conversation_members to authenticated;
-- Keep existing RLS UPDATE, column grant prevents identity fields changing.

create or replace function public.my_conversation_unread_counts()
returns table(conversation_id uuid,unread_count bigint)
language sql stable security definer set search_path='' as $$
select cm.conversation_id,count(m.id)::bigint as unread_count
from public.conversation_members cm
left join public.messages m on m.conversation_id=cm.conversation_id
 and m.sender_id<>cm.user_id
 and m.created_at>coalesce(cm.last_read_at,cm.joined_at)
 and m.deleted_at is null
where cm.user_id=(select auth.uid())
group by cm.conversation_id;
$$;
revoke all on function public.my_conversation_unread_counts() from public,anon,authenticated;
grant execute on function public.my_conversation_unread_counts() to authenticated;
