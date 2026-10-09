# Moderação do Conecta V2 — código aberto + API gratuita

**Estado da integração (09/10/2026):** fontes, rotas, banco e revisão humana implementados. **Não afirmar que os modelos estão ativos sem configurar um provedor.** A implantação do worker de ML não faz parte da instância web Render; usa infraestrutura própria com capacidade de CPU/RAM.

## Opções gratuitas verificadas
1. **API OpenAI `omni-moderation-latest`**: moderação de texto e imagem gratuita **para usuários da API**; exige uma chave de API, conectividade e conformidade de privacidade. Algumas categorias só aceitam texto. **Não suporta vídeo ou áudio.** Proibido enviar material conhecido/suspeito de CSAM para o endpoint.
   - https://developers.openai.com/api/docs/guides/moderation
   - https://help.openai.com/pt-br/articles/4936833-is-the-moderation-endpoint-free-to-use
2. **Texto open-source:** https://huggingface.co/unitary/multilingual-toxic-xlm-roberta (Apache 2.0, cerca de 1,1 GB de pesos). Reconhece toxicidade em textos multilíngues, mas não verifica identidade, idade, fraude ou todas as situações de abuso.
3. **Imagem open-source:** https://huggingface.co/Falconsai/nsfw_image_detection (Apache 2.0, cerca de 343 MB de pesos safetensors). Classifica NSFW; não substitui análise específica de violência, abuso infantil e contexto.
4. **Vídeo open-source:** FFmpeg/ffprobe permitem extrair quadros para o classificador visual. Os quadros não representam necessariamente o vídeo todo: **o Conecta não aprova vídeos automaticamente só pela amostragem**.

Os pesos não são incluídos no GitHub; o worker os baixa no momento de execução. **Grátis em licença não significa hospedagem grátis**: a execução local pode exigir vários GB de memória, armazenamento e CPU.

## Fluxo efetivamente implementado
- Supabase `posts`: gatilho protege **novas** fotos/vídeos e textos sinalizados, `moderation_status=pending`; RLS mantém conteúdo pendente visível apenas para o autor ou moderação habilitada. `post_media` não aceita adicionar galeria após a aprovação.
- Supabase `stories`: novos Stories iniciam `pending` e só podem ser vistos por terceiros após aprovação. A proteção de idade e bloqueios existentes permanece.
- `POST /api/moderation/review`: autentica usuário, consulta objeto real e seus anexos pela identificação no banco. Nunca confia em `status=approved` enviado pelo navegador. Com `OPENAI_API_KEY`, verifica texto e fotos via API gratuita. Com `CONEXA_MODERATION_WORKER_URL` e `CONEXA_MODERATION_WORKER_TOKEN`, chama o serviço isolado com modelos abertos (tem precedência). O modelo sinaliza suspeitas para revisão humana. A IA genérica nunca analisa material conhecido/suspeito de CSAM.
- Fotos com verificação ampla válida podem ser aprovadas; se o provedor falha ou não existe, **ficam pendentes**. Resultados do worker limitado a toxicidade/NSFW não liberam imagens automaticamente. Vídeos também exigem revisão humana.
- Comunidades: a aprovação manual existente da própria comunidade continua predominante; uma classificação não pode ultrapassar suas regras.
- `post_comments`: novos comentários e respostas entram em revisão obrigatória, inclusive via inserção direta no Supabase. O autor continua podendo vê-los; outras pessoas só recebem o conteúdo e notificações após aprovação. A `POST /api/moderation/comment` analisa texto na API gratuita se houver chave de API; com worker limitado a toxicidade, mantém revisão humana. Falhas de IA não aprovam conteúdo.
- `get_pending_comments` / `review_pending_comment`: filas separadas para moderadores gerais e moderadores autorizados de cada comunidade, com aprovação/rejeição e auditoria `comment_moderation_events`. O comentário aprovado dispara a notificação permitida apenas após a decisão.
- `/moderacao`: equipe com cargo `platform_moderators` pode consultar posts do feed e Stories pendentes, visualizar anexos por URL assinada de duração curta, aprovar/rejeitar com justificativa e registro em `content_moderation_events`. Denúncias de texto e mensagens continuam na fila separada `safety_reports`.
- Novas postagens com mídia sem modelo habilitado **não ficam públicas** até que um moderador autorizado as revise. Nenhuma chave secreta fica em `NEXT_PUBLIC_*`.

## Configuração server-side (NUNCA incluir segredo em código)
**Caminho recomendado para começar sem hospedar modelos:**
- No serviço **Render de homologação**, configurar `OPENAI_API_KEY` (chave da API OpenAI, não a credencial do ChatGPT). A moderação API é gratuita para usuários da API conforme documentação oficial; disponibilidade de conta/créditos/limites deve ser confirmada no provedor.
- As rotas também exigem `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e **servidor** `SUPABASE_SERVICE_ROLE_KEY` já usados pelo projeto. Não transmitir a chave service-role ao navegador.
- Para modo 100% open-source no servidor próprio, usar `moderation-worker/Dockerfile`, proteger por HTTPS privado, definir `CONEXA_MODERATION_WORKER_URL` e `CONEXA_MODERATION_WORKER_TOKEN` no Render. O serviço tem precedência sobre OpenAI.
- Para dar acesso à fila, designar uma conta real à tabela `platform_moderators` **após conferir identidade**. Nunca dar permissões automaticamente ao nome do perfil nem confiar em `user_metadata`.

## Operações, privacidade e limites
- Não usar o sistema de ML como prova de idade ou identidade. Para menores valem as restrições etárias já existentes e medidas adicionais ainda em desenvolvimento.
- A moderação de mensagens privadas fica prioritariamente baseada em denúncias; **não** enviar toda conversa privada a serviços externos por padrão. Falta um consentimento adequado, política de retenção para evidências e fluxo de escalonamento.
- Comentários já possuem fila e triagem opcional, mas ainda faltam detecção multimodal, avatares, capas, áudios e arquivos privados com consentimento e privacidade. Os resultados não devem ser chamados de "moderação completa 100%" antes disso, nem se devem remover conteúdos automaticamente por um escore.
- O caso de fotos e vídeos classificados como críticos pode exigir equipe treinada, políticas de proteção infantil e protocolos de notificação compatíveis com a legislação.
- Verificar HTTPS/isolamento da API de worker, modelos e seus datasets/licenças, taxas de falsos positivos e falsos negativos, sotaques em português, conteúdo sobre deficiência e inclusão, privacidade LGPD, apelações e política de retenção.
- Para auditar qualidade, testar com conteúdo real consentido e autorizado, sem criar ou armazenar imagens nocivas para fins de teste.
