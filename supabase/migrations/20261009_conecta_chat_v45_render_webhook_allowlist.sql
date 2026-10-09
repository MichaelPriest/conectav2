-- Include the already deployed Render validation endpoint as a strict allowlisted
-- webhook destination. Keep dispatch disabled until runtime secret and access checks pass.
create or replace function app_private.enqueue_chat_push_webhook()
returns trigger language plpgsql security definer set search_path='' as $$
declare target_url text;target_secret text;secret_name text;issued bigint;mac text;
begin
 select endpoint,c.secret_name into target_url,secret_name
 from app_private.chat_push_webhook_config c
 where c.singleton and c.enabled;
 if target_url is null then return new;end if;
 if target_url not in (
  'https://conectav2-michael-raimundos-projects.vercel.app/api/chat/push/webhook',
  'https://conectav2-validacao.onrender.com/api/chat/push/webhook'
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
-- Change the destination, not enabled: updating here cannot dispatch until runtime is verified.
update app_private.chat_push_webhook_config
 set endpoint='https://conectav2-validacao.onrender.com/api/chat/push/webhook'
 where singleton and enabled=false;
