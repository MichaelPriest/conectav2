-- Conecta V2: guarded central review and immutable audit, deployed to validation Supabase.
-- NEVER auto-appoint administrators. The service role must assign trusted existing accounts.
-- Authorization is deliberately separate from ownership/moderation of communities.
create table if not exists public.platform_moderators (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 role text not null check(role in ('moderator','admin')),
 appointed_by uuid references public.profiles(id) on delete set null,
 appointed_at timestamptz not null default now()
);
alter table public.platform_moderators enable row level security;
revoke all on public.platform_moderators from public,anon,authenticated;
grant select(user_id,role) on public.platform_moderators to authenticated;
grant select,insert,update,delete on public.platform_moderators to service_role;
drop policy if exists "read own platform moderation role" on public.platform_moderators;
create policy "read own platform moderation role" on public.platform_moderators
 for select to authenticated using(user_id=(select auth.uid()));

create or replace function app_private.is_platform_moderator()
returns boolean language sql stable security definer set search_path=''
as $$
 select (select auth.uid()) is not null
 and exists(select 1 from public.platform_moderators pm
  where pm.user_id=(select auth.uid()) and pm.role in ('moderator','admin'));
$$;
revoke all on function app_private.is_platform_moderator() from public,anon,authenticated;
grant execute on function app_private.is_platform_moderator() to authenticated;

alter table public.safety_reports
 add column if not exists reported_author_id uuid references public.profiles(id) on delete set null;
create or replace function app_private.capture_safety_report_evidence()
returns trigger language plpgsql security definer set search_path='' as $$
declare body_text text;kind text;offender uuid;
begin
 if (select auth.uid()) is null or new.reporter_id is distinct from (select auth.uid()) then
   raise exception 'Autenticação necessária para denúncia' using errcode='42501';
 end if;
 if new.target_type='message' then
   select m.content,m.media_type,m.sender_id into body_text,kind,offender
    from public.messages m
    where m.id=new.target_id and m.sender_id<>new.reporter_id and m.deleted_at is null;
 elsif new.target_type='post' then
   select p.content,p.media_type,p.author_id into body_text,kind,offender
    from public.posts p where p.id=new.target_id and p.author_id<>new.reporter_id
      and p.community_id is null;
 else raise exception 'Tipo de denúncia inválido' using errcode='22023';
 end if;
 if not found then raise exception 'Conteúdo indisponível para denúncia' using errcode='23503'; end if;
 new.reported_author_id:=offender;
 new.evidence_excerpt:=left(coalesce(body_text,''),1200);
 new.evidence_media_type:=kind;
 new.status:='pending';
 new.reviewed_at:=null;
 new.reason:=btrim(new.reason);
 return new;
end; $$;
revoke all on function app_private.capture_safety_report_evidence() from public,anon,authenticated;
create index if not exists safety_reports_reported_author_idx
 on public.safety_reports(reported_author_id,created_at)
 where reported_author_id is not null;

create table if not exists public.safety_moderation_events (
 id uuid primary key default gen_random_uuid(),
 report_id uuid not null references public.safety_reports(id) on delete cascade,
 reviewer_id uuid references public.profiles(id) on delete set null,
 old_status text not null check(old_status in ('pending','reviewing','resolved','dismissed')),
 new_status text not null check(new_status in ('pending','reviewing','resolved','dismissed')),
 rationale text not null check(char_length(btrim(rationale)) between 10 and 500),
 created_at timestamptz not null default now()
);
alter table public.safety_moderation_events enable row level security;
create index if not exists safety_moderation_events_report_idx
 on public.safety_moderation_events(report_id,created_at desc);
revoke all on public.safety_moderation_events from public,anon,authenticated;
grant select,insert,update,delete on public.safety_moderation_events to service_role;

create or replace function public.get_safety_moderation_queue(
 _status text default 'open', _limit integer default 50
) returns table (
 report_id uuid,target_type text,target_id uuid,reason text,
 evidence_excerpt text,evidence_media_type text,status text,
 created_at timestamptz,reviewed_at timestamptz,
 reported_author_id uuid,reported_author_handle text,reports_against_author bigint
)
language plpgsql stable security definer set search_path=''
as $$
begin
 if not app_private.is_platform_moderator() then
   raise exception 'Acesso restrito à equipe de moderação.' using errcode='42501';
 end if;
 if _status not in ('open','all','pending','reviewing','resolved','dismissed') then
   raise exception 'Filtro inválido.' using errcode='22023';
 end if;
 return query
 select sr.id,sr.target_type,sr.target_id,sr.reason,sr.evidence_excerpt,
  sr.evidence_media_type,sr.status,sr.created_at,sr.reviewed_at,
  sr.reported_author_id,p.handle,
  (select count(*) from public.safety_reports sr2
   where sr2.reported_author_id=sr.reported_author_id
     and sr.reported_author_id is not null)::bigint
 from public.safety_reports sr
 left join public.profiles p on p.id=sr.reported_author_id
 where (_status='all' or (_status='open' and sr.status in ('pending','reviewing'))
        or sr.status=_status)
 order by case when sr.status='pending' then 0
               when sr.status='reviewing' then 1 else 2 end,sr.created_at asc
 limit least(greatest(coalesce(_limit,50),1),100);
end; $$;
revoke all on function public.get_safety_moderation_queue(text,integer)
 from public,anon,authenticated;
grant execute on function public.get_safety_moderation_queue(text,integer) to authenticated;

create or replace function public.get_safety_moderation_history(_report_id uuid)
returns table(
 id uuid,old_status text,new_status text,rationale text,
 reviewer_handle text,created_at timestamptz
)
language plpgsql stable security definer set search_path=''
as $$
begin
 if not app_private.is_platform_moderator() then
   raise exception 'Acesso restrito à equipe de moderação.' using errcode='42501';
 end if;
 return query
 select ev.id,ev.old_status,ev.new_status,ev.rationale,p.handle,ev.created_at
 from public.safety_moderation_events ev
 left join public.profiles p on p.id=ev.reviewer_id
 where ev.report_id=_report_id order by ev.created_at desc limit 100;
end; $$;
revoke all on function public.get_safety_moderation_history(uuid) from public,anon,authenticated;
grant execute on function public.get_safety_moderation_history(uuid) to authenticated;

create or replace function public.review_safety_report(
 _report_id uuid,_decision text,_rationale text default ''
)
returns void language plpgsql security definer set search_path=''
as $$
declare previous text;updated text;rationale_text text;
begin
 if not app_private.is_platform_moderator() then
   raise exception 'Acesso restrito à equipe de moderação.' using errcode='42501';
 end if;
 if _decision not in ('start_review','resolve','dismiss') then
   raise exception 'Decisão inválida.' using errcode='22023';
 end if;
 rationale_text:=btrim(coalesce(_rationale,''));
 if _decision='start_review' and length(rationale_text)<10 then
    rationale_text:='Análise iniciada pela moderação.';
 elsif length(rationale_text)<10 or length(rationale_text)>500 then
    raise exception 'Justificativa obrigatória (10 a 500 caracteres).' using errcode='22023';
 end if;
 select sr.status into previous from public.safety_reports sr
  where sr.id=_report_id for update;
 if previous is null then raise exception 'Denúncia não encontrada.' using errcode='22023'; end if;
 if previous in ('resolved','dismissed') then
   raise exception 'A denúncia já foi encerrada.' using errcode='23514';
 end if;
 if _decision='start_review' then
   if previous='reviewing' then raise exception 'Análise já iniciada.' using errcode='23514'; end if;
   updated:='reviewing';
 elsif _decision='resolve' then updated:='resolved';
 else updated:='dismissed';
 end if;
 update public.safety_reports set status=updated,reviewed_at=now() where id=_report_id;
 insert into public.safety_moderation_events(report_id,reviewer_id,old_status,new_status,rationale)
 values(_report_id,(select auth.uid()),previous,updated,rationale_text);
end; $$;
revoke all on function public.review_safety_report(uuid,text,text) from public,anon,authenticated;
grant execute on function public.review_safety_report(uuid,text,text) to authenticated;
