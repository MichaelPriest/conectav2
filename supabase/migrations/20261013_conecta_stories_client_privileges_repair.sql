-- Repair the minimum authenticated table privileges used by the mobile and web Story clients.
-- RLS remains the authority for row-level visibility; this does not make Stories public.
-- Column-level INSERT grants keep server-managed timestamps and moderation fields client-inaccessible.
grant select, delete on table public.stories to authenticated;
grant insert (author_id, caption, media_path, media_type, visibility, shared_post_id)
  on table public.stories to authenticated;
