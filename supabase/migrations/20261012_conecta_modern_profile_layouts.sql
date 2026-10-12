-- Add modern full-interface profile presets. This changes only the accepted visual preference.
-- It does not alter row-level security, visibility, moderation, or authorization.
alter table public.profile_details
  drop constraint if exists profile_details_layout_style_check;

alter table public.profile_details
  add constraint profile_details_layout_style_check
  check (layout_style = any (array[
    'classic','orkut','myspace','facebook','instagram','creator','minimal',
    'aurora','glass','neo'
  ]::text[]));
