-- Applied to Conecta Supabase project opdlxxrcdsxqmlhgayfm on 2026-10-08.
-- Enables subscription to notification INSERT/UPDATE events for authenticated users.
-- Keep public.notifications SELECT restricted to recipient_id = auth.uid() via RLS.
-- Idempotent for rebuilds. Does not create or alter identity verification.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
