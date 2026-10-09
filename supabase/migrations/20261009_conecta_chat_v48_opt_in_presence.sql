-- Chat V4.8: opt-in, short-lived online presence. No IP, URL, activity
-- history, device fingerprint or personal content is stored.
create table if not exists public.chat_user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);
create index if not exists chat_user_presence_active_idx
  on public.chat_user_presence (last_seen_at desc);
alter table public.chat_user_presence enable row level security;
revoke all on public.chat_user_presence from public, anon;
grant select, insert, update, delete on public.chat_user_presence to authenticated;

drop policy if exists "chat presence visible only to connected friends" on public.chat_user_presence;
create policy "chat presence visible only to connected friends"
on public.chat_user_presence for select to authenticated
using (
  user_id=(select auth.uid()) or (
    last_seen_at>now()-interval '90 seconds'
    and exists (
      select 1 from public.friendships f
      where f.status='accepted'
        and (
          (f.requester_id=(select auth.uid()) and f.addressee_id=chat_user_presence.user_id)
          or
          (f.addressee_id=(select auth.uid()) and f.requester_id=chat_user_presence.user_id)
        )
    )
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id=(select auth.uid()) and b.blocked_id=chat_user_presence.user_id)
         or (b.blocked_id=(select auth.uid()) and b.blocker_id=chat_user_presence.user_id)
    )
  )
);
drop policy if exists "chat presence self insert" on public.chat_user_presence;
create policy "chat presence self insert"
on public.chat_user_presence for insert to authenticated
with check (user_id=(select auth.uid()) and
  last_seen_at between now()-interval '30 seconds' and now()+interval '15 seconds');
drop policy if exists "chat presence self update" on public.chat_user_presence;
create policy "chat presence self update"
on public.chat_user_presence for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()) and
  last_seen_at between now()-interval '30 seconds' and now()+interval '15 seconds');
drop policy if exists "chat presence self delete" on public.chat_user_presence;
create policy "chat presence self delete"
on public.chat_user_presence for delete to authenticated
using (user_id=(select auth.uid()));

-- Timestamp always comes from PostgreSQL; no client-controlled future presence.
create or replace function public.touch_chat_presence()
returns void language plpgsql security invoker set search_path='' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Autenticação obrigatória.' using errcode='42501';
  end if;
  insert into public.chat_user_presence(user_id,last_seen_at)
  values ((select auth.uid()),now())
  on conflict (user_id) do update set last_seen_at=excluded.last_seen_at;
end;
$$;
revoke all on function public.touch_chat_presence() from public,anon;
grant execute on function public.touch_chat_presence() to authenticated;
