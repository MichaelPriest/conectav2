-- Deployed directly to Conecta Supabase opdlxxrcdsxqmlhgayfm on 2026-10-09.
-- SECURITY INVOKER: existing RLS still validates every new membership.
-- Any failed membership INSERT aborts the entire RPC transaction.
create or replace function public.create_conversation_with_members(
 _title text, _other_user_ids uuid[]
) returns uuid
language plpgsql security invoker set search_path=''
as $$
declare
 creator uuid := (select auth.uid());
 new_conversation uuid;
 requested_count integer;
 distinct_count integer;
begin
 if creator is null then
   raise exception 'Autenticação obrigatória.' using errcode='42501';
 end if;
 requested_count := coalesce(pg_catalog.cardinality(_other_user_ids),0);
 if requested_count < 1 or requested_count > 20 then
   raise exception 'Informe de 1 a 20 participantes.' using errcode='22023';
 end if;
 if _title is null or length(pg_catalog.btrim(_title)) < 2
   or length(pg_catalog.btrim(_title)) > 80 then
   raise exception 'Nome da conversa inválido (2 a 80 caracteres).' using errcode='22023';
 end if;
 if exists(select 1 from pg_catalog.unnest(_other_user_ids) as u(user_id)
   where u.user_id is null or u.user_id=creator) then
   raise exception 'Não inclua você mesmo ou IDs vazios nos convidados.' using errcode='22023';
 end if;
 select count(distinct u.user_id) into distinct_count
  from pg_catalog.unnest(_other_user_ids) as u(user_id);
 if distinct_count<>requested_count then
   raise exception 'Não envie convidados duplicados.' using errcode='22023';
 end if;
 insert into public.conversations(created_by,title)
 values(creator,pg_catalog.btrim(_title)) returning id into new_conversation;
 insert into public.conversation_members(conversation_id,user_id)
 select new_conversation,participants.id
 from (select creator as id
       union all
       select u.user_id from pg_catalog.unnest(_other_user_ids) as u(user_id)) as participants;
 return new_conversation;
end;
$$;
revoke all on function public.create_conversation_with_members(text,uuid[]) from public,anon,authenticated;
grant execute on function public.create_conversation_with_members(text,uuid[]) to authenticated;
