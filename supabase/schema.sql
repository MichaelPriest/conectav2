-- Conecta V2: banco NOVO, sem importação do Firebase.
-- Executar em um projeto Supabase dedicado. RLS obrigatório em todas as tabelas públicas.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null check (char_length(display_name) between 2 and 80),
  bio text not null default '' check (char_length(bio) <= 300),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint no_self_friendship check (requester_id <> addressee_id)
);
create unique index friendships_pair_unique on public.friendships
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_requester_idx on public.friendships(requester_id, status);
create index friendships_addressee_idx on public.friendships(addressee_id, status);

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  name text not null check (char_length(name) between 3 and 100),
  description text not null default '' check (char_length(description) <= 2000),
  created_at timestamptz not null default now()
);
create table public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(community_id, user_id)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  content text not null default '' check (char_length(content) <= 3000),
  visibility text not null default 'public' check (visibility in ('public','friends','private')),
  media_path text,
  media_type text check (media_type in ('image','video')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_nonempty check (char_length(trim(content)) > 0 or media_path is not null),
  constraint media_consistent check ((media_path is null) = (media_type is null))
);
create index posts_feed_idx on public.posts(created_at desc, id desc);
create index posts_author_feed_idx on public.posts(author_id, created_at desc);
create index posts_community_idx on public.posts(community_id, created_at desc);

create table public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_likes_user_idx on public.post_likes(user_id, created_at desc);

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index post_comments_post_idx on public.post_comments(post_id, created_at);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);
create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members(user_id);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index messages_thread_idx on public.messages(conversation_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('like','comment','friend_request','friend_accept','community')),
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_inbox_idx on public.notifications(recipient_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

create policy "profiles readable" on public.profiles
  for select to authenticated using (true);
create policy "profile owner creates" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profile owner edits" on public.profiles
  for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "friendships visible to participants" on public.friendships
  for select to authenticated
  using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));
create policy "requester sends friend request" on public.friendships
  for insert to authenticated with check (
    requester_id = (select auth.uid()) and status = 'pending'
  );
create policy "recipient responds to request" on public.friendships
  for update to authenticated using (addressee_id = (select auth.uid()) and status = 'pending')
  with check (addressee_id = (select auth.uid()) and status in ('accepted','declined'));
create policy "participant removes connection" on public.friendships
  for delete to authenticated
  using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));
-- Impede troca de IDs dos envolvidos durante a aprovação.
revoke update on public.friendships from anon, authenticated;
grant update(status) on public.friendships to authenticated;

create policy "communities listed" on public.communities
  for select to authenticated using (true);
create policy "community creation" on public.communities
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owner edits community" on public.communities
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "owner deletes community" on public.communities
  for delete to authenticated using (owner_id = (select auth.uid()));
create policy "members readable" on public.community_members
  for select to authenticated using (true);
create policy "join community" on public.community_members
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "leave community" on public.community_members
  for delete to authenticated using (user_id = (select auth.uid()));

-- Privacidade é aplicada NO BANCO, não apenas no filtro visual do feed.
create policy "read posts by privacy" on public.posts
  for select to authenticated using (
    author_id = (select auth.uid())
    or visibility = 'public'
    or (
      visibility = 'friends'
      and exists (
        select 1 from public.friendships f
        where f.status = 'accepted' and (
          (f.requester_id = author_id and f.addressee_id = (select auth.uid()))
          or (f.addressee_id = author_id and f.requester_id = (select auth.uid()))
        )
      )
    )
  );
create policy "write own post" on public.posts
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and (media_path is null or media_path like (select auth.uid())::text || '/%')
    and (community_id is null or exists (
      select 1 from public.community_members cm
      where cm.community_id = posts.community_id and cm.user_id = (select auth.uid())
    ))
  );
create policy "edit own post" on public.posts
  for update to authenticated using (author_id = (select auth.uid()))
  with check (
    author_id = (select auth.uid())
    and (media_path is null or media_path like (select auth.uid())::text || '/%')
  );
create policy "delete own post" on public.posts
  for delete to authenticated using (author_id = (select auth.uid()));

create policy "likes readable for visible posts" on public.post_likes
  for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy "like visible post" on public.post_likes
  for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.posts p where p.id = post_id
  ));
create policy "unlike own" on public.post_likes
  for delete to authenticated using (user_id = (select auth.uid()));
create policy "comments readable for visible posts" on public.post_comments
  for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy "comment on visible post" on public.post_comments
  for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (
    select 1 from public.posts p where p.id = post_id
  ));
create policy "delete own comment" on public.post_comments
  for delete to authenticated using (author_id = (select auth.uid()));

-- Conversas: acesso somente aos participantes, sem políticas recursivas.
create policy "read own conversations" on public.conversations
  for select to authenticated using (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = id and cm.user_id = (select auth.uid())
    )
  );
create policy "start conversation" on public.conversations
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "read own membership" on public.conversation_members
  for select to authenticated using (user_id = (select auth.uid()));
create policy "creator adds members" on public.conversation_members
  for insert to authenticated with check (
    exists (select 1 from public.conversations c
      where c.id = conversation_id and c.created_by = (select auth.uid()))
  );
create policy "member leaves" on public.conversation_members
  for delete to authenticated using (user_id = (select auth.uid()));
create policy "read conversation messages" on public.messages
  for select to authenticated using (exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id and cm.user_id = (select auth.uid())
  ));
create policy "send to joined conversation" on public.messages
  for insert to authenticated with check (
    sender_id = (select auth.uid())
    and exists (select 1 from public.conversation_members cm
      where cm.conversation_id = messages.conversation_id and cm.user_id = (select auth.uid()))
  );

create policy "read own notifications" on public.notifications
  for select to authenticated using (recipient_id = (select auth.uid()));
create policy "mark own notifications read" on public.notifications
  for update to authenticated using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));
-- Nenhuma criação de notificação diretamente pelo browser:
-- criar via serviço de backend verificado numa etapa posterior.

-- Bucket privado: URLs assinadas expiram e RLS confere a visibilidade do post.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('social-media','social-media', false, 52428800,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'])
on conflict (id) do nothing;

create policy "own media upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'social-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "media read by owner or visible post" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'social-media' and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.posts p where p.media_path = name)
    )
  );
create policy "owner deletes media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'social-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Gravar favoritos/contagens via relações, nunca em listas gigantes no post.
