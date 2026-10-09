-- Source: applied Supabase migration 20261009030728.
drop policy if exists "author creates own gallery" on public.post_media;
create policy "author creates own gallery" on public.post_media
for insert to authenticated with check (
 owner_id=(select auth.uid()) and exists (
   select 1 from public.posts p
    where p.id=post_id and p.author_id=(select auth.uid())
    and p.moderation_status='pending'
 )
);
-- Existing media-read policies refer back to posts/stories under RLS:
-- neither signed URL nor gallery is visible publicly while held.

