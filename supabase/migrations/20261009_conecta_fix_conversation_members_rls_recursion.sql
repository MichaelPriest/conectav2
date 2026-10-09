-- Deployed directly to Conecta Supabase opdlxxrcdsxqmlhgayfm on 2026-10-09.
-- Fix the circular RLS dependency: membership INSERT -> conversations SELECT
-- -> membership SELECT. Do NOT relax friendship or block policies.
create or replace function app_private.is_conversation_creator(target_conversation uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select (select auth.uid()) is not null
    and exists(select 1 from public.conversations c
      where c.id=target_conversation and c.created_by=(select auth.uid()));
$$;
revoke all on function app_private.is_conversation_creator(uuid) from public,anon,authenticated;
grant execute on function app_private.is_conversation_creator(uuid) to authenticated;

drop policy if exists "read own conversations" on public.conversations;
create policy "read own conversations" on public.conversations for select to authenticated
using (
  created_by=(select auth.uid())
  or app_private.is_conversation_member(id)
);

drop policy if exists "creator adds members" on public.conversation_members;
create policy "creator adds members" on public.conversation_members for insert to authenticated
with check (
  app_private.is_conversation_creator(conversation_id)
  and (
    user_id=(select auth.uid())
    or exists(select 1 from public.friendships f where f.status='accepted'
      and ((f.requester_id=(select auth.uid()) and f.addressee_id=user_id)
        or (f.addressee_id=(select auth.uid()) and f.requester_id=user_id)))
  )
  and not exists(select 1 from public.user_blocks b where
    (b.blocker_id=(select auth.uid()) and b.blocked_id=user_id)
    or (b.blocker_id=user_id and b.blocked_id=(select auth.uid())))
);
