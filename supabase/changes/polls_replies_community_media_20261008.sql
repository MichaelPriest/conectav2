-- Conecta V2 migration: threaded comments, polls, saved posts, community images.
-- Applied 2026-10-08 to Supabase Conecta project.
-- Run AFTER base schema, post_media gallery and existing profile/social migrations.
-- Do not re-run blindly on production: applied DDL may need migration reconciliation.

alter table public.post_comments
 add column if not exists parent_id uuid references public.post_comments(id) on delete set null;
create index if not exists post_comments_parent_idx on public.post_comments(parent_id,created_at);
create or replace function app_private.comment_parent_guard()
returns trigger language plpgsql set search_path='' as $$
declare parent_post uuid; grandparent uuid;
begin
 if new.parent_id is null then return new; end if;
 select p.post_id,p.parent_id into parent_post,grandparent
 from public.post_comments p where p.id=new.parent_id;
 if parent_post is distinct from new.post_id or grandparent is not null then
  raise exception 'Reply must belong to a root comment of the same post';
 end if;
 return new;
end $$;
drop trigger if exists comment_parent_guard on public.post_comments;
create trigger comment_parent_guard before insert or update of parent_id,post_id
 on public.post_comments for each row execute function app_private.comment_parent_guard();

create table if not exists public.post_polls(
 post_id uuid primary key references public.posts(id) on delete cascade,
 question text not null check(char_length(trim(question)) between 5 and 250),
 closes_at timestamptz not null default (now()+interval '7 days'),
 created_at timestamptz not null default now()
);
create table if not exists public.post_poll_options(
 id uuid primary key default gen_random_uuid(),
 poll_id uuid not null references public.post_polls(post_id) on delete cascade,
 label text not null check(char_length(trim(label)) between 1 and 120),
 position smallint not null check(position between 0 and 5),
 unique(poll_id,position),unique(id,poll_id)
);
create index if not exists post_poll_options_poll_idx on public.post_poll_options(poll_id);
create table if not exists public.post_poll_votes(
 poll_id uuid not null references public.post_polls(post_id) on delete cascade,
 option_id uuid not null,
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(poll_id,user_id),
 foreign key(option_id,poll_id) references public.post_poll_options(id,poll_id) on delete cascade
);
create index if not exists post_poll_votes_option_idx on public.post_poll_votes(option_id);
alter table public.post_polls enable row level security;
alter table public.post_poll_options enable row level security;
alter table public.post_poll_votes enable row level security;
grant select,insert on public.post_polls to authenticated;
grant select,insert on public.post_poll_options to authenticated;
grant select,insert on public.post_poll_votes to authenticated;
create policy "polls readable for visible posts" on public.post_polls for select to authenticated
 using(exists(select 1 from public.posts p where p.id=post_id));
create policy "authors create own polls" on public.post_polls for insert to authenticated
 with check(exists(select 1 from public.posts p where p.id=post_id and p.author_id=(select auth.uid()))
 and closes_at>now() and closes_at<=now()+interval '31 days');
create policy "options for visible polls" on public.post_poll_options for select to authenticated
 using(exists(select 1 from public.post_polls p where p.post_id=poll_id));
create policy "post author creates options" on public.post_poll_options for insert to authenticated
 with check(exists(select 1 from public.post_polls pp join public.posts p on p.id=pp.post_id
 where pp.post_id=poll_id and p.author_id=(select auth.uid()) and pp.closes_at>now()
 and not exists(select 1 from public.post_poll_votes v where v.poll_id=pp.post_id)));
create policy "votes readable for visible polls" on public.post_poll_votes for select to authenticated
 using(exists(select 1 from public.post_polls pp where pp.post_id=poll_id));
create policy "cast one vote on visible open poll" on public.post_poll_votes for insert to authenticated
 with check(user_id=(select auth.uid())
 and exists(select 1 from public.post_polls pp where pp.post_id=poll_id and pp.closes_at>now())
 and (select count(*) from public.post_poll_options opt where opt.poll_id=poll_id)>=2);

create table if not exists public.saved_posts(
 user_id uuid not null references public.profiles(id) on delete cascade,
 post_id uuid not null references public.posts(id) on delete cascade,
 created_at timestamptz not null default now(),primary key(user_id,post_id)
);
create index if not exists saved_posts_post_idx on public.saved_posts(post_id);
alter table public.saved_posts enable row level security;
grant select,insert,delete on public.saved_posts to authenticated;
create policy "read own saved posts" on public.saved_posts for select to authenticated
 using(user_id=(select auth.uid()) and exists(select 1 from public.posts p where p.id=post_id));
create policy "save accessible posts" on public.saved_posts for insert to authenticated
 with check(user_id=(select auth.uid()) and exists(select 1 from public.posts p where p.id=post_id));
create policy "unsave own post" on public.saved_posts for delete to authenticated
 using(user_id=(select auth.uid()));

alter table public.communities add column if not exists cover_path text;
alter table public.communities add column if not exists avatar_path text;
alter table public.communities add column if not exists rules text not null default '';
alter table public.communities add constraint community_media_owner_prefix
 check ((cover_path is null or (owner_id is not null and cover_path like owner_id::text||'/community/%'))
 and (avatar_path is null or (owner_id is not null and avatar_path like owner_id::text||'/community/%')));
alter table public.communities add constraint community_rules_length check(char_length(rules)<=3000);

drop policy if exists "media read by owner or visible post" on storage.objects;
create policy "media read by owner or visible post" on storage.objects for select to authenticated using(
 bucket_id='social-media' and (
 (storage.foldername(name))[1]=(select auth.uid())::text
 or exists(select 1 from public.posts p where p.media_path=name)
 or exists(select 1 from public.post_media m where m.storage_path=name)
 or exists(select 1 from public.profiles p where p.avatar_path=name)
 or exists(select 1 from public.communities c where c.cover_path=name or c.avatar_path=name)
 ));
