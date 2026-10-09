-- Conecta Chat V4.10: optimized Realtime and accurate missed-call tracking.
-- No TURN credentials, IP logging, media storage, or PUBLIC API access.
do $migration$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime'
      and schemaname='public' and tablename='chat_calls'
  ) then
    alter publication supabase_realtime add table public.chat_calls;
  end if;
end $migration$;

alter table public.chat_calls drop constraint if exists chat_calls_status_check;
alter table public.chat_calls add constraint chat_calls_status_check
  check (status in ('ringing','accepted','declined','ended','missed'));
-- Finished calls only retain non-sensitive status and metadata, not SDP.
drop policy if exists "participants see recent private calls" on public.chat_calls;
create policy "participants see recent private calls" on public.chat_calls
for select to authenticated
using ((caller_id=(select auth.uid()) or callee_id=(select auth.uid()))
 and (created_at>now()-interval '30 minutes'
   or (status in ('ended','declined','missed') and created_at>now()-interval '7 days'))
 and exists(select 1 from public.friendships f where f.status='accepted' and
  ((f.requester_id=caller_id and f.addressee_id=callee_id) or
   (f.addressee_id=caller_id and f.requester_id=callee_id)))
 and not exists(select 1 from public.user_blocks b where
  (b.blocker_id=caller_id and b.blocked_id=callee_id) or
  (b.blocker_id=callee_id and b.blocked_id=caller_id)));

create or replace function public.start_chat_call(_conversation uuid,_callee uuid,_kind text)
returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid()); result uuid;
begin
 if me is null or _callee is null or me=_callee or _kind not in ('audio','video')
 then raise exception 'Chamada inválida.' using errcode='22023'; end if;
 -- Lock both participants in consistent order to prevent simultaneous cross-calls.
 perform pg_advisory_xact_lock(hashtext('chat_call'),hashtext(least(me::text,_callee::text)));
 perform pg_advisory_xact_lock(hashtext('chat_call'),hashtext(greatest(me::text,_callee::text)));
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


create or replace function public.end_chat_call(_id uuid,_decline boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid());
begin
 update public.chat_calls set status=case
  when _decline and callee_id=me and status='ringing' then 'declined'
  when status='ringing' and (expires_at<=now() or
    (caller_id=me and created_at<now()-interval '8 seconds')) then 'missed'
  else 'ended' end,
  offer_sdp=null,answer_sdp=null,expires_at=now(),updated_at=now()
 where id=_id and status in ('ringing','accepted') and (caller_id=me or callee_id=me);
end;$$;


-- Clients cannot write arbitrary call status or SDP: only these
-- user-authorized, narrowly scoped functions can update protected data.
revoke all on function public.start_chat_call(uuid,uuid,text) from public,anon;
revoke all on function public.end_chat_call(uuid,boolean) from public,anon;
grant execute on function public.start_chat_call(uuid,uuid,text) to authenticated;
grant execute on function public.end_chat_call(uuid,boolean) to authenticated;
