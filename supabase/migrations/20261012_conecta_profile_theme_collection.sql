-- Expand the supported profile theme presets without changing visibility or RLS.
alter table public.profile_details drop constraint if exists profile_details_layout_style_check;
alter table public.profile_details add constraint profile_details_layout_style_check
  check (layout_style = any (array['classic','orkut','myspace','facebook','instagram','creator','minimal']::text[]));
alter table public.profile_details drop constraint if exists profile_details_cover_theme_check;
alter table public.profile_details add constraint profile_details_cover_theme_check
  check (cover_theme = any (array['violet','aqua','pink','sunset','midnight','forest','ocean','graphite','candy']::text[]));
