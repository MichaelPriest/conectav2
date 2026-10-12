-- A Story can only be reported by a person who is currently allowed to view it.
-- Keep the rule in both the INSERT policy and the SECURITY DEFINER evidence trigger.
create or replace function app_private.capture_safety_report_evidence()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  content_to_record text;
  media_to_record text;
  offender uuid;
begin
  if (select auth.uid()) is null
     or new.reporter_id is distinct from (select auth.uid()) then
    raise exception 'Autenticação necessária para denúncia' using errcode='42501';
  end if;

  if new.target_type='message' then
    select m.content,m.media_type,m.sender_id
      into content_to_record,media_to_record,offender
    from public.messages m
    where m.id=new.target_id
      and m.sender_id<>new.reporter_id
      and m.deleted_at is null
      and app_private.is_conversation_member(m.conversation_id);
  elsif new.target_type='post' then
    select p.content,p.media_type,p.author_id
      into content_to_record,media_to_record,offender
    from public.posts p
    where p.id=new.target_id
      and p.author_id<>new.reporter_id
      and p.community_id is null
      and p.moderation_status='approved'
      and exists (
        select 1 from public.registration_age_declarations a
        where a.user_id=new.reporter_id and a.declared_band='18_plus'
      )
      and not exists (
        select 1 from public.teen_safety_preferences y
        where y.user_id=new.reporter_id and y.mode='youth_protection'
      )
      and not exists (
        select 1 from public.user_blocks b
        where (b.blocker_id=p.author_id and b.blocked_id=new.reporter_id)
           or (b.blocker_id=new.reporter_id and b.blocked_id=p.author_id)
      )
      and (
        p.visibility='public'
        or (
          p.visibility='friends'
          and exists (
            select 1 from public.friendships f
            where f.status='accepted'
              and (
                (f.requester_id=p.author_id and f.addressee_id=new.reporter_id)
                or (f.addressee_id=p.author_id and f.requester_id=new.reporter_id)
              )
          )
        )
      );
  elsif new.target_type='story' then
    select s.caption,s.media_type,s.author_id
      into content_to_record,media_to_record,offender
    from public.stories s
    where s.id=new.target_id
      and s.author_id<>new.reporter_id
      and s.moderation_status='approved'
      and s.expires_at>now()
      and exists (
        select 1 from public.registration_age_declarations a
        where a.user_id=new.reporter_id and a.declared_band='18_plus'
      )
      and not exists (
        select 1 from public.teen_safety_preferences y
        where y.user_id=new.reporter_id and y.mode='youth_protection'
      )
      and not exists (
        select 1 from public.user_blocks b
        where (b.blocker_id=s.author_id and b.blocked_id=new.reporter_id)
           or (b.blocker_id=new.reporter_id and b.blocked_id=s.author_id)
      )
      and (
        s.visibility='public'
        or (
          s.visibility='friends'
          and exists (
            select 1 from public.friendships f
            where f.status='accepted'
              and (
                (f.requester_id=s.author_id and f.addressee_id=new.reporter_id)
                or (f.addressee_id=s.author_id and f.requester_id=new.reporter_id)
              )
          )
        )
      );
  else
    raise exception 'Tipo de denúncia inválido' using errcode='22023';
  end if;

  if not found then
    raise exception 'Conteúdo indisponível para denúncia' using errcode='23503';
  end if;

  new.reported_author_id:=offender;
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

drop policy if exists "report own visible concern" on public.safety_reports;
create policy "report own visible concern" on public.safety_reports
for insert to authenticated
with check (
  reporter_id=(select auth.uid())
  and (
    (
      target_type='message'
      and exists (
        select 1 from public.messages m
        where m.id=target_id
          and m.sender_id<>(select auth.uid())
          and m.deleted_at is null
          and app_private.is_conversation_member(m.conversation_id)
      )
    )
    or (
      target_type='post'
      and exists (
        select 1 from public.posts p
        where p.id=target_id
          and p.author_id<>(select auth.uid())
          and p.community_id is null
          and p.moderation_status='approved'
          and exists (
            select 1 from public.registration_age_declarations a
            where a.user_id=(select auth.uid()) and a.declared_band='18_plus'
          )
          and not exists (
            select 1 from public.teen_safety_preferences y
            where y.user_id=(select auth.uid()) and y.mode='youth_protection'
          )
          and not exists (
            select 1 from public.user_blocks b
            where (b.blocker_id=p.author_id and b.blocked_id=(select auth.uid()))
               or (b.blocker_id=(select auth.uid()) and b.blocked_id=p.author_id)
          )
          and (
            p.visibility='public'
            or (
              p.visibility='friends'
              and exists (
                select 1 from public.friendships f
                where f.status='accepted'
                  and (
                    (f.requester_id=p.author_id and f.addressee_id=(select auth.uid()))
                    or (f.addressee_id=p.author_id and f.requester_id=(select auth.uid()))
                  )
              )
            )
          )
      )
    )
    or (
      target_type='story'
      and exists (
        select 1 from public.stories s
        where s.id=target_id
          and s.author_id<>(select auth.uid())
          and s.moderation_status='approved'
          and s.expires_at>now()
          and exists (
            select 1 from public.registration_age_declarations a
            where a.user_id=(select auth.uid()) and a.declared_band='18_plus'
          )
          and not exists (
            select 1 from public.teen_safety_preferences y
            where y.user_id=(select auth.uid()) and y.mode='youth_protection'
          )
          and not exists (
            select 1 from public.user_blocks b
            where (b.blocker_id=s.author_id and b.blocked_id=(select auth.uid()))
               or (b.blocker_id=(select auth.uid()) and b.blocked_id=s.author_id)
          )
          and (
            s.visibility='public'
            or (
              s.visibility='friends'
              and exists (
                select 1 from public.friendships f
                where f.status='accepted'
                  and (
                    (f.requester_id=s.author_id and f.addressee_id=(select auth.uid()))
                    or (f.addressee_id=s.author_id and f.requester_id=(select auth.uid()))
                  )
              )
            )
          )
      )
    )
  )
);
