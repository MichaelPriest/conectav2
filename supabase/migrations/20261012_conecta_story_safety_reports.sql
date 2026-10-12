-- Extend authenticated safety reports to active, approved Stories only.
alter table public.safety_reports drop constraint if exists safety_reports_target_type_check;
alter table public.safety_reports add constraint safety_reports_target_type_check check (target_type in ('message','post','story'));
create or replace function app_private.capture_safety_report_evidence()
returns trigger language plpgsql security definer set search_path='' as $$
declare content_to_record text;media_to_record text;
begin
 if (select auth.uid()) is null or new.reporter_id is distinct from (select auth.uid()) then
   raise exception 'Autenticação necessária para denúncia' using errcode='42501';
 end if;
 if new.target_type='message' then
   select m.content,m.media_type into content_to_record,media_to_record from public.messages m where m.id=new.target_id and m.sender_id<>new.reporter_id and m.deleted_at is null;
 elsif new.target_type='post' then
   select p.content,p.media_type into content_to_record,media_to_record from public.posts p where p.id=new.target_id and p.author_id<>new.reporter_id and p.community_id is null;
 elsif new.target_type='story' then
   select s.caption,s.media_type into content_to_record,media_to_record from public.stories s where s.id=new.target_id and s.author_id<>new.reporter_id and s.moderation_status='approved' and s.expires_at>now();
 else
   raise exception 'Tipo de denúncia inválido' using errcode='22023';
 end if;
 if not found then raise exception 'Conteúdo indisponível para denúncia' using errcode='23503'; end if;
 new.evidence_excerpt:=left(coalesce(content_to_record,''),1200);
 new.evidence_media_type:=media_to_record;
 new.status:='pending'; new.reviewed_at:=null; new.reason:=btrim(new.reason);
 return new;
end; $$;
revoke all on function app_private.capture_safety_report_evidence() from public,anon,authenticated;
drop policy if exists "report own visible concern" on public.safety_reports;
create policy "report own visible concern" on public.safety_reports for insert to authenticated with check (
 reporter_id=(select auth.uid()) and (
  (target_type='message' and exists(select 1 from public.messages m where m.id=target_id and m.sender_id<>(select auth.uid()) and m.deleted_at is null and app_private.is_conversation_member(m.conversation_id)))
  or (target_type='post' and exists(select 1 from public.posts p where p.id=target_id and p.author_id<>(select auth.uid()) and p.community_id is null))
  or (target_type='story' and exists(select 1 from public.stories s where s.id=target_id and s.author_id<>(select auth.uid()) and s.moderation_status='approved' and s.expires_at>now()))
 ));