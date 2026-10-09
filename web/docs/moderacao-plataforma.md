# Conecta V2 — central de moderação geral (homologação)

## Implementação
- Interface: `/moderacao`, acessível somente a `platform_moderators`.
- Tabela de equipe: `public.platform_moderators`. `role='moderator'` ou `'admin'`.
- Denúncias: `public.safety_reports` mantém a visibilidade do autor da denúncia apenas sobre o seu próprio status.
- Evidências (trecho de no máximo 1200 caracteres) **não** têm `SELECT` para `authenticated`. Somente a função interna `get_safety_moderation_queue`, com verificação de cargo no servidor, libera evidências para a equipe de confiança.
- Histórico: `public.safety_moderation_events`, exclusivamente registrado pela função `review_safety_report`, com old/new status, revisor, data e justificativa.
- Contagens de reincidência por autor de conteúdo denunciado, sem revelar quem enviou a denúncia.
- Revisão/encerramento **não excluem conteúdos**, não liberam menores e não concedem acesso à conversa completa.
- Moderação de comunidades tem permissões e fluxo separados, e NÃO implica acesso à central geral.
- As denúncias gerais atualmente cobrem publicações do feed e mensagens. Denúncias de comunidades seguem `community_reports`.

## Primeiro acesso: autorização explícita pelo operador

Nenhuma conta recebeu o cargo automaticamente nesta implantação.

Execute o comando **somente no SQL Editor do Supabase correto**, autenticado como responsável pelo projeto, após conferir o endereço de e-mail da conta real da equipe. Substitua `E-MAIL-REAL-DO-ADMIN` por um e-mail conhecido e autorizado. Não copie chaves administrativas para o navegador nem use este comando como RPC pública.

```sql
-- Confira primeiro que o usuário é o administrador pretendido.
select p.id,p.handle,u.email from public.profiles p
join auth.users u on u.id=p.id
where lower(u.email)=lower('E-MAIL-REAL-DO-ADMIN');

-- Execute apenas após conferir a correspondência acima.
insert into public.platform_moderators(user_id,role)
select u.id,'admin'
from auth.users u
join public.profiles p on p.id=u.id
where lower(u.email)=lower('E-MAIL-REAL-DO-ADMIN')
on conflict (user_id) do update set role=excluded.role;
```

Para delegar um moderador comum, use `role='moderator'` e confirme a identidade da conta. Para revogar acesso, exclua o registro daquela conta de `platform_moderators` através do SQL Editor. A interface recusa imediatamente as novas requisições feitas por uma conta cujo cargo foi revogado.

## Fluxo de trabalho
1. Abra `/moderacao` autenticado com conta autorizada (atalho "Moderação" aparece na sidebar).
2. Filtre por pendente, em análise, resolvida, arquivada ou todas.
3. Verifique a denúncia e o trecho de evidência, sem buscar mensagens não denunciadas.
4. Inicie análise e, depois, **resolva** ou **arquive**, com justificativa obrigatória de 10 a 500 caracteres.
5. Consulte o histórico para verificar quem tomou a decisão e quando.

A fila retorna até 100 denúncias por consulta, e por enquanto **não** tem paginação ou exportação. Histórico e evidências podem conter dados pessoais: defina política de retenção, controles de confidencialidade e revisão periódica.

## Testes e limites
- Validação transacional em contas reais autorizadas apenas durante o teste, com `ROLLBACK`: negativa para usuário comum, listagem autorizada, início e resolução de denúncia com dois eventos de auditoria. Nenhum papel foi concedido definitivamente.
- Testes com múltiplos navegadores e denúncias reais ainda são necessários.
- Moderação multimídia, ações de remoção de conteúdo, recursos/contestações, escalonamento, SLA e triagem automatizada não estão concluídos.
- Não anunciar conformidade legal completa enquanto não houver política LGPD, moderação efetiva e controles etários confiáveis.
