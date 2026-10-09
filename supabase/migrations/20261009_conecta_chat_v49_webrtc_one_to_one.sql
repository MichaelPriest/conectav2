-- Chat V4.9: temporary one-to-one WebRTC signalling.
create table if not exists public.chat_calls (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 caller_id uuid not null references auth.users(id) on delete cascade,
 callee_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('audio','video')),
 status text not null default 'ringing' check(status in ('ringing','accepted','declined','ended')),
 offer_sdp text,answer_sdp text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '65 seconds'),
 constraint distinct_chat_call_users check(caller_id<>callee_id),
 constraint chat_call_offer_limit check(offer_sdp is null or length(offer_sdp) between 20 and 25000),
 constraint chat_call_answer_limit check(answer_sdp is null or length(answer_sdp) between 20 and 25000)
);
create index if not exists chat_calls_incoming_idx on public.chat_calls(callee_id,created_at desc) where status='ringing';
alter table public.chat_calls enable row level security;
revoke all on public.chat_calls from public,anon,authenticated;
grant select on public.chat_calls to authenticated;
drop policy if exists "participants see recent private calls" on public.chat_calls;
create policy "participants see recent private calls" on public.chat_calls
for select to authenticated
using ((caller_id=(select auth.uid()) or callee_id=(select auth.uid()))
 and created_at>now()-interval '30 minutes'
 and exists(select 1 from public.friendships f where f.status='accepted' and
  ((f.requester_id=caller_id and f.addressee_id=callee_id) or
  (f.addressee_id=caller_id and f.requester_id=callee_id)))
 and not exists(select 1 from public.user_blocks b where
  (b.blocker_id=caller_id and b.blocked_id=callee_id) or
  (b.blocker_id=callee_id and b.blocked_id=caller_id)));

-- SECURITY DEFINER functions are individually authorized, have empty search_path,
-- revoke PUBLIC privileges and never accept a caller ID from the browser.
create or replace function public.start_chat_call(_conversation uuid,_callee uuid,_kind text)
returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid()); result uuid;
begin
 if me is null or _callee is null or me=_callee or _kind not in ('audio','video')
 then raise exception 'Chamada inválida.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtext('chat_call'),hashtext(me::text));
 if not exists(select 1 from public.conversations c where c.id=_conversation and c.is_group=false)
 or (select count(*) from public.conversation_members m where m.conversation_id=_conversation)<>2
 or not exists(select 1 from public.conversation_members m where m.conversation_id=_conversation and m.user_id=me)
 or not exists(select 1 from public.conversation_members m where m.conversation_id=_conversation and m.user_id=_callee)
 or not exists(select 1 from public.friendships f where f.status='accepted' and
   ((f.requester_id=me and f.addressee_id=_callee) or
    (f.addressee_id=me and f.requester_id=_callee)))
 or exists(select 1 from public.user_blocks b where
   (b.blocker_id=me and b.blocked_id=_callee) or (b.blocker_id=_callee and b.blocked_id=me))
 or exists(select 1 from public.teen_safety_preferences t
   where t.user_id in (me,_callee) and t.mode='youth_protection')
 then raise exception 'Chamada não permitida nesta conversa.' using errcode='42501';end if;
 -- Close orphaned previous calls and discard their SDP.
 update public.chat_calls set status='ended',offer_sdp=null,answer_sdp=null,expires_at=now()
 where status in ('ringing','accepted') and expires_at<=now()
 and (caller_id in (me,_callee) or callee_id in (me,_callee));
 if exists(select 1 from public.chat_calls where status in ('ringing','accepted') and expires_at>now()
  and (caller_id in (me,_callee) or callee_id in (me,_callee)))
 or (select count(*) from public.chat_calls where caller_id=me
  and created_at>now()-interval '10 minutes')>=5
 then raise exception 'Chamada em andamento ou limite temporário atingido.' using errcode='23505';end if;
 insert into public.chat_calls(conversation_id,caller_id,callee_id,kind)
 values(_conversation,me,_callee,_kind) returning id into result;
 return result;
end;$$;

create or replace function public.accept_chat_call(_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid());
begin
 update public.chat_calls set status='accepted',expires_at=now()+interval '120 seconds',updated_at=now()
 where id=_id and callee_id=me and status='ringing' and expires_at>now()
 and exists(select 1 from public.friendships f where f.status='accepted' and
  ((f.requester_id=caller_id and f.addressee_id=callee_id) or
   (f.addressee_id=caller_id and f.requester_id=callee_id)))
 and not exists(select 1 from public.user_blocks b where
  (b.blocker_id=caller_id and b.blocked_id=callee_id) or
  (b.blocker_id=callee_id and b.blocked_id=caller_id));
 if not found then raise exception 'Chamada indisponível.' using errcode='42501';end if;
end;$$;

create or replace function public.signal_chat_call(_id uuid,_kind text,_sdp text)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid());
begin
 if _sdp is null or length(_sdp) not between 20 and 25000 or left(_sdp,3)<>'v=0'
 or _kind not in ('offer','answer') then
 raise exception 'Sinalização inválida.' using errcode='22023';end if;
 if _kind='offer' then
  update public.chat_calls set offer_sdp=_sdp,updated_at=now()
  where id=_id and caller_id=me and status='accepted' and expires_at>now() and offer_sdp is null;
 else
  update public.chat_calls set answer_sdp=_sdp,updated_at=now()
  where id=_id and callee_id=me and status='accepted' and expires_at>now()
    and offer_sdp is not null and answer_sdp is null;
 end if;
 if not found then raise exception 'Sinalização não autorizada.' using errcode='42501';end if;
end;$$;

create or replace function public.keep_chat_call_alive(_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid());
begin
 update public.chat_calls set expires_at=now()+interval '120 seconds',updated_at=now()
 where id=_id and status='accepted' and expires_at>now()
  and (caller_id=me or callee_id=me);
 if not found then raise exception 'Chamada encerrada.' using errcode='42501';end if;
end;$$;

create or replace function public.end_chat_call(_id uuid,_decline boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid());
begin
 update public.chat_calls set status=case when _decline and callee_id=me and
  status='ringing' then 'declined' else 'ended' end,
  offer_sdp=null,answer_sdp=null,expires_at=now(),updated_at=now()
 where id=_id and status in ('ringing','accepted') and (caller_id=me or callee_id=me);
end;$$;

revoke all on function public.start_chat_call(uuid,uuid,text) from public,anon;
revoke all on function public.accept_chat_call(uuid) from public,anon;
revoke all on function public.signal_chat_call(uuid,text,text) from public,anon;
revoke all on function public.keep_chat_call_alive(uuid) from public,anon;
revoke all on function public.end_chat_call(uuid,boolean) from public,anon;
grant execute on function public.start_chat_call(uuid,uuid,text) to authenticated;
grant execute on function public.accept_chat_call(uuid) to authenticated;
grant execute on function public.signal_chat_call(uuid,text,text) to authenticated;
grant execute on function public.keep_chat_call_alive(uuid) to authenticated;
grant execute on function public.end_chat_call(uuid,boolean) to authenticated;
