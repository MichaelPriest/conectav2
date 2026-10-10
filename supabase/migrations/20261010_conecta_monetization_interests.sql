-- Conecta V2: interesse comercial e lista de espera. Sem cobrança ou assinatura ativada.
create table if not exists public.monetization_interests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('plus','business','sponsorship')),
 organization_name text,
 contact_email text not null,
 note text not null default '',
 contact_consent boolean not null default false check (contact_consent = true),
 status text not null default 'pending' check (status in ('pending','contacted','closed')),
 created_at timestamptz not null default now(),
 constraint monetization_kind_once_per_user unique (user_id,kind),
 constraint monetization_org_length check (organization_name is null or char_length(btrim(organization_name)) between 2 and 120),
 constraint monetization_business_org check (kind = 'plus' or organization_name is not null),
 constraint monetization_email_format check (char_length(contact_email) between 6 and 254 and contact_email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'),
 constraint monetization_note_length check (char_length(note) <= 600)
);
create index if not exists monetization_interests_review_index
 on public.monetization_interests (status,created_at desc);
alter table public.monetization_interests enable row level security;
revoke all on table public.monetization_interests from public,anon,authenticated;
grant select on table public.monetization_interests to authenticated;
grant insert(user_id,kind,organization_name,contact_email,note,contact_consent)
 on table public.monetization_interests to authenticated;
grant update(status) on table public.monetization_interests to authenticated;
-- The request is an opt-in expression of interest, NOT ad targeting or adult verification.
-- Only self-declared adults may request commercial contact. Paid ads remain separately gated.
create policy "monetization adult users can request contact" on public.monetization_interests
 for insert to authenticated with check (
  user_id=(select auth.uid()) and status='pending' and contact_consent=true
  and exists (
   select 1 from public.registration_age_declarations a
   where a.user_id=(select auth.uid()) and a.declared_band='18_plus'
  )
 );
create policy "monetization own or administrator can read interests" on public.monetization_interests
 for select to authenticated using (
   user_id=(select auth.uid()) or exists (
     select 1 from public.platform_moderators p
     where p.user_id=(select auth.uid()) and p.role='admin'
   )
 );
create policy "monetization administrator can change review status" on public.monetization_interests
 for update to authenticated using (
   exists (select 1 from public.platform_moderators p
           where p.user_id=(select auth.uid()) and p.role='admin')
 ) with check (
   exists (select 1 from public.platform_moderators p
           where p.user_id=(select auth.uid()) and p.role='admin')
 );
comment on table public.monetization_interests is 'Opt-in interest only, no real payments, subscriptions, ad serving or revenue claims.';
