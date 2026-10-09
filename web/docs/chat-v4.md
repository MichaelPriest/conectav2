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
