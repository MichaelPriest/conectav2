-- Users can revoke commercial contact consent and delete their own pending/closed interest.
-- Never allow DELETE of other users' data or change administrative permissions.
grant delete on table public.monetization_interests to authenticated;
create policy "monetization requester can withdraw consent"
 on public.monetization_interests
 for delete to authenticated using (user_id=(select auth.uid()));
