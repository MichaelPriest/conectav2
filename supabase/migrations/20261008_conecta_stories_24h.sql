-- Applied to Conecta Supabase project opdlxxrcdsxqmlhgayfm on 2026-10-08.
-- Independent social feature. Conecta ID remains untouched.
-- Age self-declaration is ONLY a restrictive gate; it never proves adulthood.
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  caption text not null default '' check (char_length(caption) <= 300),
  media_path text not null unique,
  media_type text not null check (media_type in ('image','video')),
  visibility text not null default 'friends' check (visibility in ('public','friends','private')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint stories_owner_path check (media_path like (author_id::text || '/stories/%') and char_length(media_path) <= 250),
  constraint stories_expiry_length check (expires_at > created_at and expires_at <= created_at + interval '24 hours 1 minute')
);
create index if not exists stories_expiry_idx on public.stories(expires_at);
create index if not exists stories_recent_idx on public.stories(created_at desc);
create index if not exists stories_author_recent_idx on public.stories(author_id,created_at desc);
alter table public.stories enable row level security;
revoke all on public.stories from public,anon,authenticated;
grant select,delete on public.stories to authenticated;
-- The client cannot customize creation or expiration timestamps.
grant insert(author_id,caption,media_path,media_type,visibility) on public.stories to authenticated;
create policy "view permitted active stories" on public.stories for select to authenticated using (
  expires_at > now()
  and exists(select 1 from public.registration_age_declarations a where a.user_id=(select auth.uid()) and a.declared_band='18_plus')
  and not exists(select 1 from public.teen_safety_preferences y where y.user_id=(select auth.uid()) and y.mode='youth_protection')
  and (
    author_id=(select auth.uid())
    or (
      not exists(select 1 from public.user_blocks b where
        (b.blocker_id=author_id and b.blocked_id=(select auth.uid()))
        or (b.blocker_id=(select auth.uid()) and b.blocked_id=author_id))
      and (
        visibility='public'
        or (visibility='friends' and exists(
          select 1 from public.friendships f where f.status='accepted'
            and ((f.requester_id=author_id and f.addressee_id=(select auth.uid()))
              or (f.addressee_id=author_id and f.requester_id=(select auth.uid())))
        ))
      )
    )
  )
);
create policy "author creates story with protection" on public.stories for insert to authenticated with check (
  author_id=(select auth.uid())
  and exists(select 1 from public.registration_age_declarations a where a.user_id=(select auth.uid()) and a.declared_band='18_plus')
  and not exists(select 1 from public.teen_safety_preferences y where y.user_id=(select auth.uid()) and y.mode='youth_protection')
);
create policy "author deletes own stories" on public.stories for delete to authenticated using(author_id=(select auth.uid()));
-- Existing private bucket, existing uploader-folder policy, no broader media permissions.
create policy "permitted active story asset reads" on storage.objects for select to authenticated using(
  bucket_id='social-media'
  and exists(select 1 from public.stories s where s.media_path=name)
);
-- Note: stories become invisible at expiration. Physical object cleanup is a separate
-- retention task; short-lived signed URLs (120s) reduce post-expiration exposure.
