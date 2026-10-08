-- Stage 1 of Conecta ID enrollment. This is a SELF-DECLARATION, never trusted proof.
create table if not exists public.registration_age_declarations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  declared_band text not null check (declared_band in ('13_15','16_17','18_plus')),
  declared_at timestamptz not null default now()
);
comment on table public.registration_age_declarations is 'Immutable self-declared age range for provisional safety. Never use as verified age or adult advertising eligibility.';
alter table public.registration_age_declarations enable row level security;
revoke all on public.registration_age_declarations from public,anon,authenticated;
grant select, insert on public.registration_age_declarations to authenticated;
grant all on public.registration_age_declarations to service_role;
drop policy if exists registration_age_read_own on public.registration_age_declarations;
create policy registration_age_read_own on public.registration_age_declarations
 for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists registration_age_create_own on public.registration_age_declarations;
create policy registration_age_create_own on public.registration_age_declarations
 for insert to authenticated with check (user_id=(select auth.uid()));
create schema if not exists conecta_internal;
revoke all on schema conecta_internal from public,anon,authenticated;
create or replace function conecta_internal.apply_registration_safety()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.user_id is distinct from auth.uid() then
  raise exception 'Age declaration owner mismatch' using errcode='42501';
 end if;
 if new.declared_band in ('13_15','16_17') then
   insert into public.teen_safety_preferences
     (user_id,mode,allow_public_messages,profile_discoverable,updated_at)
   values (new.user_id,'youth_protection',false,false,now())
   on conflict(user_id) do update set
     mode='youth_protection',allow_public_messages=false,profile_discoverable=false,
     updated_at=now();
   insert into public.teen_guardian_links (teen_id,status,updated_at)
   values (new.user_id,'pending_verification',now())
   on conflict (teen_id) do nothing;
 else
   insert into public.teen_safety_preferences
     (user_id,mode,allow_public_messages,profile_discoverable,updated_at)
   values (new.user_id,'unverified',false,false,now())
   on conflict(user_id) do nothing;
 end if;
 return new;
end $$;
revoke all on function conecta_internal.apply_registration_safety() from public,anon,authenticated;
drop trigger if exists apply_registration_safety on public.registration_age_declarations;
create trigger apply_registration_safety after insert on public.registration_age_declarations
 for each row execute function conecta_internal.apply_registration_safety();
