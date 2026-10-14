-- Private, consent-based family links and guardian associations for Conecta.
-- No family relationship is public by default. Writes are mediated by authenticated server routes.
create table if not exists public.conecta_family_relationships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  relationship_type text not null check (relationship_type in (
    'mother','father','parent','child','guardian','sibling','grandparent',
    'grandchild','spouse','partner','aunt_uncle','niece_nephew','cousin','other'
  )),
  status text not null default 'pending' check (status in ('pending','accepted','rejected','revoked')),
  requested_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint conecta_family_no_self check (requester_id <> addressee_id),
  constraint conecta_family_requester_is_party check (requested_by in (requester_id, addressee_id)),
  constraint conecta_family_unique_direct unique (requester_id, addressee_id, relationship_type)
);

create index if not exists conecta_family_requester_status_idx
  on public.conecta_family_relationships(requester_id, status, created_at desc);
create index if not exists conecta_family_addressee_status_idx
  on public.conecta_family_relationships(addressee_id, status, created_at desc);

create table if not exists public.conecta_guardian_links (
  id uuid primary key default gen_random_uuid(),
  child_user_id uuid not null references auth.users(id) on delete cascade,
  guardian_user_id uuid not null references auth.users(id) on delete cascade,
  relationship_type text not null check (relationship_type in ('parent','legal_guardian','foster_guardian','caregiver')),
  status text not null default 'pending' check (status in ('pending','accepted','rejected','revoked')),
  requested_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint conecta_guardian_no_self check (child_user_id <> guardian_user_id),
  constraint conecta_guardian_requester_is_party check (requested_by in (child_user_id, guardian_user_id)),
  constraint conecta_guardian_unique_pair unique (child_user_id, guardian_user_id)
);

create index if not exists conecta_guardian_child_status_idx
  on public.conecta_guardian_links(child_user_id, status);
create index if not exists conecta_guardian_guardian_status_idx
  on public.conecta_guardian_links(guardian_user_id, status);

alter table public.conecta_family_relationships enable row level security;
alter table public.conecta_guardian_links enable row level security;
revoke all on table public.conecta_family_relationships from public, anon, authenticated;
revoke all on table public.conecta_guardian_links from public, anon, authenticated;
grant select, insert, update, delete on table public.conecta_family_relationships to service_role;
grant select, insert, update, delete on table public.conecta_guardian_links to service_role;

comment on table public.conecta_family_relationships is
  'Private user-declared kinship links. A link is not public and is not proof of legal kinship; both users must consent.';
comment on table public.conecta_guardian_links is
  'Private guardian association. Acceptance alone is not legal proof; trusted adult age assurance is required for guardian authorization.';
