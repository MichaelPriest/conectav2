-- Applied to Conecta Supabase project opdlxxrcdsxqmlhgayfm, 2026-10-08.
-- Adds private attachments without relaxing message membership RLS or teen safety triggers.
alter table public.messages add column if not exists media_path text;
alter table public.messages add column if not exists media_type text;
alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages add constraint messages_content_check check (
  char_length(trim(content)) <= 4000 and (char_length(trim(content)) > 0 or media_path is not null)
);
alter table public.messages add constraint messages_media_pair_check check ((media_path is null) = (media_type is null));
alter table public.messages add constraint messages_media_type_check check (media_type is null or media_type in ('image','video','audio'));
alter table public.messages add constraint messages_media_owned_check check (
  media_path is null or (media_path like sender_id::text || '/messages/%' and char_length(media_path) <= 250)
);
create index if not exists messages_media_path_idx on public.messages(media_path) where media_path is not null;
-- Only members with message SELECT visibility may obtain signed URLs for chat media.
create policy "read authorized message media" on storage.objects for select to authenticated using (
  bucket_id='social-media' and exists(select 1 from public.messages m where m.media_path=name)
);
