-- Authenticated platform reviewers need authorized preview access even
-- if the Next.js server-side preview route temporarily lacks configuration.
-- This supplements the existing age/author/approved story RLS, NOT public access.
create policy "platform reviewer reads pending story"
on public.stories
for select to authenticated
using (
  moderation_status = 'pending'
  and expires_at > now()
  and (select app_private.is_platform_moderator())
);
