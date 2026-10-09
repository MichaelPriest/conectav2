-- Emit live emoji changes only to participants authorized by message_reactions RLS.
do $$ begin
 if not exists(select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public' and tablename='message_reactions') then
  alter publication supabase_realtime add table public.message_reactions;
 end if;
end $$;
