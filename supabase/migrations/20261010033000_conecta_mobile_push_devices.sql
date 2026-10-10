-- Conecta Mobile: Expo push tokens never enter the public Data API.
-- The verified backend owns registration, removal and delivery.
create table if not exists public.mobile_push_devices (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null check (expo_push_token ~ '^(Expo|Exponent)PushToken[[][A-Za-z0-9_-]{12,180}[]]$'),
  platform text not null check (platform in ('android','ios')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mobile_push_devices_user_id_idx on public.mobile_push_devices(user_id);
alter table public.mobile_push_devices enable row level security;
revoke all on public.mobile_push_devices from public, anon, authenticated;
grant select, insert, update, delete on public.mobile_push_devices to service_role;

-- Keep the already-signed, content-free message webhook and existing allowlist.
-- Only expand the eligibility check to include native recipients.
create or replace function app_private.enqueue_chat_push_webhook()
returns trigger language plpgsql security definer set search_path='' as $$
declare target_url text;target_secret text;secret_name text;issued bigint;mac text;
begin
 select endpoint,c.secret_name into target_url,secret_name
 from app_private.chat_push_webhook_config c
 where c.singleton and c.enabled;
 if target_url is null then return new;end if;
 if target_url not in (
  'https://conectav2-michael-raimundos-projects.vercel.app/api/chat/push/webhook'
 ) then raise exception 'Destino de Web Push inválido.' using errcode='42501';end if;
 if not exists(
  select 1 from public.conversation_members cm
  where cm.conversation_id=new.conversation_id
    and cm.user_id<>new.sender_id
    and (exists(select 1 from public.chat_push_subscriptions s
                where s.user_id=cm.user_id)
         or exists(select 1 from public.mobile_push_devices d
                where d.user_id=cm.user_id))
 ) then return new;end if;
 select v.decrypted_secret into target_secret from vault.decrypted_secrets v
  where v.name=secret_name limit 1;
 if target_secret is null or pg_catalog.length(target_secret)<32 then return new;end if;
 issued:=pg_catalog.floor(pg_catalog.date_part('epoch',pg_catalog.clock_timestamp()))::bigint;
 mac:=pg_catalog.encode(extensions.hmac(new.id::text||'.'||issued::text,
   target_secret,'sha256'),'hex');
 perform net.http_post(
   url:=target_url,
   body:=pg_catalog.jsonb_build_object(
     'messageId',new.id::text,'issuedAt',issued,'signature',mac),
   headers:='{"Content-Type":"application/json"}'::jsonb,
   timeout_milliseconds:=4000
 );
 return new;
end;$$;
revoke all on function app_private.enqueue_chat_push_webhook() from public,anon,authenticated;
-- Existing messages trigger remains unchanged and automatically uses this body.
),
  platform text not null check (platform in ('android','ios')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mobile_push_devices_user_id_idx on public.mobile_push_devices(user_id);
alter table public.mobile_push_devices enable row level security;
revoke all on public.mobile_push_devices from public, anon, authenticated;
grant select, insert, update, delete on public.mobile_push_devices to service_role;

-- Keep the already-signed, content-free message webhook and existing allowlist.
-- Only expand the eligibility check to include native recipients.
create or replace function app_private.enqueue_chat_push_webhook()
returns trigger language plpgsql security definer set search_path='' as $$
declare target_url text;target_secret text;secret_name text;issued bigint;mac text;
begin
 select endpoint,c.secret_name into target_url,secret_name
 from app_private.chat_push_webhook_config c
 where c.singleton and c.enabled;
 if target_url is null then return new;end if;
 if target_url not in (
  'https://conectav2-michael-raimundos-projects.vercel.app/api/chat/push/webhook'
 ) then raise exception 'Destino de Web Push inválido.' using errcode='42501';end if;
 if not exists(
  select 1 from public.conversation_members cm
  where cm.conversation_id=new.conversation_id
    and cm.user_id<>new.sender_id
    and (exists(select 1 from public.chat_push_subscriptions s
                where s.user_id=cm.user_id)
         or exists(select 1 from public.mobile_push_devices d
                where d.user_id=cm.user_id))
 ) then return new;end if;
 select v.decrypted_secret into target_secret from vault.decrypted_secrets v
  where v.name=secret_name limit 1;
 if target_secret is null or pg_catalog.length(target_secret)<32 then return new;end if;
 issued:=pg_catalog.floor(pg_catalog.date_part('epoch',pg_catalog.clock_timestamp()))::bigint;
 mac:=pg_catalog.encode(extensions.hmac(new.id::text||'.'||issued::text,
   target_secret,'sha256'),'hex');
 perform net.http_post(
   url:=target_url,
   body:=pg_catalog.jsonb_build_object(
     'messageId',new.id::text,'issuedAt',issued,'signature',mac),
   headers:='{"Content-Type":"application/json"}'::jsonb,
   timeout_milliseconds:=4000
 );
 return new;
end;$$;
revoke all on function app_private.enqueue_chat_push_webhook() from public,anon,authenticated;
-- Existing messages trigger remains unchanged and automatically uses this body.
