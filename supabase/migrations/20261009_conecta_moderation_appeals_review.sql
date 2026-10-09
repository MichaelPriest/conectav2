-- Conecta moderation appeals. No client-controlled status or moderator privileges.
create table if not exists public.moderation_appeals(
 id uuid primary key default gen_random_uuid(),
 target_type text not null check(target_type in ('post','comment','story')),
 target_id uuid not null,
 appellant_id uuid not null references public.profiles(id) on delete cascade,
 appeal_reason text not null check(char_length(btrim(appeal_reason)) between 20 and 1000),
 original_reason text not null default '',
 status text not null default 'pending' check(status in ('pending','upheld','overturned')),
 decision_reason text,
 reviewed_by uuid references public.profiles(id) on delete set null,
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(target_type,target_id,appellant_id)
);
create index if not exists moderation_appeals_status_idx on public.moderation_appeals(status,created_at);
alter table public.moderation_appeals enable row level security;
revoke all on public.moderation_appeals from public,anon,authenticated;
grant select on public.moderation_appeals to authenticated;
grant all on public.moderation_appeals to service_role;
drop policy if exists "appeal visible only to applicant" on public.moderation_appeals;
create policy "appeal visible only to applicant" on public.moderation_appeals for select to authenticated
 using(appellant_id=(select auth.uid()));

create or replace function public.submit_moderation_appeal(_kind text,_target_id uuid,_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid;current_status text;original text;appeal_id uuid;
begin
 if (select auth.uid()) is null then raise exception 'Entre na sua conta.' using errcode='42501'; end if;
 if _kind not in ('post','comment','story') or _target_id is null
    or char_length(btrim(coalesce(_reason,''))) not between 20 and 1000 then
   raise exception 'Informe o conteúdo e uma justificativa entre 20 e 1000 caracteres.' using errcode='22023';
 end if;
 if _kind='post' then
   select p.author_id,p.moderation_status,p.moderation_reason
     into owner_id,current_status,original
     from public.posts p where p.id=_target_id and p.community_id is null for update;
 elsif _kind='comment' then
   select c.author_id,c.moderation_status,c.moderation_reason
     into owner_id,current_status,original
     from public.post_comments c where c.id=_target_id for update;
 else
   select s.author_id,s.moderation_status,'Story rejeitado'
     into owner_id,current_status,original
     from public.stories s where s.id=_target_id and s.expires_at>now() for update;
 end if;
 if owner_id is null or owner_id<>(select auth.uid()) then
   raise exception 'Você só pode recorrer de conteúdo próprio.' using errcode='42501';
 end if;
 if current_status<>'rejected' then
   raise exception 'Somente conteúdo rejeitado aceita contestação.' using errcode='23514';
 end if;
 insert into public.moderation_appeals(target_type,target_id,appellant_id,appeal_reason,original_reason)
 values(_kind,_target_id,(select auth.uid()),btrim(_reason),left(coalesce(original,''),500))
 on conflict(target_type,target_id,appellant_id) do nothing returning id into appeal_id;
 if appeal_id is null then raise exception 'Já existe uma contestação para este conteúdo.' using errcode='23505'; end if;
 return appeal_id;
end;$$;
revoke all on function public.submit_moderation_appeal(text,uuid,text) from public,anon,authenticated;
grant execute on function public.submit_moderation_appeal(text,uuid,text) to authenticated;

create or replace function public.get_moderation_appeals(_status text default 'pending',_limit integer default 50)
returns table(id uuid,target_type text,target_id uuid,appellant_handle text,
 appeal_reason text,original_reason text,content_excerpt text,status text,
 decision_reason text,created_at timestamptz,reviewed_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not app_private.is_platform_moderator() then raise exception 'Somente equipe autorizada.' using errcode='42501'; end if;
 if _status not in ('pending','upheld','overturned','all') then
   raise exception 'Filtro inválido.' using errcode='22023';
 end if;
 return query select a.id,a.target_type,a.target_id,p.handle,a.appeal_reason,a.original_reason,
   left(case a.target_type
     when 'post' then (select x.content from public.posts x where x.id=a.target_id and x.community_id is null)
     when 'comment' then (select x.body from public.post_comments x where x.id=a.target_id)
     when 'story' then (select x.caption from public.stories x where x.id=a.target_id)
     else null end,800),
   a.status,a.decision_reason,a.created_at,a.reviewed_at
 from public.moderation_appeals a
 left join public.profiles p on p.id=a.appellant_id
 where (_status='all' or a.status=_status)
 order by case when a.status='pending' then 0 else 1 end,a.created_at asc
 limit least(greatest(coalesce(_limit,50),1),100);
end;$$;
revoke all on function public.get_moderation_appeals(text,integer) from public,anon,authenticated;
grant execute on function public.get_moderation_appeals(text,integer) to authenticated;

create or replace function public.review_moderation_appeal(
 _appeal_id uuid,_decision text,_reason text
) returns void language plpgsql security definer set search_path='' as $$
declare r public.moderation_appeals%rowtype; owner_id uuid;state text;original_reviewer uuid;
  why text;
begin
 if not app_private.is_platform_moderator() then raise exception 'Acesso restrito à equipe.' using errcode='42501'; end if;
 if _decision not in ('uphold','overturn')
   or char_length(btrim(coalesce(_reason,''))) not between 20 and 500 then
   raise exception 'Decisão e fundamentação entre 20 e 500 caracteres são obrigatórias.' using errcode='22023';
 end if;
 select * into r from public.moderation_appeals where id=_appeal_id for update;
 if r.id is null then raise exception 'Contestação não encontrada.' using errcode='22023'; end if;
 if r.status<>'pending' then raise exception 'Contestação já analisada.' using errcode='23514'; end if;
 if r.appellant_id=(select auth.uid()) then
   raise exception 'Não é permitido julgar a própria contestação.' using errcode='42501';
 end if;
 if r.target_type='post' then
   select p.author_id,p.moderation_status,p.moderated_by
     into owner_id,state,original_reviewer from public.posts p
     where p.id=r.target_id and p.community_id is null for update;
 elsif r.target_type='comment' then
   select c.author_id,c.moderation_status into owner_id,state
     from public.post_comments c where c.id=r.target_id for update;
   select e.reviewer_id into original_reviewer from public.comment_moderation_events e
     where e.comment_id=r.target_id and e.decision='reject'
     order by e.created_at desc limit 1;
 else
   select s.author_id,s.moderation_status into owner_id,state
     from public.stories s where s.id=r.target_id and s.expires_at>now() for update;
   select e.reviewer_id into original_reviewer from public.content_moderation_events e
     where e.kind='story' and e.content_id=r.target_id and e.decision='reject'
     order by e.created_at desc limit 1;
 end if;
 if owner_id is distinct from r.appellant_id or state is distinct from 'rejected' then
   raise exception 'O conteúdo foi excluído ou sua situação mudou; revisão manual necessária.' using errcode='23514';
 end if;
 if original_reviewer is not null and original_reviewer=(select auth.uid()) then
   raise exception 'A segunda análise deve ser feita por outro moderador.' using errcode='42501';
 end if;
 why:=btrim(_reason);
 if _decision='overturn' then
   if r.target_type='post' then
     update public.posts set moderation_status='approved',moderation_reason=why,
       moderated_by=(select auth.uid()),moderated_at=now() where id=r.target_id;
   elsif r.target_type='comment' then
     update public.post_comments set moderation_status='approved',
       moderation_reason=why where id=r.target_id;
   else
     update public.stories set moderation_status='approved' where id=r.target_id;
   end if;
 end if;
 update public.moderation_appeals set
   status=case when _decision='overturn' then 'overturned' else 'upheld' end,
   decision_reason=why,reviewed_by=(select auth.uid()),reviewed_at=now()
 where id=r.id;
end;$$;
revoke all on function public.review_moderation_appeal(uuid,text,text) from public,anon,authenticated;
grant execute on function public.review_moderation_appeal(uuid,text,text) to authenticated;
