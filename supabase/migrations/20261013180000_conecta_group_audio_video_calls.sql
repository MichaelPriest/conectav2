-- Group audio/video calls. Signaling is scoped to active members of the same group.
create table if not exists public.group_call_sessions (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 created_by uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('audio','video')),
 status text not null default 'ringing' check (status in ('ringing','active','ended')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now() + interval '2 hours'),
 ended_at timestamptz
);
create index if not exists group_call_sessions_conversation_active_idx
 on public.group_call_sessions(conversation_id, status, created_at desc);
create table if not exists public.group_call_participants (
 session_id uuid not null references public.group_call_sessions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'joined' check (status in ('joined','declined','left')),
 joined_at timestamptz not null default now(),
 left_at timestamptz,
 primary key(session_id,user_id)
);
create table if not exists public.group_call_signals (
 id bigint generated always as identity primary key,
 session_id uuid not null references public.group_call_sessions(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 signal jsonb not null,
 created_at timestamptz not null default now(),
 consumed_at timestamptz,
 check(sender_id <> recipient_id),
 check(jsonb_typeof(signal) = 'object'),
 check(octet_length(signal::text) <= 65536)
);
create index if not exists group_call_signals_recipient_idx
 on public.group_call_signals(session_id,recipient_id,id);
alter table public.group_call_sessions enable row level security;
alter table public.group_call_participants enable row level security;
alter table public.group_call_signals enable row level security;
drop policy if exists group_call_sessions_member_read on public.group_call_sessions;
create policy group_call_sessions_member_read on public.group_call_sessions for select to authenticated
 using (exists(select 1 from public.conversation_members m where m.conversation_id=group_call_sessions.conversation_id and m.user_id=(select auth.uid())));
drop policy if exists group_call_participants_member_read on public.group_call_participants;
create policy group_call_participants_member_read on public.group_call_participants for select to authenticated
 using (exists(select 1 from public.group_call_sessions s join public.conversation_members m on m.conversation_id=s.conversation_id where s.id=group_call_participants.session_id and m.user_id=(select auth.uid())));
drop policy if exists group_call_signals_involved_read on public.group_call_signals;
create policy group_call_signals_involved_read on public.group_call_signals for select to authenticated
 using (recipient_id=(select auth.uid()) or sender_id=(select auth.uid()));
revoke all on public.group_call_sessions, public.group_call_participants, public.group_call_signals from anon, authenticated;
grant select on public.group_call_sessions, public.group_call_participants, public.group_call_signals to authenticated;

create or replace function public.start_group_call(_conversation uuid,_kind text)
returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid := (select auth.uid()); result uuid;
begin
 if me is null or _kind not in ('audio','video') then raise exception 'Chamada inválida.' using errcode='22023'; end if;
 if not exists(select 1 from public.conversations c where c.id=_conversation and c.is_group=true)
 or not exists(select 1 from public.conversation_members m where m.conversation_id=_conversation and m.user_id=me)
 then raise exception 'Apenas membros podem iniciar chamadas neste grupo.' using errcode='42501'; end if;
 if exists(select 1 from public.teen_safety_preferences t where t.user_id=me and t.mode='youth_protection')
 then raise exception 'Chamada não permitida pelas configurações de segurança.' using errcode='42501'; end if;
 if exists(select 1 from public.group_call_sessions s where s.conversation_id=_conversation and s.status in ('ringing','active') and s.expires_at>now())
 then raise exception 'Já existe uma chamada ativa neste grupo.' using errcode='23505'; end if;
 insert into public.group_call_sessions(conversation_id,created_by,kind,status) values(_conversation,me,_kind,'active') returning id into result;
 insert into public.group_call_participants(session_id,user_id) values(result,me);
 return result;
end; $$;

create or replace function public.join_group_call(_session uuid)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid := (select auth.uid()); conv uuid;
begin
 select s.conversation_id into conv from public.group_call_sessions s where s.id=_session and s.status in ('ringing','active') and s.expires_at>now();
 if me is null or conv is null or not exists(select 1 from public.conversation_members m where m.conversation_id=conv and m.user_id=me)
 then raise exception 'Chamada indisponível ou acesso não permitido.' using errcode='42501'; end if;
 if exists(select 1 from public.teen_safety_preferences t where t.user_id=me and t.mode='youth_protection')
 then raise exception 'Chamada não permitida pelas configurações de segurança.' using errcode='42501'; end if;
 if (select count(*) from public.group_call_participants p where p.session_id=_session and p.status='joined')>=8
 and not exists(select 1 from public.group_call_participants p where p.session_id=_session and p.user_id=me and p.status='joined')
 then raise exception 'Esta chamada já atingiu o limite de 8 participantes.' using errcode='54000'; end if;
 insert into public.group_call_participants(session_id,user_id,status,joined_at,left_at)
 values(_session,me,'joined',now(),null)
 on conflict(session_id,user_id) do update set status='joined',joined_at=now(),left_at=null;
 update public.group_call_sessions set status='active' where id=_session;
end; $$;

create or replace function public.send_group_call_signal(_session uuid,_recipient uuid,_signal jsonb)
returns bigint language plpgsql security definer set search_path='' as $$
declare me uuid := (select auth.uid()); result bigint;
begin
 if me is null or _recipient is null or me=_recipient or jsonb_typeof(_signal)<>'object'
 or octet_length(_signal::text)>65536
 or not exists(select 1 from public.group_call_participants p where p.session_id=_session and p.user_id=me and p.status='joined')
 or not exists(select 1 from public.group_call_participants p where p.session_id=_session and p.user_id=_recipient and p.status='joined')
 or not exists(select 1 from public.group_call_sessions s join public.conversation_members m on m.conversation_id=s.conversation_id where s.id=_session and s.status='active' and s.expires_at>now() and m.user_id=me)
 then raise exception 'Sinal de chamada não autorizado.' using errcode='42501'; end if;
 insert into public.group_call_signals(session_id,sender_id,recipient_id,signal)
 values(_session,me,_recipient,_signal) returning id into result;
 return result;
end; $$;

create or replace function public.leave_group_call(_session uuid)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid := (select auth.uid());
begin
 update public.group_call_participants set status='left',left_at=now()
 where session_id=_session and user_id=me and status='joined';
 if not exists(select 1 from public.group_call_participants p where p.session_id=_session and p.status='joined')
 then update public.group_call_sessions set status='ended',ended_at=now() where id=_session; end if;
 delete from public.group_call_signals where session_id=_session and created_at<now()-interval '1 hour';
end; $$;

revoke all on function public.start_group_call(uuid,text) from public,anon;
revoke all on function public.join_group_call(uuid) from public,anon;
revoke all on function public.send_group_call_signal(uuid,uuid,jsonb) from public,anon;
revoke all on function public.leave_group_call(uuid) from public,anon;
grant execute on function public.start_group_call(uuid,text) to authenticated;
grant execute on function public.join_group_call(uuid) to authenticated;
grant execute on function public.send_group_call_signal(uuid,uuid,jsonb) to authenticated;
grant execute on function public.leave_group_call(uuid) to authenticated;

do $$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='group_call_sessions') then alter publication supabase_realtime add table public.group_call_sessions; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='group_call_participants') then alter publication supabase_realtime add table public.group_call_participants; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='group_call_signals') then alter publication supabase_realtime add table public.group_call_signals; end if;
 end if;
end $$;
