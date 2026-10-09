-- Source: applied Supabase migration 20261009031112.
-- Held public feed posts and stories are reviewed only by trusted platform moderators.
create table if not exists public.content_moderation_events (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('post','story')),
 content_id uuid not null,
 reviewer_id uuid references public.profiles(id) on delete set null,
 decision text not null check(decision in ('approve','reject')),
 rationale text not null check(length(btrim(rationale)) between 10 and 500),
 created_at timestamptz not null default now()
);
alter table public.content_moderation_events enable row level security;
revoke all on public.content_moderation_events from public,anon,authenticated;
grant select,insert,update,delete on public.content_moderation_events to service_role;
create index if not exists content_moderation_events_queue_idx
 on public.content_moderation_events(kind,content_id,created_at);

create or replace function public.get_pending_public_content(_limit integer default 50)
returns table (
 id uuid, kind text, author_handle text, content_excerpt text, 
 media_type text, created_at timestamptz, ai_provider text
)
language plpgsql stable security definer set search_path=''
as $$
begin
 if not app_private.is_platform_moderator() then
  raise exception 'Equipe autorizada necessária' using errcode='42501';
 end if;
 return query
 select x.id,x.kind,p.handle,x.body,x.media,x.created_at,x.provider
 from (
   select posts.id,'post'::text as kind, left(posts.content,1000) as body,
     posts.media_type::text as media,posts.created_at,posts.ai_provider as provider,
     posts.author_id
   from public.posts posts
   where posts.community_id is null and posts.moderation_status='pending'
   union all
   select st.id,'story'::text as kind,left(st.caption,1000) as body,
     st.media_type::text as media,st.created_at,null::text as provider,
     st.author_id
   from public.stories st
   where st.moderation_status='pending' and st.expires_at>now()
 ) x left join public.profiles p on p.id=x.author_id
 order by x.created_at asc
 limit least(greatest(coalesce(_limit,50),1),100);
end;
$$;
revoke all on function public.get_pending_public_content(integer) from public,anon,authenticated;
grant execute on function public.get_pending_public_content(integer) to authenticated;

create or replace function public.review_pending_public_content(
 _kind text,_id uuid,_decision text,_rationale text
)
returns void language plpgsql security definer set search_path=''
as $$
declare state text; explanation text;
begin
 if not app_private.is_platform_moderator() then
  raise exception 'Equipe autorizada necessária' using errcode='42501';
 end if;
 if _kind not in ('post','story') or _decision not in ('approve','reject') then
  raise exception 'Parâmetros não suportados' using errcode='22023';
 end if;
 explanation:=btrim(coalesce(_rationale,''));
 if char_length(explanation) not between 10 and 500 then
  raise exception 'Justificativa deve ter 10 a 500 caracteres' using errcode='22023';
 end if;
 if _kind='post' then
   select p.moderation_status into state from public.posts p
    where p.id=_id and p.community_id is null for update;
 elsif _kind='story' then
   select s.moderation_status into state from public.stories s
    where s.id=_id and s.expires_at>now() for update;
 end if;
 if state is null then raise exception 'Conteúdo não encontrado' using errcode='22023'; end if;
 if state<>'pending' then raise exception 'O conteúdo já foi revisado' using errcode='23514'; end if;
 if _kind='post' then
   update public.posts set
    moderation_status=case when _decision='approve' then 'approved' else 'rejected' end,
    moderation_reason=explanation,moderated_by=(select auth.uid()),moderated_at=now()
   where id=_id;
 else
   update public.stories set
    moderation_status=case when _decision='approve' then 'approved' else 'rejected' end
   where id=_id;
 end if;
 insert into public.content_moderation_events(kind,content_id,reviewer_id,decision,rationale)
  values(_kind,_id,(select auth.uid()),_decision,explanation);
end;
$$;
revoke all on function public.review_pending_public_content(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.review_pending_public_content(text,uuid,text,text) to authenticated;

