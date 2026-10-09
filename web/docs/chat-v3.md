# Conecta V2 — Chat V3

Atualizado em 9 de outubro de 2026.

## Funcionalidades

- **Digitando agora:** presença efêmera por conversa, atualizada em intervalos e expirada pelo banco em 7 segundos. Conteúdo de texto não é enviado à tabela de presença. Apenas participantes autenticados conseguem consultar o estado de outros.
- **Silenciar conversa:** preferência individual `conversation_members.muted_until` por 30 dias, reversível. No chat flutuante, conversas silenciadas não aumentam o total de badges de não lidas; as próprias mensagens e contagens individuais continuam acessíveis e não são apagadas. Não promete controle global de push ou e-mail.
- **Mensagens fixadas:** até três por conversa, apontando apenas a mensagens não apagadas da mesma conversa. Em grupo, somente o criador fixa/desafixa; em conversa individual, ambos podem fazê-lo. Atualização entre clientes por Supabase Realtime e RLS.
- **Configurações de grupos:** o criador pode renomear o grupo e convidar amizades aceitas, até 21 participantes. Membros não podem ganhar permissões de administração manipulando o navegador.
- **Responsividade:** o chat principal e o widget flutuante mostram indicadores com nomes (principal) ou sinalização genérica (widget), preservando o fluxo móvel já implementado.

## Modelo de privacidade

Supabase Auth e funções SQL validam participação real nas conversas. A tabela de digitação não contém o texto digitado e as reações/mensagens continuam privadas. O chat **não oferece criptografia de ponta a ponta**. Mensagens privadas não são classificadas automaticamente por serviços externos de IA.

## Verificações

Transações de teste com duas identidades reais existentes (revertidas, sem dados persistentes) confirmaram: presença para participantes; eliminação da presença; usuário externo impedido de sinalizar digitação ou fixar mensagens; leitura privada de pins/presença; limite de fixação por função RPC; silenciamento de usuário; imutabilidade de identidade de membros; impossibilidade de renomear conversa privada como grupo. Não há contas suficientes atualmente para ensaio multiusuário real de administração com três integrantes; a lógica de grupos foi validada por CI de compilação e precisa de ensaio de interface com três perfis autorizados.

## Pendências

- Recursos de sair do grupo, transferência de administração, notificações push e chamadas de voz/vídeo.
- Testes práticos em dois dispositivos ou navegadores ao mesmo tempo.
- Testes de carga do Supabase Realtime e uso de recursos da hospedagem gratuita.

## Migrações

`20261009_conecta_messenger_v3_typing_mute_pins_groups.sql`,
`20261009_conecta_messenger_v3_secure_typing_rpc.sql`,
`20261009_conecta_chat_v3_pins_realtime.sql`.
