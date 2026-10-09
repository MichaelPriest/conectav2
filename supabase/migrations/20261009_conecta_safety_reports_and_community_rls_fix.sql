-- Conecta V2 — report intake with protected evidence and fixed community post ownership.
-- Applied to the Conecta Supabase project.
drop policy if exists "report a post in its own community" on public.community_reports;
create policy "report a post in its own community" on public.community_reports
for insert to authenticated with check (
 reporter_id=(select auth.uid())
 and exists (
   select 1 from public.posts p where p.id=post_id
    and p.community_id=community_reports.community_id
    and p.author_id<>(select auth.uid())
 )
 and not exists(select 1 from public.community_bans b
   where b.community_id=community_reports.community_id
   and b.user_id=(select auth.uid()))
);
create table if not exists public.safety_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references public.profiles(id) on delete cascade,
 target_type text not null check(target_type in ('message','post')),
 target_id uuid not null,
 reason text not null check (char_length(btrim(reason)) between 10 and 500),
 evidence_excerpt text not null default '',
 evidence_media_type text,
 status text not null default 'pending'
   check(status in ('pending','reviewing','resolved','dismissed')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 constraint unique_safety_report unique(reporter_id,target_type,target_id)
);
alter table public.safety_reports enable row level security;
create index if not exists safety_reports_queue_idx
 on public.safety_reports(status,created_at);
revoke all on table public.safety_reports from public,anon,authenticated;
grant select(id,target_type,target_id,reason,status,created_at)
 on public.safety_reports to authenticated;
grant insert(reporter_id,target_type,target_id,reason)
 on public.safety_reports to authenticated;
grant select,insert,update,delete on public.safety_reports to service_role;
create or replace function app_private.capture_safety_report_evidence()
returns trigger language plpgsql security definer set search_path='' as $$
declare content_to_record text;media_to_record text;
begin
 if (select auth.uid()) is null or new.reporter_id is distinct from (select auth.uid()) then
   raise exception 'Autenticação necessária para denúncia' using errcode='42501';
 end if;
 if new.target_type='message' then
   select m.content,m.media_type into content_to_record,media_to_record
   from public.messages m
   where m.id=new.target_id and m.sender_id<>new.reporter_id and m.deleted_at is null;
 elsif new.target_type='post' then
   select p.content,p.media_type into content_to_record,media_to_record
   from public.posts p
   where p.id=new.target_id and p.author_id<>new.reporter_id and p.community_id is null;
 else
   raise exception 'Tipo de denúncia inválido' using errcode='22023';
 end if;
 if not found then
   raise exception 'Conteúdo indisponível para denúncia' using errcode='23503';
 end if;
 new.evidence_excerpt:=left(coalesce(content_to_record,''),1200);
 new.evidence_media_type:=media_to_record;
 new.status:='pending';
 new.reviewed_at:=null;
 new.reason:=btrim(new.reason);
 return new;
end;
$$;
revoke all on function app_private.capture_safety_report_evidence()
 from public,anon,authenticated;
drop trigger if exists safety_reports_capture_evidence on public.safety_reports;
create trigger safety_reports_capture_evidence before insert on public.safety_reports
 for each row execute function app_private.capture_safety_report_evidence();
drop policy if exists "report own visible concern" on public.safety_reports;
create policy "report own visible concern" on public.safety_reports
 for insert to authenticated with check(
 reporter_id=(select auth.uid())
 and (
  (target_type='message' and exists(
    select 1 from public.messages m where m.id=target_id
     and m.sender_id<>(select auth.uid()) and m.deleted_at is null
     and app_private.is_conversation_member(m.conversation_id)))
  or (target_type='post' and exists(
    select 1 from public.posts p where p.id=target_id
     and p.author_id<>(select auth.uid()) and p.community_id is null))
 )
);
drop policy if exists "reporter sees own submission status" on public.safety_reports;
create policy "reporter sees own submission status" on public.safety_reports
 for select to authenticated using(reporter_id=(select auth.uid()));
