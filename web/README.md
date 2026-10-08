# Conecta V2 — nova aplicação

Nova implementação isolada em **Next.js 16 + React 19 + TypeScript + Supabase PostgreSQL**.
O site antigo na raiz do repositório foi preservado como referência; **nenhum dado Firebase é importado**.

## Preparar

1. Criar um projeto Supabase **exclusivo para Conecta**.
2. No SQL Editor do projeto, executar o arquivo \`../supabase/schema.sql\` (o SQL ainda não foi executado).
3. Em Authentication, configurar URL de redirecionamento e confirmação de e-mail.
4. Copiar \`.env.example\` para \`.env.local\` e preencher URL e **chave publicável**.
5. Executar \`npm install\`, \`npm run dev\`. Para produção, configurar Vercel com Root Directory = \`web\`.
6. Testar cadastro, confirmação de e-mail, login, posts públicos/privados, likes, comentários e RLS entre **duas contas reais** antes de publicar.

### Segurança e privacidade
- Nunca usar \`service_role\` ou chave secreta no browser.
- Não reutilizar dados ou usuários do Firebase antigo.
- Posts \`friends\` são autorizados no PostgreSQL por amizades aceitas, não no cliente.
- Bucket \`social-media\` privado, upload por pasta de usuário, mídia por URL assinada.
- Nenhuma mensagem ou notificação fictícia.
- Manter banco e Storage antigos até a retirada do site legado ser aprovada.

### Etapas
**Nesta branch:** esquema inicial, autenticação e feed, perfis, comunidades e correções de segurança.
**Depois:** conversas em tempo real, notificações geradas pelo backend, moderação, busca, observabilidade, processamento de vídeo e anti-spam.

### Limites
O PostgreSQL é escalável, mas hospedagem, backups e transferências têm limites e custos. O plano grátis não é ilimitado.

## Fidelity to approved concept (October 2026)
- Landing page: brand mark, concept laptop and mobile device presentations (illustrative only, not actual user posts).
- Actual app: unified desktop sidebar/top search and mobile navigation; feed composer, media cards, featured communities, visual Explore/Communities, notifications and messaging.
- All functional community/person/post views use real database queries; no fabricated user counts or fake posts.
- Conecta V2 Vercel project **preview auto deployments disabled** during active development to conserve build quota; explicitly re-enable when ready to test a consolidated candidate.
- After deploying: verify the design against the approved art on 1440px desktop, 768px tablet and 390px mobile, then iterate visual differences.

### Atualização da rede social
- O banco Supabase do Conecta recebeu `gallery_and_notifications`: galeria privada para até cinco fotos e notificações geradas por gatilhos seguros.
- O feed mostra mosaicos reais de imagens; a URL direta de uma publicação é `/post/[id]`.
- O armazenamento de mídias é privado, com URLs temporárias por permissão de leitura no PostgreSQL.
- O banco requer usuários reais para testes ponta a ponta de upload, curtidas, comentários e amizades.
- Previews automáticos da Vercel estão desativados no projeto `conectav2`, evitando builds repetidos durante desenvolvimento.
