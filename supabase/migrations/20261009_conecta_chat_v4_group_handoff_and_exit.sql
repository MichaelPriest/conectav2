-- Preserve group identity even when members leave; allow owner handoff and safe exits.
alter table public.conversations add column if not exists is_group boolean not null default false;
update public.conversations c set is_group=true
where exists(select 1 from public.conversation_members cm where cm.conversation_id=c.id
 group by cm.conversation_id having count(*)>=3) and not c.is_group;

-- Conversation identity, owner, and group type must not be altered by direct clients.
revoke update on public.conversations from anon,authenticated;
grant select,insert on public.conversations to authenticated;
revoke insert(is_group) on public.conversations from authenticated;
revoke insert(is_group) on public.conversations from anon;

create or replace function public.create_conversation_with_members(_title text,_other_user_ids uuid[])
returns uuid language plpgsql set search_path='' as $$
declare creator uuid:=(select auth.uid());new_conversation uuid;requested_count integer;distinct_count integer;
begin
 if creator is null then raise exception 'Autenticação obrigatória.' using errcode='42501';end if;
 requested_count:=coalesce(pg_catalog.cardinality(_other_user_ids),0);
 if requested_count<1 or requested_count>20 then
  raise exception 'Informe de 1 a 20 participantes.' using errcode='22023';end if;
 if _title is null or length(pg_catalog.btrim(_title)) not between 2 and 80 then
  raise exception 'Nome da conversa inválido.' using errcode='22023';end if;
 if exists(select 1 from pg_catalog.unnest(_other_user_ids) as u(user_id)
  where u.user_id is null or u.user_id=creator) then
  raise exception 'IDs inválidos ou duplicados.' using errcode='22023';end if;
 select count(distinct u.user_id) into distinct_count
  from pg_catalog.unnest(_other_user_ids) as u(user_id);
 if distinct_count<>requested_count then
  raise exception 'Não envie convidados duplicados.' using errcode='22023';end if;
 -- SECURITY INVOKER so friendship and user block RLS checks are preserved.
 insert into public.conversations(created_by,title)
 values(creator,pg_catalog.btrim(_title)) returning id into new_conversation;
 insert into public.conversation_members(conversation_id,user_id)
 select new_conversation,p.id from(
  select creator id union all select u.user_id from pg_catalog.unnest(_other_user_ids) u(user_id)
 )p;
 if requested_count>=2 then
  -- Set group flag only after all RLS-validated memberships exist.
  -- Uses RPC because clients cannot edit owner/group directly.
  perform public.mark_conversation_as_group(new_conversation);
 end if;
 return new_conversation;
end;$$;

create or replace function public.mark_conversation_as_group(_conversation uuid)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid());
begin
 if me is null or not exists(select 1 from public.conversations c
  where c.id=_conversation and c.created_by=me) or
  (select count(*) from public.conversation_members where conversation_id=_conversation)<3
 then raise exception 'Não é um grupo válido.' using errcode='42501';end if;
 update public.conversations set is_group=true where id=_conversation;
end;$$;
revoke all on function public.mark_conversation_as_group(uuid) from public,anon,authenticated;
grant execute on function public.mark_conversation_as_group(uuid) to authenticated;

-- Group management is always server-authorized.
create or replace function public.leave_conversation_group(_conversation uuid)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid());owner uuid;group_state boolean;
begin
 if me is null then raise exception 'Autenticação obrigatória.' using errcode='42501';end if;
 select c.created_by,c.is_group into owner,group_state from public.conversations c
 where c.id=_conversation for update;
 if not coalesce(group_state,false) or not app_private.is_conversation_member(_conversation) then
  raise exception 'Você não participa deste grupo.' using errcode='42501';end if;
 if owner=me then
  raise exception 'Transfira a administração antes de sair.' using errcode='23514';end if;
 delete from public.conversation_members where conversation_id=_conversation and user_id=me;
 delete from public.conversation_typing where conversation_id=_conversation and user_id=me;
end;$$;
revoke all on function public.leave_conversation_group(uuid) from public,anon,authenticated;
grant execute on function public.leave_conversation_group(uuid) to authenticated;

create or replace function public.transfer_conversation_group_owner(_conversation uuid,_new_owner uuid)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid());owner uuid;group_state boolean;
begin
 if me is null or _new_owner is null or _new_owner=me then
  raise exception 'Selecione outro participante.' using errcode='22023';end if;
 select created_by,is_group into owner,group_state
 from public.conversations where id=_conversation for update;
 if owner is distinct from me or not coalesce(group_state,false)
 or not app_private.is_conversation_member(_conversation) then
  raise exception 'Só o administrador pode transferir o grupo.' using errcode='42501';end if;
 if not exists(select 1 from public.conversation_members
  where conversation_id=_conversation and user_id=_new_owner) then
  raise exception 'O novo administrador deve participar do grupo.' using errcode='23514';end if;
 update public.conversations set created_by=_new_owner where id=_conversation;
end;$$;
revoke all on function public.transfer_conversation_group_owner(uuid,uuid) from public,anon,authenticated;
grant execute on function public.transfer_conversation_group_owner(uuid,uuid) to authenticated;

create or replace function public.rename_conversation_group(_conversation uuid,_title text)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid());
begin
 if me is null or length(btrim(coalesce(_title,''))) not between 2 and 80 then
  raise exception 'Nome do grupo inválido.' using errcode='22023';end if;
 if not exists(select 1 from public.conversations c where c.id=_conversation
  and c.created_by=me and c.is_group) or
 not app_private.is_conversation_member(_conversation) then
  raise exception 'Somente o administrador pode alterar o grupo.' using errcode='42501';end if;
 update public.conversations set title=btrim(_title) where id=_conversation;
end;$$;

create or replace function public.add_conversation_group_member(_conversation uuid,_friend uuid)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid());owner uuid;is_group_chat boolean;members bigint;
begin
 if me is null or _friend is null or me=_friend then
  raise exception 'Convite inválido.' using errcode='22023';end if;
 select created_by,is_group into owner,is_group_chat from public.conversations
  where id=_conversation for update;
 if owner is distinct from me or not coalesce(is_group_chat,false)
 or not app_private.is_conversation_member(_conversation) then
  raise exception 'Somente o administrador pode convidar.' using errcode='42501';end if;
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
 insert into public.conversation_members(conversation_id,user_id)
 values(_conversation,_friend);
end;$$;
