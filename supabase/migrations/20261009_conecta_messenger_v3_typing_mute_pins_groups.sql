-- Messenger V3: private typing indicators, chat mutes, pinned messages and group settings.
-- RLS always checks actual membership; no client can choose its own elevated role.
alter table public.conversation_members
 add column if not exists muted_until timestamptz;
revoke update on public.conversation_members from anon,authenticated;
grant update(last_read_at,muted_until) on public.conversation_members to authenticated;
-- Explicit safe client edit: only a user's own receipt & mute fields can change.
create or replace function app_private.guard_member_preferences()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.conversation_id is distinct from old.conversation_id
  or new.user_id is distinct from old.user_id
  or new.joined_at is distinct from old.joined_at then
  raise exception 'Dados de membro não podem ser alterados.' using errcode='23514';
 end if;
 if new.muted_until is not null and (new.muted_until > now()+interval '1 year'
  or new.muted_until < now()-interval '1 day') then
  raise exception 'Período de silenciamento inválido.' using errcode='22023';
 end if;
 return new;
end;$$;
drop trigger if exists guard_conversation_member_preferences on public.conversation_members;
create trigger guard_conversation_member_preferences before update on public.conversation_members
 for each row execute function app_private.guard_member_preferences();

create table if not exists public.conversation_typing(
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 updated_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 seconds',
 primary key(conversation_id,user_id)
);
create index if not exists conversation_typing_expiry on public.conversation_typing(expires_at);
alter table public.conversation_typing enable row level security;
revoke all on public.conversation_typing from public,anon,authenticated;
grant select,insert,delete on public.conversation_typing to authenticated;
grant update(expires_at) on public.conversation_typing to authenticated;
grant all on public.conversation_typing to service_role;
drop policy if exists "typing members see presence" on public.conversation_typing;
create policy "typing members see presence" on public.conversation_typing
 for select to authenticated using (
 app_private.is_conversation_member(conversation_id)
 and expires_at>now());
drop policy if exists "typing members start presence" on public.conversation_typing;
create policy "typing members start presence" on public.conversation_typing
 for insert to authenticated with check (
 user_id=(select auth.uid()) and app_private.is_conversation_member(conversation_id)
 and not exists(
  select 1 from public.conversation_members cm
  join public.teen_safety_preferences tsp on tsp.user_id=cm.user_id
  where cm.conversation_id=conversation_typing.conversation_id
   and tsp.mode='youth_protection'
 ));
drop policy if exists "typing members renew presence" on public.conversation_typing;
create policy "typing members renew presence" on public.conversation_typing
 for update to authenticated using (
 user_id=(select auth.uid()) and app_private.is_conversation_member(conversation_id))
 with check (user_id=(select auth.uid()) and app_private.is_conversation_member(conversation_id));
drop policy if exists "typing members clear presence" on public.conversation_typing;
create policy "typing members clear presence" on public.conversation_typing
 for delete to authenticated using(user_id=(select auth.uid()));
create or replace function app_private.limit_typing_presence()
returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.conversation_id is distinct from old.conversation_id
     or new.user_id is distinct from old.user_id) then
  raise exception 'Presença de outra pessoa não pode ser alterada.' using errcode='23514';
 end if;
 new.updated_at:=now();
 new.expires_at:=now()+interval '7 seconds';
 return new;
end;$$;
drop trigger if exists limit_conversation_typing_presence on public.conversation_typing;
create trigger limit_conversation_typing_presence
 before insert or update on public.conversation_typing for each row
 execute function app_private.limit_typing_presence();

create table if not exists public.conversation_pins(
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 message_id uuid not null references public.messages(id) on delete cascade,
 pinned_by uuid references public.profiles(id) on delete set null,
 pinned_at timestamptz not null default now(),
 primary key(conversation_id,message_id)
);
create index if not exists conversation_pins_recent on public.conversation_pins(conversation_id,pinned_at desc);
alter table public.conversation_pins enable row level security;
revoke all on public.conversation_pins from public,anon,authenticated;
grant select on public.conversation_pins to authenticated;
grant all on public.conversation_pins to service_role;
drop policy if exists "members view conversation pins" on public.conversation_pins;
create policy "members view conversation pins" on public.conversation_pins
 for select to authenticated using (app_private.is_conversation_member(conversation_id)
 and exists(select 1 from public.messages m
 where m.id=message_id and m.conversation_id=conversation_id and m.deleted_at is null));

create or replace function public.toggle_conversation_pin(_conversation uuid,_message uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid());creator uuid;member_count bigint;changed integer;
begin
 if me is null or not app_private.is_conversation_member(_conversation) then
  raise exception 'Conversa não autorizada.' using errcode='42501';
 end if;
 select c.created_by into creator from public.conversations c
 where c.id=_conversation for update;
 select count(*) into member_count from public.conversation_members cm
 where cm.conversation_id=_conversation;
 if member_count>2 and creator<>me then
  raise exception 'Somente quem administra o grupo pode fixar mensagens.' using errcode='42501';
 end if;
 if not exists(select 1 from public.messages m
   where m.id=_message and m.conversation_id=_conversation and m.deleted_at is null) then
  raise exception 'Mensagem não encontrada nesta conversa.' using errcode='22023';
 end if;
 delete from public.conversation_pins where conversation_id=_conversation and message_id=_message;
 get diagnostics changed=row_count;
 if changed>0 then return false;end if;
 if (select count(*) from public.conversation_pins
   where conversation_id=_conversation)>=3 then
  raise exception 'Limite de três mensagens fixadas atingido.' using errcode='23514';
 end if;
 insert into public.conversation_pins(conversation_id,message_id,pinned_by)
 values(_conversation,_message,me);
 return true;
end;$$;
revoke all on function public.toggle_conversation_pin(uuid,uuid) from public,anon,authenticated;
grant execute on function public.toggle_conversation_pin(uuid,uuid) to authenticated;

create or replace function public.rename_conversation_group(_conversation uuid,_title text)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid());creator uuid;count_members bigint;
begin
 if me is null or char_length(btrim(coalesce(_title,''))) not between 2 and 80 then
  raise exception 'Nome de grupo inválido.' using errcode='22023';
 end if;
 select created_by into creator from public.conversations
 where id=_conversation for update;
 if creator is distinct from me or not app_private.is_conversation_member(_conversation) then
  raise exception 'Somente quem criou o grupo pode renomeá-lo.' using errcode='42501';
 end if;
 select count(*) into count_members from public.conversation_members
 where conversation_id=_conversation;
 if count_members<3 then raise exception 'Esta conversa não é um grupo.' using errcode='23514';end if;
 update public.conversations set title=btrim(_title) where id=_conversation;
end;$$;
revoke all on function public.rename_conversation_group(uuid,text) from public,anon,authenticated;
grant execute on function public.rename_conversation_group(uuid,text) to authenticated;

create or replace function public.add_conversation_group_member(_conversation uuid,_friend uuid)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid());creator uuid;member_count bigint;
begin
 if me is null or _friend is null or _friend=me then
  raise exception 'Convite inválido.' using errcode='22023';
 end if;
 select created_by into creator from public.conversations
 where id=_conversation for update;
 if creator is distinct from me or not app_private.is_conversation_member(_conversation) then
  raise exception 'Somente quem criou o grupo pode convidar.' using errcode='42501';
 end if;
 select count(*) into member_count from public.conversation_members where conversation_id=_conversation;
 if member_count<3 or member_count>=21 then
  raise exception 'Grupo inexistente ou limite de 21 pessoas atingido.' using errcode='23514';
 end if;
 if exists(select 1 from public.conversation_members where conversation_id=_conversation and user_id=_friend) then
  raise exception 'Esta pessoa já participa do grupo.' using errcode='23505';
 end if;
 if not exists(select 1 from public.friendships f where f.status='accepted'
  and ((f.requester_id=me and f.addressee_id=_friend)
   or (f.requester_id=_friend and f.addressee_id=me))) then
  raise exception 'Só é possível adicionar uma amizade aceita.' using errcode='42501';
 end if;
 if exists(select 1 from public.user_blocks b
   where (b.blocker_id=me and b.blocked_id=_friend) or (b.blocker_id=_friend and b.blocked_id=me)) then
  raise exception 'Convite bloqueado pelas preferências de privacidade.' using errcode='42501';
 end if;
 -- This function runs with definer rights; re-check teen safety explicitly.
 if exists(select 1 from public.teen_safety_preferences t
    where t.user_id in(me,_friend) and t.mode='youth_protection') then
  raise exception 'Convite indisponível para conta com proteção etária.' using errcode='42501';
 end if;
 insert into public.conversation_members(conversation_id,user_id) values(_conversation,_friend);
end;$$;
revoke all on function public.add_conversation_group_member(uuid,uuid) from public,anon,authenticated;
grant execute on function public.add_conversation_group_member(uuid,uuid) to authenticated;
