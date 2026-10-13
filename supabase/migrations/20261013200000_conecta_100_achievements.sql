-- 100 Conecta achievements, server-calculated and protected by RLS.
create table if not exists public.achievement_catalog (
  id text primary key check (id ~ '^[a-z0-9-]{3,80}$'),
  title text not null,
  description text not null,
  category text not null,
  metric text not null check (metric in ('founder','posts','connections','comments','likes','stories','communities','polls','messages','saved_posts')),
  target integer not null check (target > 0),
  sort_order integer not null unique
);
create table if not exists public.user_achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null references public.achievement_catalog(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);
alter table public.achievement_catalog enable row level security;
alter table public.user_achievements enable row level security;
revoke all on public.achievement_catalog from anon, authenticated;
revoke all on public.user_achievements from anon, authenticated;
grant select on public.achievement_catalog to authenticated;
grant select on public.user_achievements to authenticated;
drop policy if exists "Authenticated can read achievement catalog" on public.achievement_catalog;
create policy "Authenticated can read achievement catalog" on public.achievement_catalog for select to authenticated using (true);
drop policy if exists "Users can read own achievement awards" on public.user_achievements;
create policy "Users can read own achievement awards" on public.user_achievements for select to authenticated using (user_id = (select auth.uid()));
insert into public.achievement_catalog(id,title,description,category,metric,target,sort_order) values
('first-user','Primeiro usuário do Conecta','Você foi a primeira conta registrada na rede. Conquista única, atribuída pelo banco de dados.','Fundadores','founder',1,0),
('posts-1','Primeira publicação','Alcance 1 publicação.','Publicações','posts',1,1),
('posts-2','Voz ativa','Alcance 2 publicações.','Publicações','posts',2,2),
('posts-3','Compartilhando ideias','Alcance 3 publicações.','Publicações','posts',3,3),
('posts-5','Mural em movimento','Alcance 5 publicações.','Publicações','posts',5,4),
('posts-10','Criador iniciante','Alcance 10 publicações.','Publicações','posts',10,5),
('posts-20','Criador frequente','Alcance 20 publicações.','Publicações','posts',20,6),
('posts-30','Criador dedicado','Alcance 30 publicações.','Publicações','posts',30,7),
('posts-50','Referência no mural','Alcance 50 publicações.','Publicações','posts',50,8),
('posts-75','Influenciador da comunidade','Alcance 75 publicações.','Publicações','posts',75,9),
('posts-100','Autor incansável','Alcance 100 publicações.','Publicações','posts',100,10),
('posts-250','Lenda das publicações','Alcance 250 publicações.','Publicações','posts',250,11),
('connections-1','Primeira conexão','Alcance 1 conexão.','Conexões','connections',1,12),
('connections-2','Novos laços','Alcance 2 conexões.','Conexões','connections',2,13),
('connections-3','Rede começando','Alcance 3 conexões.','Conexões','connections',3,14),
('connections-5','Conectando pessoas','Alcance 5 conexões.','Conexões','connections',5,15),
('connections-10','Círculo social','Alcance 10 conexões.','Conexões','connections',10,16),
('connections-20','Rede em expansão','Alcance 20 conexões.','Conexões','connections',20,17),
('connections-30','Conector dedicado','Alcance 30 conexões.','Conexões','connections',30,18),
('connections-50','Ponto de encontro','Alcance 50 conexões.','Conexões','connections',50,19),
('connections-75','Grande rede','Alcance 75 conexões.','Conexões','connections',75,20),
('connections-100','Superconector','Alcance 100 conexões.','Conexões','connections',100,21),
('connections-250','Ícone da comunidade','Alcance 250 conexões.','Conexões','connections',250,22),
('comments-1','Primeira conversa','Alcance 1 comentário aprovado.','Conversas','comments',1,23),
('comments-2','Comentário construtivo','Alcance 2 comentários aprovados.','Conversas','comments',2,24),
('comments-3','Participante ativo','Alcance 3 comentários aprovados.','Conversas','comments',3,25),
('comments-5','Boa conversa','Alcance 5 comentários aprovados.','Conversas','comments',5,26),
('comments-10','Voz presente','Alcance 10 comentários aprovados.','Conversas','comments',10,27),
('comments-20','Conversador frequente','Alcance 20 comentários aprovados.','Conversas','comments',20,28),
('comments-30','Debatedor dedicado','Alcance 30 comentários aprovados.','Conversas','comments',30,29),
('comments-50','Conversa que inspira','Alcance 50 comentários aprovados.','Conversas','comments',50,30),
('comments-75','Mestre do diálogo','Alcance 75 comentários aprovados.','Conversas','comments',75,31),
('comments-100','Voz da comunidade','Alcance 100 comentários aprovados.','Conversas','comments',100,32),
('comments-250','Lenda das conversas','Alcance 250 comentários aprovados.','Conversas','comments',250,33),
('likes-1','Primeiro carinho','Alcance 1 curtida.','Curtidas','likes',1,34),
('likes-2','Espalhando carinho','Alcance 2 curtidas.','Curtidas','likes',2,35),
('likes-3','Apoiador','Alcance 3 curtidas.','Curtidas','likes',3,36),
('likes-5','Curtidor frequente','Alcance 5 curtidas.','Curtidas','likes',5,37),
('likes-10','Aplausos em série','Alcance 10 curtidas.','Curtidas','likes',10,38),
('likes-20','Carinho constante','Alcance 20 curtidas.','Curtidas','likes',20,39),
('likes-30','Apoiador dedicado','Alcance 30 curtidas.','Curtidas','likes',30,40),
('likes-50','Maré de curtidas','Alcance 50 curtidas.','Curtidas','likes',50,41),
('likes-75','Grande incentivador','Alcance 75 curtidas.','Curtidas','likes',75,42),
('likes-100','Coração gigante','Alcance 100 curtidas.','Curtidas','likes',100,43),
('likes-250','Fã do Conecta','Alcance 250 curtidas.','Curtidas','likes',250,44),
('stories-1','Primeiro story','Alcance 1 story aprovado.','Stories','stories',1,45),
('stories-2','Momento compartilhado','Alcance 2 stories aprovados.','Stories','stories',2,46),
('stories-3','Storytelling','Alcance 3 stories aprovados.','Stories','stories',3,47),
('stories-5','Story em série','Alcance 5 stories aprovados.','Stories','stories',5,48),
('stories-10','Narrador iniciante','Alcance 10 stories aprovados.','Stories','stories',10,49),
('stories-20','Narrador frequente','Alcance 20 stories aprovados.','Stories','stories',20,50),
('stories-30','Histórias sem parar','Alcance 30 stories aprovados.','Stories','stories',30,51),
('stories-50','Contador de histórias','Alcance 50 stories aprovados.','Stories','stories',50,52),
('stories-75','Estrela dos stories','Alcance 75 stories aprovados.','Stories','stories',75,53),
('stories-100','Narrador incansável','Alcance 100 stories aprovados.','Stories','stories',100,54),
('stories-250','Lenda dos stories','Alcance 250 stories aprovados.','Stories','stories',250,55),
('communities-1','Primeira comunidade','Alcance 1 comunidade participada.','Comunidades','communities',1,56),
('communities-2','Em boa companhia','Alcance 2 comunidades participadas.','Comunidades','communities',2,57),
('communities-3','Explorador social','Alcance 3 comunidades participadas.','Comunidades','communities',3,58),
('communities-5','Membro ativo','Alcance 5 comunidades participadas.','Comunidades','communities',5,59),
('communities-10','Várias tribos','Alcance 10 comunidades participadas.','Comunidades','communities',10,60),
('communities-20','Explorador frequente','Alcance 20 comunidades participadas.','Comunidades','communities',20,61),
('communities-30','Comunidades em foco','Alcance 30 comunidades participadas.','Comunidades','communities',30,62),
('communities-50','Presença comunitária','Alcance 50 comunidades participadas.','Comunidades','communities',50,63),
('communities-75','Voz em muitas comunidades','Alcance 75 comunidades participadas.','Comunidades','communities',75,64),
('communities-100','Cidadão das comunidades','Alcance 100 comunidades participadas.','Comunidades','communities',100,65),
('communities-250','Embaixador comunitário','Alcance 250 comunidades participadas.','Comunidades','communities',250,66),
('polls-1','Primeiro voto','Alcance 1 voto em enquete.','Enquetes','polls',1,67),
('polls-2','Opinião registrada','Alcance 2 votos em enquetes.','Enquetes','polls',2,68),
('polls-3','Voz nas decisões','Alcance 3 votos em enquetes.','Enquetes','polls',3,69),
('polls-5','Votante ativo','Alcance 5 votos em enquetes.','Enquetes','polls',5,70),
('polls-10','Participação em série','Alcance 10 votos em enquetes.','Enquetes','polls',10,71),
('polls-20','Opinião frequente','Alcance 20 votos em enquetes.','Enquetes','polls',20,72),
('polls-30','Voz participativa','Alcance 30 votos em enquetes.','Enquetes','polls',30,73),
('polls-50','Votante dedicado','Alcance 50 votos em enquetes.','Enquetes','polls',50,74),
('polls-75','Opinião influente','Alcance 75 votos em enquetes.','Enquetes','polls',75,75),
('polls-100','Voz das enquetes','Alcance 100 votos em enquetes.','Enquetes','polls',100,76),
('polls-250','Especialista em opinião','Alcance 250 votos em enquetes.','Enquetes','polls',250,77),
('messages-1','Primeira mensagem','Alcance 1 mensagem enviada.','Mensagens','messages',1,78),
('messages-2','Papo iniciado','Alcance 2 mensagens enviadas.','Mensagens','messages',2,79),
('messages-3','Conversa aberta','Alcance 3 mensagens enviadas.','Mensagens','messages',3,80),
('messages-5','Mensageiro ativo','Alcance 5 mensagens enviadas.','Mensagens','messages',5,81),
('messages-10','Papo frequente','Alcance 10 mensagens enviadas.','Mensagens','messages',10,82),
('messages-20','Conversas em série','Alcance 20 mensagens enviadas.','Mensagens','messages',20,83),
('messages-30','Mensageiro dedicado','Alcance 30 mensagens enviadas.','Mensagens','messages',30,84),
('messages-50','Rede de conversas','Alcance 50 mensagens enviadas.','Mensagens','messages',50,85),
('messages-75','Comunicador experiente','Alcance 75 mensagens enviadas.','Mensagens','messages',75,86),
('messages-100','Mensageiro incansável','Alcance 100 mensagens enviadas.','Mensagens','messages',100,87),
('messages-250','Mestre da comunicação','Alcance 250 mensagens enviadas.','Mensagens','messages',250,88),
('saved-posts-1','Primeiro favorito','Alcance 1 publicação salva.','Favoritos','saved_posts',1,89),
('saved-posts-2','Boa lembrança','Alcance 2 publicações salvas.','Favoritos','saved_posts',2,90),
('saved-posts-3','Colecionador iniciante','Alcance 3 publicações salvas.','Favoritos','saved_posts',3,91),
('saved-posts-5','Biblioteca pessoal','Alcance 5 publicações salvas.','Favoritos','saved_posts',5,92),
('saved-posts-10','Curadoria em formação','Alcance 10 publicações salvas.','Favoritos','saved_posts',10,93),
('saved-posts-20','Colecionador frequente','Alcance 20 publicações salvas.','Favoritos','saved_posts',20,94),
('saved-posts-30','Arquivo de ideias','Alcance 30 publicações salvas.','Favoritos','saved_posts',30,95),
('saved-posts-50','Curador dedicado','Alcance 50 publicações salvas.','Favoritos','saved_posts',50,96),
('saved-posts-75','Biblioteca viva','Alcance 75 publicações salvas.','Favoritos','saved_posts',75,97),
('saved-posts-100','Curador incansável','Alcance 100 publicações salvas.','Favoritos','saved_posts',100,98),
('saved-posts-250','Memória do Conecta','Alcance 250 publicações salvas.','Favoritos','saved_posts',250,99)
on conflict (id) do update set title=excluded.title, description=excluded.description, category=excluded.category, metric=excluded.metric, target=excluded.target, sort_order=excluded.sort_order;
create or replace function public.get_my_achievements()
returns table (
  id text, title text, description text, category text, metric text,
  target integer, progress bigint, unlocked boolean, unlocked_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_metrics jsonb;
  v_first_user uuid;
begin
  if v_user is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_user) then
    raise exception 'profile required' using errcode = '42501';
  end if;
  select p.id into v_first_user from public.profiles p order by p.created_at asc, p.id asc limit 1;
  v_metrics := jsonb_build_object(
    'posts', (select count(*) from public.posts p where p.author_id=v_user and p.moderation_status='approved'),
    'connections', (select count(*) from public.friendships f where f.status='accepted' and (f.requester_id=v_user or f.addressee_id=v_user)),
    'comments', (select count(*) from public.post_comments c where c.author_id=v_user and c.moderation_status='approved'),
    'likes', (select count(*) from public.post_likes l where l.user_id=v_user),
    'stories', (select count(*) from public.stories s where s.author_id=v_user and s.moderation_status='approved'),
    'communities', (select count(*) from public.community_members cm where cm.user_id=v_user),
    'polls', (select count(*) from public.post_poll_votes pv where pv.user_id=v_user),
    'messages', (select count(*) from public.messages m where m.sender_id=v_user and m.deleted_at is null),
    'saved_posts', (select count(*) from public.saved_posts sp where sp.user_id=v_user),
    'founder', case when v_user=v_first_user then 1 else 0 end
  );
  insert into public.user_achievements(user_id,achievement_id)
  select v_user, c.id from public.achievement_catalog c
  where coalesce((v_metrics->>c.metric)::bigint,0) >= c.target
  on conflict (user_id,achievement_id) do nothing;
  return query
  select c.id,c.title,c.description,c.category,c.metric,c.target,
    coalesce((v_metrics->>c.metric)::bigint,0),
    (ua.achievement_id is not null),ua.unlocked_at
  from public.achievement_catalog c
  left join public.user_achievements ua on ua.achievement_id=c.id and ua.user_id=v_user
  order by c.sort_order;
end;
$$;
revoke all on function public.get_my_achievements() from public, anon;
grant execute on function public.get_my_achievements() to authenticated;
-- Backfill the founder award for the earliest real profile, if any.
insert into public.user_achievements(user_id,achievement_id)
select p.id,'first-user' from public.profiles p
order by p.created_at asc,p.id asc limit 1
on conflict (user_id,achievement_id) do nothing;
