-- Inbox preview should return one latest private message per conversation.
-- A global LIMIT 200 previously hid recent messages from quieter conversations.
create or replace function public.my_latest_conversation_messages()
returns table(
 id uuid,conversation_id uuid,sender_id uuid,content text,
 created_at timestamptz,media_path text,media_type text,edited_at timestamptz,
 deleted_at timestamptz,reply_to uuid
)
language sql stable security definer set search_path='' as $$
select distinct on (m.conversation_id)
 m.id,m.conversation_id,m.sender_id,m.content,m.created_at,m.media_path,
 m.media_type,m.edited_at,m.deleted_at,m.reply_to
from public.messages m
join public.conversation_members cm on cm.conversation_id=m.conversation_id
where cm.user_id=(select auth.uid())
order by m.conversation_id,m.created_at desc,m.id desc;
$$;
revoke all on function public.my_latest_conversation_messages() from public,anon,authenticated;
grant execute on function public.my_latest_conversation_messages() to authenticated;
