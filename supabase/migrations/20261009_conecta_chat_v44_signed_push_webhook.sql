-- Chat V4.4: content-free, HMAC-signed database webhook, disabled until new
-- production deployment is verified. No token or private message enters pg_net.
create extension if not exists pg_net with schema extensions;
create table if not exists app_private.chat_push_webhook_config (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  endpoint text not null default 'https://conectav2-michael-raimundos-projects.vercel.app/api/chat/push/webhook',
  secret_name text not null default 'conecta_chat_push_webhook'
);
alter table app_private.chat_push_webhook_config enable row level security;
revoke all on app_private.chat_push_webhook_config from public,anon,authenticated;
insert into app_private.chat_push_webhook_config(singleton)values(true)
on conflict(singleton) do nothing;

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
  select 1 from public.chat_push_subscriptions s
  join public.conversation_members cm
   on cm.user_id=s.user_id and cm.conversation_id=new.conversation_id
  where s.user_id<>new.sender_id
 ) then return new;end if;
 select v.decrypted_secret into target_secret from vault.decrypted_secrets v
  where v.name=secret_name limit 1;
 if target_secret is null or pg_catalog.length(target_secret)<32 then return new;end if;
 issued:=pg_catalog.floor(pg_catalog.extract(epoch from pg_catalog.clock_timestamp()))::bigint;
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
drop trigger if exists enqueue_chat_push_after_message_insert on public.messages;
create trigger enqueue_chat_push_after_message_insert
 after insert on public.messages for each row
 execute function app_private.enqueue_chat_push_webhook();
-- Safe rollout: enabled remains false. Activate only after new server deployment
-- with CHAT_PUSH_WEBHOOK_SECRET and Web Push variables verified.
