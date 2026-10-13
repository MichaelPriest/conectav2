-- Profile visit history inspired by the legacy Conecta profile.
-- Visit records are created only when the profile owner explicitly enables the feature.
-- RLS and the SECURITY DEFINER RPC prevent clients from recording visits for arbitrary viewers.
alter table public.profile_details
  add column if not exists profile_views_enabled boolean not null default false;

create table if not exists public.profile_visits (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  last_viewed_at timestamptz not null default now(),
  view_count integer not null default 1 check (view_count between 1 and 1000000),
  constraint profile_visits_no_self_view check (profile_id <> viewer_id),
  constraint profile_visits_unique_pair unique (profile_id, viewer_id)
);

create index if not exists profile_visits_profile_last_viewed_idx
  on public.profile_visits(profile_id, last_viewed_at desc);

alter table public.profile_visits enable row level security;
revoke all on public.profile_visits from anon, authenticated;
grant select, delete on public.profile_visits to authenticated;

drop policy if exists "Profile owners can read enabled visit history" on public.profile_visits;
create policy "Profile owners can read enabled visit history"
on public.profile_visits for select to authenticated
using (
  profile_id = (select auth.uid())
  and exists (
    select 1 from public.profile_details d
    where d.user_id = (select auth.uid()) and d.profile_views_enabled = true
  )
  and not exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = profile_visits.profile_id and b.blocked_id = profile_visits.viewer_id)
       or (b.blocker_id = profile_visits.viewer_id and b.blocked_id = profile_visits.profile_id)
  )
);

create or replace function public.record_profile_visit(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_viewer_id uuid := auth.uid();
begin
  if v_viewer_id is null or p_profile_id is null or p_profile_id = v_viewer_id then
    return;
  end if;

  if not exists (
    select 1 from public.profile_details d
    where d.user_id = p_profile_id and d.profile_views_enabled = true
  ) then
    return;
  end if;

  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = p_profile_id and b.blocked_id = v_viewer_id)
       or (b.blocker_id = v_viewer_id and b.blocked_id = p_profile_id)
  ) then
    return;
  end if;

  insert into public.profile_visits (profile_id, viewer_id, last_viewed_at, view_count)
  values (p_profile_id, v_viewer_id, now(), 1)
  on conflict (profile_id, viewer_id) do update
    set last_viewed_at = now(),
        view_count = least(profile_visits.view_count + 1, 1000000);
end;
$$;

revoke all on function public.record_profile_visit(uuid) from public, anon;
grant execute on function public.record_profile_visit(uuid) to authenticated;

drop policy if exists "Participants can delete profile visit history" on public.profile_visits;
create policy "Participants can delete profile visit history"
on public.profile_visits for delete to authenticated
using (profile_id = (select auth.uid()) or viewer_id = (select auth.uid()));
