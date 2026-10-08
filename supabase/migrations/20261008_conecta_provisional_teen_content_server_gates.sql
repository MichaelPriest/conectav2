-- Prevent a provisional teen account from bypassing UI via direct Supabase writes.
-- This is conservative until age assurance and guardian verification are operational.
create schema if not exists conecta_internal;
revoke all on schema conecta_internal from public,anon,authenticated;
create or replace function conecta_internal.guard_provisional_youth_content()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare blocked boolean;
begin
 if TG_TABLE_NAME='messages' then
   select exists (
     select 1 from public.conversation_members cm
     join public.teen_safety_preferences tsp on tsp.user_id=cm.user_id
     where cm.conversation_id=NEW.conversation_id
       and tsp.mode='youth_protection'
   ) into blocked;
 else
   select exists (
     select 1 from public.teen_safety_preferences tsp
     where tsp.user_id=NEW.author_id and tsp.mode='youth_protection'
   ) into blocked;
 end if;
 if blocked then
   raise exception 'Esta conta esta protegida e aguarda validacao de idade/responsavel'
     using errcode='42501';
 end if;
 return new;
end;
$fn$;
revoke all on function conecta_internal.guard_provisional_youth_content() from public,anon,authenticated;
drop trigger if exists guard_teen_post_insert on public.posts;
create trigger guard_teen_post_insert
 before insert on public.posts
 for each row execute function conecta_internal.guard_provisional_youth_content();
drop trigger if exists guard_teen_comment_insert on public.post_comments;
create trigger guard_teen_comment_insert
 before insert on public.post_comments
 for each row execute function conecta_internal.guard_provisional_youth_content();
drop trigger if exists guard_teen_message_insert on public.messages;
create trigger guard_teen_message_insert
 before insert on public.messages
 for each row execute function conecta_internal.guard_provisional_youth_content();
