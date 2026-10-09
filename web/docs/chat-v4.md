# Conecta V2 — Chat V4: conexões, grupos e avisos

Data: 9 de outubro de 2026.

## Lista de conexões com fotos reais

Na aba **Mensagens**, cada amizade aceita aparece em **Minhas conexões** com imagem de perfil, nome exibido e @usuário. Existe filtro por nome/handle e um clique na linha reutiliza a conversa individual ou cria uma nova usando `create_conversation_with_members` (que valida amizade, bloqueio e participação). A caixa de entrada existente continua independente da lista de contatos.

O **widget flutuante** também exibe foto, nome e @usuário em conexões, além de mostrar avatares nas conversas individuais existentes. A busca filtra contatos localmente; não expõe perfis de pessoas não conectadas.

A seleção para **criar grupos** também recebeu avatar e nome. Carregar avatar utiliza o mesmo `ProfileAvatar` do site, que gera URL assinada pelo Supabase e não abre um bucket público.

## Grupos

- `conversations.is_group` persiste a identidade de grupo mesmo se cair para dois participantes. Em conversas privadas permanece `false`.
- O criador pode transferir a administração para qualquer membro atual. A operação é atômica e apenas o administrador autenticado pode executá-la.
- Quem não é criador pode sair; o criador deve transferir antes de sair. Um trigger impede burlar a obrigação pela operação direta de exclusão de membro.
- Convites continuam limitados a conexões aceitas sem bloqueios; o limite continua em 21 pessoas por grupo, com proteção etária verificada.
- Grupos ainda não têm chamadas de voz/vídeo nem ferramentas completas de coadministração.

## Notificações opcionais no navegador

O chat flutuante permite ativar/desativar **notificações locais** após consentimento do navegador. O aviso é genérico, sem conteúdo da mensagem nem remetente, e respeita conversas silenciadas. Funciona apenas quando a aplicação está conectada e aberta em uma aba; **não é push com aplicação fechada**.

## Antispam de mensagens

O Supabase rejeita a terceira cópia idêntica de um texto dentro de 30 segundos e limita a 18 mensagens por minuto por conta/conversa, com transação serializada por remetente. Não depende de serviços pagos e não envia mensagens privadas a IA externa.

## Validação e limites

Testes SQL em transações revertidas cobrem iniciar conversa legítima entre perfis reais já conectados, rejeitar terceira mensagem duplicada e impedir manipular `is_group` no INSERT. Ainda não há terceira conta para validar visualmente transferência e administração com múltiplos integrantes, e os testes end-to-end em diferentes navegadores permanecem pendentes. Os anexos e dados de mensagens seguem protegidos pelas políticas RLS do Supabase, mas não oferecem criptografia de ponta a ponta. A licença dos modelos de moderação não implica que a hospedagem seja ilimitada.

## Moderação pelos administradores — atualização

O criador do grupo pode remover um integrante pelo painel de configurações. A remoção é realizada
pelo RPC `remove_conversation_group_member` com autenticação obrigatória, verificação de
propriedade, identidade de grupo e participação atual; membros comuns não podem remover
outras pessoas. A operação remove a participação e o indicador de digitação, mas não apaga
o histórico para os demais integrantes. Ainda não há coadministradores.

## Sincronização entre dispositivos

Alterações de membros e títulos/grupos são publicadas no Supabase Realtime. O chat principal
e o widget recarregam as conversas em convites, remoções e atualizações do grupo, com
revalidação ao voltar para a aba como fallback para eventos perdidos. A paginação conserva
o histórico antigo durante novas mensagens e preserva a posição da leitura ao carregar
mensagens anteriores.

### Proteção contra divulgação por eventos DELETE

Não há assinatura de `DELETE` em `conversation_members`: no Realtime, esses eventos
não permitem validar o antigo registro via RLS. Entradas e atualizações chegam por
eventos com checagem de acesso; saídas e remoções são reconciliadas por consulta
protegida por RLS a cada 45 segundos quando a página está visível ou ao retornar
para a aba. Isso prioriza a privacidade em vez de prometer entrega instantânea.

## Chat V4.1 — coadministradores e permissões

O proprietário pode promover ou revogar coadministradores existentes. Pode controlar
se eles convidam conexões aceitas (ativado inicialmente) e se removem integrantes comuns
(desativado inicialmente). Mesmo quando habilitada a remoção, o coadministrador não pode
remover o proprietário nem outros coadministradores, e não pode editar o título,
promover integrantes nem transferir a propriedade. A tabela de permissões fica no
schema privado `app_private`, com FK de exclusão em cascata à participação, sem
escrita direta do navegador. As mudanças ocorrem por RPC autenticado, que valida
participação, propriedade e configurações no banco com bloqueio por conversa.
As restrições de amizade aceita, bloqueio, proteção de adolescentes e máximo 21
membros seguem preservadas para todos os convites. A interface revalida as permissões
após ações e ao retornar à aba.

## Integridade das conversas

Além da validação nos RPCs, um par de gatilhos protege a tabela de participantes
contra alterações diretas via API: antes de inserir, a conversa é bloqueada
transacionalmente; ao concluir a transação, valida-se o teto de 21 participantes,
a quantidade máxima de duas pessoas nas conversas privadas e a restrição de
grupos que incluam contas no modo de proteção etária. A validação final é
*adiada* para permitir o fluxo legítimo de criação de grupo (primeiro cria
participantes e depois marca a conversa como grupo, tudo na mesma transação).

## Chat V4.2 — evitar duplicação de conversas privadas

O RPC `create_conversation_with_members` valida a amizade e o bloqueio mesmo
ao localizar uma conversa já existente. Para um único destinatário, usa uma chave
de bloqueio transacional independente da ordem dos dois usuários, procura a
conversa privada existente (exatamente dois integrantes e `is_group=false`)
e reutiliza o ID em vez de criar conversas duplicadas. Criação de grupos mantém
o fluxo atômico anterior. Conversas duplicadas legadas não são apagadas e não
sofrem merge automático para evitar perda de histórico.

## Web Push opt-in — Chat V4.3 (gratuito, sem conteúdo privado)

O mensageiro tem agora infraestrutura Web Push baseada em padrões abertos, Service Worker
`/sw-chat-push.js` e biblioteca livre `web-push` (VAPID). Cada dispositivo
assina individualmente, o servidor exige JWT autenticado para associá-lo e remove
a inscrição ao desativar ou sair da conta. Um cadastro de outro usuário no mesmo
dispositivo substitui a associação anterior ao mesmo endpoint. Não há acesso
de usuários às chaves de inscrição pela Data API: elas ficam em tabela privada
ao navegador, com RLS, disponíveis apenas ao backend service_role.

Ao enviar uma mensagem, o remetente autentica sua chamada de dispatch por JWT;
o backend confirma autoria, conversa, idade da mensagem, participação e bloqueios,
respeita silenciamento e leitura já registrada. A chave primária por mensagem
impede push repetido em múltiplas abas. O Service Worker apresenta exclusivamente
`Conecta · Nova mensagem` / `Você recebeu uma nova mensagem.`. O backend não
repassa texto de DM, nomes, IDs de conversa, fotos ou anexos a gateways push.

**Ativação operacional necessária:** configurar no servidor a chave de serviço do
Supabase, `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY` e
`WEB_PUSH_VAPID_SUBJECT=mailto:<email de contato>`. Gere as chaves uma única vez
com `npx web-push generate-vapid-keys` e mantenha a privada apenas nas variáveis
secretas do Render/Vercel (nunca no GitHub ou em `NEXT_PUBLIC_`).
Com configuração incompleta, `GET /api/chat/push/config` retorna
`{enabled:false,publicKey:null}`, e o controle de Push fica desabilitado,
sem fingir envio. O navegador deve suportar Push API e contexto HTTPS; no
iPhone/iPad o Web Push pode requerer instalação como app na tela inicial.

**Limitações:** no primeiro estágio o envio de push é solicitado pelo navegador
do *remetente* após a gravação da mensagem. O destinatário pode estar com o
navegador fechado, mas, se o remetente desconectar antes do dispatch, a notificação
não é garantida. O envio é at-most-once (não há fila/retries). Isso é distinto
das notificações locais anteriores, que dependem de aba aberta. Os gateways de push
são limitados a provedores HTTPS permitidos para prevenir SSRF, e o envio é
best-effort dentro das cotas gratuitas do provedor e hospedagem. A entrega real
de ponta a ponta exige validar o deploy com as chaves configuradas e uma
assinatura real de navegador; testes de CI cobrem funções e regras de privacidade.

### Controles no chat principal e prevenção de avisos duplicados

O Web Push pode ser ativado no widget ou no cabeçalho do mensageiro completo.
Se a aba conectada detectar uma inscrição Push existente neste dispositivo,
não cria uma segunda notificação local da mesma mensagem; a notificação Web Push
tem prioridade. Sem inscrição real, os avisos locais continuam disponíveis.

### Ativação de chaves Web Push (10/10/2026)

As três variáveis `WEB_PUSH_VAPID_*` foram configuradas como variáveis
protegidas na Vercel de produção, em conjunto com
`SUPABASE_SERVICE_ROLE_KEY` que já existia neste projeto.
O assunto VAPID é `https://conectav2-validacao.onrender.com`, formato
HTTPS válido segundo o padrão; `mailto:` também é aceito. A variável
`SUPABASE_SECRET_KEY` (novo padrão `sb_secret_`) é compatível com o
backend, preservando a antiga chave service_role como fallback.
Não colocar os valores secretos em commits, prints ou mensagens.

O aplicativo confirma no banco que a inscrição pertence à conta
autenticada antes de mostrar a opção como ativa; isso evita um
falso status de sucesso ao alternar contas no mesmo navegador.
O envio de aviso ao servidor usa `keepalive` como melhora
de confiabilidade durante navegação da aba.

O Render ainda exige a configuração do mesmo par no ambiente do serviço
e um novo deploy. O par não deve ser regenerado separadamente para
cada hospedagem: isso invalidaria assinaturas existentes quando o
domínio fosse atendido por servidores diferentes.
