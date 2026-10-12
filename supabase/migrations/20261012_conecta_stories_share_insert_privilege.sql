-- Allow authenticated users to create Story shares only through the existing RLS policy
-- and guard_story_post_share trigger. Do not grant UPDATE or broader table privileges.
grant insert (author_id, caption, media_path, media_type, visibility, shared_post_id)
on public.stories to authenticated;
