-- Conecta V2: secure Trickle ICE candidate signaling for private 1:1 calls.
-- Candidates may contain network addresses. Readable ONLY by the two authorized
-- users while an active, accepted and unexpired call exists.
create table if not exists public.chat_call_ice_candidates(
 id bigint generated always as identity primary key,
 call_id uuid not null references public.chat_calls(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 candidate jsonb not null,
 created_at timestamptz not null default now(),
 constraint chat_ice_candidate_limit check(octet_length(candidate::text)<=4096),
 constraint chat_ice_candidate_object check(jsonb_typeof(candidate)='object')
);
create index if not exists chat_call_ice_lookup_idx
 on public.chat_call_ice_candidates(call_id,id);
create index if not exists chat_call_ice_age_idx
 on public.chat_call_ice_candidates(created_at);
alter table public.chat_call_ice_candidates enable row level security;
revoke all on public.chat_call_ice_candidates from PUBLIC,anon,authenticated;
grant select on public.chat_call_ice_candidates to authenticated;

drop policy if exists "ICE candidates only to both live call participants"
 on public.chat_call_ice_candidates;
create policy "ICE candidates only to both live call participants"
on public.chat_call_ice_candidates for select to authenticated
using(exists(
 select 1 from public.chat_calls c
 where c.id=chat_call_ice_candidates.call_id
   and c.status='accepted' and c.expires_at>now()
   and c.created_at>now()-interval '30 minutes'
   and (c.caller_id=(select auth.uid()) or c.callee_id=(select auth.uid()))
));

-- Strictly scoped signed-in write API; callers do not have table INSERT privilege.
create or replace function public.add_chat_call_ice_candidate(
  _call_id uuid,_candidate jsonb)
returns bigint
language plpgsql security definer set search_path='' as $$
declare me uuid := (select auth.uid()); result bigint;
declare ice text;
begin
 if me is null or _call_id is null or _candidate is null
    or jsonb_typeof(_candidate)<>'object'
    or octet_length(_candidate::text)>4096
    or jsonb_typeof(_candidate->'candidate')<>'string'
    or jsonb_typeof(_candidate->'sdpMid') not in ('string','null')
    or jsonb_typeof(_candidate->'sdpMLineIndex') not in ('number','null')
 then
   raise exception 'Candidato ICE inválido.' using errcode='22023';
 end if;
 ice:=_candidate->>'candidate';
 if length(ice)<5 or length(ice)>2048 or left(ice,10)<>'candidate:' then
   raise exception 'Formato ICE inválido.' using errcode='22023';
 end if;
 if not exists(
   select 1 from public.chat_calls c where c.id=_call_id
     and c.status='accepted' and c.expires_at>now()
     and c.created_at>now()-interval '30 minutes'
     and (c.caller_id=me or c.callee_id=me)
     and exists(select 1 from public.friendships f where f.status='accepted'
       and ((f.requester_id=c.caller_id and f.addressee_id=c.callee_id)
         or (f.addressee_id=c.caller_id and f.requester_id=c.callee_id)))
     and not exists(select 1 from public.user_blocks b
       where (b.blocker_id=c.caller_id and b.blocked_id=c.callee_id)
         or (b.blocker_id=c.callee_id and b.blocked_id=c.caller_id))
 ) then
   raise exception 'Chamada indisponível para sinalização.'
     using errcode='42501';
 end if;
 -- Bound each peer to at most 60 candidates per call (protects free quota).
 perform pg_advisory_xact_lock(hashtext('conecta_ice'),hashtext(_call_id::text||me::text));
 if (select count(*) from public.chat_call_ice_candidates
       where call_id=_call_id and sender_id=me)>=60 then
   raise exception 'Limite de candidatos ICE atingido.' using errcode='54000';
 end if;
 insert into public.chat_call_ice_candidates(call_id,sender_id,candidate)
   values(_call_id,me,_candidate) returning id into result;
 return result;
end;
$$;
revoke all on function public.add_chat_call_ice_candidate(uuid,jsonb) from PUBLIC,anon;
grant execute on function public.add_chat_call_ice_candidate(uuid,jsonb) to authenticated;

-- Remove all candidates on explicit end. Also clear expired call candidates on
-- subsequent call attempts; stale candidate SELECT is blocked by RLS regardless.
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
 delete from public.chat_call_ice_candidates where call_id=_id
   and exists (select 1 from public.chat_calls cc where cc.id=_id
      and (cc.caller_id=me or cc.callee_id=me)
      and cc.status in ('ended','declined','missed'));
end;$$;


revoke all on function public.end_chat_call(uuid,boolean) from PUBLIC,anon;
grant execute on function public.end_chat_call(uuid,boolean) to authenticated;

do $$
begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
    and schemaname='public' and tablename='chat_call_ice_candidates') then
  alter publication supabase_realtime add table public.chat_call_ice_candidates;
 end if;
end;
$$;
