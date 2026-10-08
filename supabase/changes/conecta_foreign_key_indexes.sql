-- Applied through Supabase as conecta_foreign_key_indexes.
-- Only execute on an environment that has the initial schema and post_media.
create index if not exists communities_owner_idx on public.communities(owner_id);
create index if not exists community_members_user_idx on public.community_members(user_id,community_id);
create index if not exists conversations_creator_idx on public.conversations(created_by);
create index if not exists messages_sender_idx on public.messages(sender_id);
create index if not exists notifications_actor_idx on public.notifications(actor_id);
create index if not exists post_comments_author_idx on public.post_comments(author_id);
create index if not exists post_media_owner_idx on public.post_media(owner_id);
