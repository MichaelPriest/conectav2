-- PostgREST requires a table-level INSERT grant for this Stories insert path.
-- The BEFORE INSERT trigger resets every server-managed field before the row is stored.
-- RLS still requires author_id = auth.uid(), adult declaration, and no youth-protection mode.
create or replace function app_private.guard_story_post_share()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if (select auth.uid()) is null
     or new.author_id is distinct from (select auth.uid()) then
    raise exception 'Autenticação necessária para criar Story' using errcode='42501';
  end if;

  -- Do not let clients choose identifiers, timestamps, expiration, or moderation status.
  new.id := gen_random_uuid();
  new.created_at := now();
  new.expires_at := now() + interval '24 hours';

  if new.shared_post_id is not null then
    if new.media_path is not null or new.media_type is not null or btrim(new.caption) <> '' then
      raise exception 'Um Story de publicação não aceita mídia ou legenda adicional'
        using errcode='22023';
    end if;
    if not exists (
      select 1 from public.posts p
      where p.id = new.shared_post_id
        and p.visibility = 'public'
        and p.community_id is null
        and p.moderation_status = 'approved'
    ) then
      raise exception 'Compartilhe somente publicações públicas e aprovadas'
        using errcode='22023';
    end if;
    new.caption := '';
    new.moderation_status := 'approved';
  else
    new.moderation_status := 'pending';
  end if;
  return new;
end;
$function$;

revoke all on function app_private.guard_story_post_share()
  from public, anon, authenticated;

grant select, delete on table public.stories to authenticated;
grant insert on table public.stories to authenticated;
