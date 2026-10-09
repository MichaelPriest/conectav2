-- Search stays strictly inside the signed-in member's conversation.
create or replace function public.search_my_conversation_messages(
 _conversation uuid,_term text,_limit integer default 40
) returns table(id uuid,sender_id uuid,content text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or not app_private.is_conversation_member(_conversation) then
  raise exception 'Conversa não autorizada.' using errcode='42501';
 end if;
 if char_length(btrim(coalesce(_term,'')))<2 or char_length(_term)>100 then
  raise exception 'Busca deve conter entre 2 e 100 caracteres.' using errcode='22023';
 end if;
 return query
 select m.id,m.sender_id,m.content,m.created_at from public.messages m
 where m.conversation_id=_conversation and m.deleted_at is null
   and strpos(lower(m.content),lower(btrim(_term)))>0
 order by m.created_at desc
 limit least(greatest(coalesce(_limit,40),1),60);
end;$$;
revoke all on function public.search_my_conversation_messages(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.search_my_conversation_messages(uuid,text,integer) to authenticated;
