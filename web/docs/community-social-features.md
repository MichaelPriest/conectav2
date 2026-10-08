# Conecta — implementações desta rodada

## Ativo no banco e código (8 de outubro de 2026)
- `post_comments.parent_id` e trigger de integridade de respostas (até 1 nível).
- Enquetes por publicação com 2 a 6 opções, 1 voto por usuário e prazo de encerramento.
- Publicações salvas, privadas e sujeitas ao RLS do post.
- Comunidades com capa, ícone, regras, publicação de fotos (até 5), vídeo (1), enquetes e respostas.
- Perfil com abas de publicações, fotos, vídeos e salvos.
- Espaços para publicidade identificados, vazios e sem rastreamento/segmentação.
- Human v3.3.6 executado **apenas no navegador** mediante consentimento, sem envio de selfie/template biométrico.
- Human é um **experimento de detecção facial e indicadores de vivacidade**, NÃO prova legal de identidade ou idade.

## Limites e próximos controles de segurança
- Ainda faltam mecanismos confiáveis de aferição de idade, vínculo parental e regras de segurança adicionais para permitir adolescentes.
- Enquetes, comentários e mídia precisam de testes de ponta a ponta com contas reais.
- Human carrega modelos de fonte externa; revisar disponibilidade/CDN e CSP.
- Publicidade direcionada a menores não foi implementada; apenas espaço visual neutro.
- Stories efêmeras, moderação de comunidade, anúncios comerciais e upload por admins oficiais continuam no roadmap.
- GitHub `main` é a fonte; Render só para homologação, Vercel não acionada.
