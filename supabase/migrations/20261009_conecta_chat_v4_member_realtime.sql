-- Required for group invite/removal/owner changes to arrive on another connected client.
-- RLS on both tables remains enabled; do not enable full row identity.
do $$
begin
  if not exists(select 1 from pg_catalog.pg_publication_tables
     where pubname='supabase_realtime' and schemaname='public' and tablename='conversation_members') then
    alter publication supabase_realtime add table public.conversation_members;
  end if;
  if not exists(select 1 from pg_catalog.pg_publication_tables
     where pubname='supabase_realtime' and schemaname='public' and tablename='conversations') then
    alter publication supabase_realtime add table public.conversations;
  end if;
end;
$$;
