-- Pending/rejected Stories may be visible to their author and authorized reviewers,
-- but must never leak to other users through the ordinary Story timeline.
-- Keep all existing age, youth-protection, expiry, visibility and block gates.
drop policy if exists "view permitted active stories" on public.stories;

create policy "view permitted active stories" on public.stories
for select to authenticated
using (
  expires_at > now()
  and exists (
    select 1 from public.registration_age_declarations a
    where a.user_id = (select auth.uid())
      and a.declared_band = '18_plus'
  )
  and not exists (
    select 1 from public.teen_safety_preferences y
    where y.user_id = (select auth.uid())
      and y.mode = 'youth_protection'
  )
  and (
    -- Authors can check their own moderation state, including pending/rejected.
    author_id = (select auth.uid())
    or (
      moderation_status = 'approved'
      and not exists (
        select 1 from public.user_blocks b
        where (b.blocker_id = author_id and b.blocked_id = (select auth.uid()))
           or (b.blocker_id = (select auth.uid()) and b.blocked_id = author_id)
      )
      and (
        visibility = 'public'
        or (
          visibility = 'friends'
          and exists (
            select 1 from public.friendships f
            where f.status = 'accepted'
              and (
                (f.requester_id = author_id and f.addressee_id = (select auth.uid()))
                or (f.addressee_id = author_id and f.requester_id = (select auth.uid()))
              )
          )
        )
      )
    )
  )
);
