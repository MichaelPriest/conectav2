-- Conecta V2, applied to project opdlxxrcdsxqmlhgayfm on 2026-10-08.
-- REFERENCE FOR REBUILDING A NEW DATABASE. DO NOT re-run on the current project.
-- Requires initial schema.sql plus the existing gallery/identity migrations.
alter table public.communities alter column owner_id drop not null;
alter table public.communities add column if not exists is_official boolean not null default false;
alter table public.communities add constraint communities_official_owner_ck
 check ((is_official and owner_id is null) or (not is_official and owner_id is not null));
drop policy if exists "community creation" on public.communities;
create policy "community creation" on public.communities
 for insert to authenticated with check (owner_id=(select auth.uid()) and not is_official);
drop policy if exists "owner edits community" on public.communities;
create policy "owner edits community" on public.communities
 for update to authenticated using (owner_id=(select auth.uid()) and not is_official)
 with check (owner_id=(select auth.uid()) and not is_official);

insert into public.communities(owner_id,is_official,slug,name,description) values
(null,true,'musica-playlists','Música & Playlists','Compartilhe descobertas, playlists e artistas com outros apaixonados por música.'),
(null,true,'fotografia','Fotografia','Fotos autorais, técnicas, celulares e histórias por trás de cada clique.'),
(null,true,'games','Games & Jogadores','Jogos, conquistas, lançamentos, nostalgia e amizades gamer.'),
(null,true,'tecnologia-ia','Tecnologia & IA','Inovações, aplicativos, desenvolvimento e inteligência artificial.'),
(null,true,'arte-criatividade','Arte & Criatividade','Ilustração, desenho, design, artesanato e processos criativos.'),
(null,true,'livros-historias','Livros & Histórias','Clubes de leitura, livros favoritos, HQs e novas narrativas.'),
(null,true,'cinema-series','Cinema & Séries','Filmes, séries, críticas e recomendações sem spoilers.'),
(null,true,'viagens-cultura','Viagens & Cultura','Destinos, fotografia de viagem, cultura e boas experiências.'),
(null,true,'esportes-movimento','Esportes & Movimento','Esportes, torneios e atividades físicas de forma respeitosa.'),
(null,true,'comunidade-conecta','Comunidade Conecta','Novidades oficiais do Conecta, feedback, ideias e boas-vindas.')
on conflict(slug) do nothing;

create table public.profile_details(
 user_id uuid primary key references public.profiles(id) on delete cascade,
 headline text not null default '' check(char_length(headline)<=120),
 city text not null default '' check(char_length(city)<=80),
 website text check(website is null or char_length(website)<=512),
 music_url text check(music_url is null or char_length(music_url)<=512),
 interests text[] not null default '{}' check(coalesce(array_length(interests,1),0)<=12),
 favorite_emoji text not null default '💜' check(char_length(favorite_emoji)<=16),
 cover_theme text not null default 'violet' check(cover_theme in('violet','aqua','pink','sunset','midnight')),
 updated_at timestamptz not null default now()
);
alter table public.profile_details enable row level security;
grant select,insert,update on public.profile_details to authenticated;
create policy "profile details visible" on public.profile_details for select to authenticated using(true);
create policy "profile details insert own" on public.profile_details for insert to authenticated with check(user_id=(select auth.uid()));
create policy "profile details edit own" on public.profile_details for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table public.user_blocks(
 blocker_id uuid not null references public.profiles(id) on delete cascade,
 blocked_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(blocker_id,blocked_id),check(blocker_id<>blocked_id)
);
create index user_blocks_blocked_id_idx on public.user_blocks(blocked_id);
alter table public.user_blocks enable row level security;
grant select,insert,delete on public.user_blocks to authenticated;
create policy "manage blocks read" on public.user_blocks for select to authenticated
 using(blocker_id=(select auth.uid()) or blocked_id=(select auth.uid()));
create policy "manage blocks insert" on public.user_blocks for insert to authenticated
 with check(blocker_id=(select auth.uid()));
create policy "manage blocks delete" on public.user_blocks for delete to authenticated
 using(blocker_id=(select auth.uid()));

drop policy if exists "creator adds members" on public.conversation_members;
create policy "creator adds members" on public.conversation_members
 for insert to authenticated with check(
 exists(select 1 from public.conversations c where c.id=conversation_id and c.created_by=(select auth.uid()))
 and (
  user_id=(select auth.uid())
  or exists(select 1 from public.friendships f where f.status='accepted' and
   ((f.requester_id=(select auth.uid()) and f.addressee_id=user_id)
    or(f.addressee_id=(select auth.uid()) and f.requester_id=user_id)))
 )
 and not exists(select 1 from public.user_blocks b where
  (b.blocker_id=(select auth.uid()) and b.blocked_id=user_id)
  or(b.blocker_id=user_id and b.blocked_id=(select auth.uid())))
);
drop policy if exists "send to joined conversation" on public.messages;
create policy "send to joined conversation" on public.messages
 for insert to authenticated with check(
 sender_id=(select auth.uid())
 and exists(select 1 from public.conversation_members cm
  where cm.conversation_id=messages.conversation_id and cm.user_id=(select auth.uid()))
 and not exists(select 1 from public.conversation_members other
  join public.user_blocks b on
    ((b.blocker_id=(select auth.uid()) and b.blocked_id=other.user_id)
     or(b.blocker_id=other.user_id and b.blocked_id=(select auth.uid())))
  where other.conversation_id=messages.conversation_id and other.user_id<>(select auth.uid()))
);
create or replace function app_private.is_conversation_member(target_conversation uuid)
returns boolean language sql stable security definer set search_path=''
as $fn$
 select exists(select 1 from public.conversation_members cm where cm.conversation_id=target_conversation and cm.user_id=(select auth.uid()));
$fn$;
revoke all on function app_private.is_conversation_member(uuid) from public,anon,authenticated;
grant usage on schema app_private to authenticated;
grant execute on function app_private.is_conversation_member(uuid) to authenticated;
drop policy if exists "read own membership" on public.conversation_members;
create policy "read own membership" on public.conversation_members
 for select to authenticated using(user_id=(select auth.uid()) or app_private.is_conversation_member(conversation_id));

do $$
begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
  alter publication supabase_realtime add table public.messages;
 end if;
end $$;

alter table public.profiles add constraint profile_avatar_own_folder_ck
 check(avatar_path is null or avatar_path like id::text||'/avatars/%');
drop policy if exists "media read by owner or visible post" on storage.objects;
create policy "media read by owner or visible post" on storage.objects for select to authenticated
using(bucket_id='social-media' and(
 (storage.foldername(name))[1]=(select auth.uid())::text
 or exists(select 1 from public.posts p where p.media_path=name)
 or exists(select 1 from public.post_media m where m.storage_path=name)
 or exists(select 1 from public.profiles p where p.avatar_path=name)
));

-- Applied after initial community/chat changes: prevent friendship invitations across blocks.
drop policy if exists "requester sends friend request" on public.friendships;
create policy "requester sends friend request" on public.friendships for insert to authenticated
 with check(requester_id=(select auth.uid()) and status='pending'
  and not exists(select 1 from public.user_blocks b where
    (b.blocker_id=requester_id and b.blocked_id=addressee_id)
    or(b.blocker_id=addressee_id and b.blocked_id=requester_id))
 );
drop policy if exists "recipient responds to request" on public.friendships;
create policy "recipient responds to request" on public.friendships for update to authenticated
 using(addressee_id=(select auth.uid()) and status='pending')
 with check(addressee_id=(select auth.uid()) and status in('accepted','declined')
  and not exists(select 1 from public.user_blocks b where
    (b.blocker_id=requester_id and b.blocked_id=addressee_id)
    or(b.blocker_id=addressee_id and b.blocked_id=requester_id))
 );
