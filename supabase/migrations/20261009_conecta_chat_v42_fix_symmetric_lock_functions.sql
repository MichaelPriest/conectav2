-- Correct PostgreSQL LEAST/GREATEST syntax; these are special SQL expressions.
-- Chat V4.2: one active direct conversation for an accepted friendship.
-- The lock key is identical for A->B and B->A, so two concurrent tabs/users
-- do not create two separate chat rooms.
create or replace function public.create_conversation_with_members(_title text,_other_user_ids uuid[])
returns uuid language plpgsql security invoker set search_path='' as $$
declare
 creator uuid:=(select auth.uid());
 new_conversation uuid;
 other_id uuid;
 existing_conversation uuid;
 requested_count integer;
 distinct_count integer;
 pair_key text;
begin
 if creator is null then
   raise exception 'Autenticação obrigatória.' using errcode='42501';end if;
 requested_count:=coalesce(pg_catalog.cardinality(_other_user_ids),0);
 if requested_count<1 or requested_count>20 then
   raise exception 'Informe de 1 a 20 participantes.' using errcode='22023';end if;
 if _title is null or pg_catalog.length(pg_catalog.btrim(_title)) not between 2 and 80 then
   raise exception 'Nome da conversa inválido.' using errcode='22023';end if;
 if exists(select 1 from pg_catalog.unnest(_other_user_ids) u(user_id)
    where u.user_id is null or u.user_id=creator) then
   raise exception 'IDs inválidos ou duplicados.' using errcode='22023';end if;
 select count(distinct u.user_id) into distinct_count
 from pg_catalog.unnest(_other_user_ids) u(user_id);
 if distinct_count<>requested_count then
   raise exception 'Não envie convidados duplicados.' using errcode='22023';end if;
 if requested_count=1 then
   other_id:=_other_user_ids[1];
   -- Reject access even to an *existing* room if friendship has been revoked.
   if not exists(select 1 from public.friendships f where f.status='accepted'
     and ((f.requester_id=creator and f.addressee_id=other_id)
       or (f.addressee_id=creator and f.requester_id=other_id))) then
     raise exception 'Conversa privada exige amizade aceita.' using errcode='42501';end if;
   if exists(select 1 from public.user_blocks b where
     (b.blocker_id=creator and b.blocked_id=other_id)
     or (b.blocker_id=other_id and b.blocked_id=creator)) then
     raise exception 'Conversa impedida pelo bloqueio.' using errcode='42501';end if;
   pair_key:=least(creator::text,other_id::text)
     ||'/'||greatest(creator::text,other_id::text);
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(pair_key,26091));
   select c.id into existing_conversation
   from public.conversation_members mine
   join public.conversations c on c.id=mine.conversation_id
   join public.conversation_members theirs on theirs.conversation_id=c.id and theirs.user_id=other_id
   where mine.user_id=creator and not c.is_group
    and (select count(*) from public.conversation_members m
         where m.conversation_id=c.id)=2
   order by c.created_at,c.id limit 1;
   if existing_conversation is not null then return existing_conversation;end if;
 end if;
 insert into public.conversations(created_by,title)
 values(creator,pg_catalog.btrim(_title)) returning id into new_conversation;
 insert into public.conversation_members(conversation_id,user_id)
 select new_conversation,p.id from(
   select creator as id
   union all
   select u.user_id from pg_catalog.unnest(_other_user_ids) u(user_id)
 )p;
 if requested_count>=2 then
   perform public.mark_conversation_as_group(new_conversation);
 end if;
 return new_conversation;
end;
$$;
revoke all on function public.create_conversation_with_members(text,uuid[]) from public,anon,authenticated;
grant execute on function public.create_conversation_with_members(text,uuid[]) to authenticated;
