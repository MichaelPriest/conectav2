-- Chat Web Push: subscriptions and delivery claims are server-owned only.
-- Clients never receive endpoints/keys from the Supabase Data API.
create table if not exists public.chat_push_subscriptions (
  endpoint_hash text primary key check(length(endpoint_hash)=64),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chat_push_subscriptions_user_idx on public.chat_push_subscriptions(user_id);
create table if not exists public.chat_push_delivery_claims(
  message_id uuid primary key references public.messages(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.chat_push_subscriptions enable row level security;
alter table public.chat_push_delivery_claims enable row level security;
revoke all on public.chat_push_subscriptions from public,anon,authenticated;
revoke all on public.chat_push_delivery_claims from public,anon,authenticated;
grant select,insert,update,delete on public.chat_push_subscriptions to service_role;
grant select,insert,update,delete on public.chat_push_delivery_claims to service_role;
