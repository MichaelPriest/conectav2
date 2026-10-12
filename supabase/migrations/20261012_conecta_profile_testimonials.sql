-- Additive Orkut-inspired testimonials. Existing guestbook/recados and favorites remain unchanged.
create table public.profile_testimonials (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 3 and 800),
  status text not null default 'pending' check (status in ('pending','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_testimonials_not_self check (profile_id <> author_id),
  constraint profile_testimonials_one_per_author unique (profile_id, author_id)
);

create index profile_testimonials_profile_status_created_idx
  on public.profile_testimonials(profile_id, status, created_at desc);

alter table public.profile_testimonials enable row level security;
grant select, insert, update, delete on public.profile_testimonials to authenticated;

create policy "Profiles and authors can read testimonials"
on public.profile_testimonials for select to authenticated
using (
  (status = 'published' or profile_id = (select auth.uid()) or author_id = (select auth.uid()))
  and not exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = profile_testimonials.profile_id and b.blocked_id = (select auth.uid()))
       or (b.blocker_id = (select auth.uid()) and b.blocked_id = profile_testimonials.profile_id)
  )
);

create policy "Connected users can submit testimonials for approval"
on public.profile_testimonials for insert to authenticated
with check (
  author_id = (select auth.uid())
  and profile_id <> (select auth.uid())
  and status = 'pending'
  and exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = (select auth.uid()) and f.addressee_id = profile_testimonials.profile_id)
        or (f.addressee_id = (select auth.uid()) and f.requester_id = profile_testimonials.profile_id))
  )
  and not exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = profile_testimonials.profile_id and b.blocked_id = (select auth.uid()))
       or (b.blocker_id = (select auth.uid()) and b.blocked_id = profile_testimonials.profile_id)
  )
);

create policy "Profile owner approves testimonials"
on public.profile_testimonials for update to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()) and status = 'published');

create policy "Author or profile owner can delete testimonials"
on public.profile_testimonials for delete to authenticated
using (author_id = (select auth.uid()) or profile_id = (select auth.uid()));

create function public.guard_profile_testimonial_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id <> old.id
    or new.profile_id <> old.profile_id
    or new.author_id <> old.author_id
    or new.body <> old.body
    or new.created_at <> old.created_at then
    raise exception 'Testimonial content and participants are immutable';
  end if;
  if old.status <> 'pending' or new.status <> 'published' then
    raise exception 'Only pending testimonials can be approved';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger guard_profile_testimonial_update
before update on public.profile_testimonials
for each row execute function public.guard_profile_testimonial_update();
