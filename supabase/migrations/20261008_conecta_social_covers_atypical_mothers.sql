-- Applied to Conecta Supabase opdlxxrcdsxqmlhgayfm (2026-10-08).
-- Covers reuse the existing private social-media bucket.
alter table public.profile_details add column if not exists cover_path text;
alter table public.profile_details add constraint profile_details_cover_owned
 check (cover_path is null or (cover_path like user_id::text || '/covers/%' and length(cover_path) <= 250));
create policy "authenticated view profile covers" on storage.objects for select to authenticated
using (bucket_id='social-media' and exists(
 select 1 from public.profile_details d where d.cover_path=storage.objects.name and not exists(
  select 1 from public.user_blocks b where
   (b.blocker_id=d.user_id and b.blocked_id=(select auth.uid()))
   or (b.blocker_id=(select auth.uid()) and b.blocked_id=d.user_id)
 )
));
create policy "authenticated view community artwork" on storage.objects for select to authenticated
using (bucket_id='social-media' and exists(
 select 1 from public.communities c where c.cover_path=storage.objects.name or c.avatar_path=storage.objects.name
));
-- Official category only; do NOT seed accounts, posts or artificial membership.
insert into public.communities(owner_id,is_official,slug,name,description,rules) values (
 null,true,'maes-atipicas-rede-apoio','Mães Atípicas · Rede de Apoio',
 'Espaço de acolhimento entre mães, cuidadores e famílias de pessoas com deficiência ou neurodivergência. Troque experiências, rotinas e estratégias de inclusão sem julgamentos.',
 'Acolhimento e respeito. Não compartilhe nomes completos, documentos, laudos, fotos ou localização de crianças sem a devida autorização. Não publique diagnósticos de terceiros. Conselhos de saúde não substituem profissionais. Não são permitidos assédio, capacitismo, exposição de menores ou publicidade de tratamentos milagrosos.'
) on conflict(slug) do nothing;
