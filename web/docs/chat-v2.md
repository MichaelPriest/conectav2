# Conecta · Chat V2

Atualizado em 9 de outubro de 2026, branch `main`.

## Novos recursos
- Resposta contextual a uma mensagem anterior, com vínculo `messages.reply_to` validado no banco. O usuário não pode referenciar mensagens de outra conversa, apagadas, nem alterar a referência posteriormente.
- Reações rápidas ❤️ 👍 😂 😮 😢 👏 com seleção/remoção própria, sincronizadas por Supabase Realtime. A tabela `message_reactions` usa RLS: somente membros podem ver ou reagir a mensagens não excluídas.
- Contadores de não lidas na caixa de entrada e no chat flutuante. `my_conversation_unread_counts` considera mensagens de outros membros após o último recibo, sem revelar conversas alheias.
- Busca de texto pelo histórico completo via `search_my_conversation_messages`, com autenticação e verificação de participação. Nunca é enviada a motor externo.
- Prévia eficiente da última mensagem de cada conversa via `my_latest_conversation_messages`, sem `LIMIT 200` global que prejudicava conversas com menos atividade.
- Interface responsiva: no celular, a lista e a conversa ocupam telas separadas, com retorno à caixa de entrada.
- Widget flutuante sincronizado com prévias, estado de leitura e avisos de mensagens novas.

## Segurança e limites
- Mensagens privadas não são classificadas por IA externa por padrão. Somente mensagens denunciadas podem seguir o fluxo de denúncia já existente, segundo a política de privacidade.
- RLS e funções com `auth.uid()` garantem acesso apenas a participantes. A busca não retorna registros deletados; não é uma busca global sobre contas.
- Não há criptografia de ponta a ponta: mensagens continuam no Supabase com controle de acesso, portanto evite alegar E2EE.
- Ainda faltam chamadas de áudio/vídeo, recursos completos de criptografia ponta a ponta, prevenção avançada de spam em DMs e testes multi-dispositivo reais.
- Testes de banco feitos em transações revertidas com duas identidades reais: contador, resposta na mesma conversa, reação, proibição de falsificação de autoria e busca de dados de conversa não autorizada.

## Mudanças do banco
Migrations `20261009_conecta_chat_reply_reactions_unread.sql`, `20261009_conecta_chat_private_search.sql`, `20261009_conecta_chat_latest_inbox_rpc.sql` e `20261009_conecta_chat_reactions_realtime.sql`.
