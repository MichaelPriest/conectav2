# Conecta V2 · Android + iOS

Aplicativo **nativo React Native/Expo SDK 57**, mantido no mesmo repositório do
site Next.js. O app utiliza o **mesmo Supabase e as mesmas contas** do Conecta.
Não usa um WebView como interface principal.

## Escopo funcional da primeira versão

- Login real por e-mail e senha do Supabase, sessão persistente no dispositivo.
- Guarda de idade e cadastro igual à do site: contas sem perfil ou declaração
  são encaminhadas ao fluxo web; menores de 18 anos **não entram na rede**.
  A criação de conta permanece no cadastro web protegido (não inventar uma
  verificação nativa que não existe).
- Feed real, com paginação, curtidas, exibição de mídias aprovadas e
  publicação de texto, fotos (até cinco) ou vídeo (um por vez, até 50 MB),
  seleção da galeria/câmera, visualização nativa de vídeo, rascunhos locais
  separados por conta, compartilhamento nativo e favoritos salvos.
  Comentários e respostas usam o fluxo de moderação do site.
- Conexões: solicitações, aceitar, remover, descobrir e começar conversa,
  usando o RPC existente com verificação de amizade/participação.
- Chat privado e em grupo: inbox, contadores, últimas mensagens, texto,
  recibo de leitura e atualização em tempo real via RLS do Supabase.
  Gravação de mensagens de voz com permissão explícita, limite de um minuto,
  upload para o bucket privado do Conecta e reprodução por URL assinada.
  Fotos e vídeos em conversas também são enviados nativamente.
  Respostas citadas, edição e exclusão pelo próprio autor, reações por emojis,
  busca no histórico e paginação estável de mensagens antigas.
- Stories nativos de até 24 horas: listagem, câmera/galeria, publicação,
  legenda, privacidade, visualização e exclusão pelo autor, com moderação
  no endpoint real do Conecta.
- Reels nativos: aba de vídeos públicos, reprodução, curtidas e
  compartilhamento por folha nativa; publicar vídeo permanece no Feed.
- Comunidades: listagem, busca e participar/sair. Detalhes avançados são
  abertos pelo site no navegador.
- Notificações: listagem, atualização em tempo real, marcar como lidas e
  contador de não lidas na barra superior (somente enquanto o app está em uso;
  **não** equivale a notificações push em segundo plano).
- Perfil: alterar foto e capa do perfil pela galeria (até 8 MB),
  editar nome/biografia e sair.
- Identidade visual Conecta para Android e iOS, navegação nativa inferior.

**Não incluídos nesta etapa:** chamadas WebRTC nativas,
publicação nativa de Reels, notificações push APNs/FCM, moderação
administrativa mobile, e certificados de assinatura de distribuição. Os
recursos web continuam disponíveis pelo site; não anunciar paridade total.

## Iniciar em um celular

Requisitos: Node.js 22 LTS, npm, Expo Go atualizado para SDK 57 ou development
build correspondente. O Conecta Web continua funcionando independentemente.

```bash
cd mobile
npm install
npm run typecheck
npm test
npx expo install --check
npx expo start --tunnel
```

Leia o QR pelo **Expo Go** (Android ou iOS) ou execute um emulador local.

As configurações padrão usam a URL oficial do Supabase e uma **chave
publicável** (não privilegiada) do projeto Conecta. Para outros ambientes,
configure `EXPO_PUBLIC_SUPABASE_URL` e
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; nunca use `service_role`.
A variável estática de URL do site de validação está em
`mobile/src/supabase.ts`.

## Builds instaláveis Android e iOS

`mobile/eas.json` prepara um perfil de testes Android APK, um iOS Simulator
e builds de loja. É necessário conectar sua conta Expo via EAS CLI:

```bash
cd mobile
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform android --profile preview
# O iOS Simulator pode ser compilado via EAS, se suportado pelo plano.
npx eas-cli build --platform ios --profile preview
```

Para publicação, são necessários identificadores e certificados de assinatura
definitivos, contas de desenvolvedor Google Play e Apple, políticas legais,
ficha de privacidade, testes de conteúdo gerado por usuários e canais nativos
de denúncia/bloqueio. Um APK não equivale a um aplicativo publicado.

As chamadas web existentes usam WebRTC/Trickle ICE no site; esta primeira
versão nativa **não** afirma oferecer essas chamadas. O trabalho futuro
deverá integrar `react-native-webrtc` em um development build customizado,
e as notificações remotas deverão usar serviços oficiais APNs/FCM com
registro de tokens por dispositivo e disparo autorizado pelo backend.

## Segurança
- Não existe `service_role` no cliente; usa a chave pública + sessão JWT.
- Sem bypass de declaração etária; o banco segue com RLS, antiflood e filtros
  de moderação. Mesmo se a chamada de moderação falhar, uma publicação não
  deverá ser tornada pública pelo app.
- Fotos e vídeos publicados são enviados pelo usuário autenticado para o bucket
  `social-media` e vinculados a `posts` + `post_media`, sob as mesmas políticas
  RLS e moderação do site. Em falhas tenta apagar dados parciais.
- Leitura das mídias usa URLs assinadas de curta duração; as permissões da
  câmera são solicitadas somente após uma ação do usuário.
- O login na página web não compartilha automaticamente cookies com o app:
  após criar/verificar a conta no site, entrar com as mesmas credenciais no app.
- Fotos de usuários e mensagens não são reproduzidas com dados fictícios.
- Logout remove a sessão local; nunca imprimir tokens, SDP ou dados pessoais em logs.

## Diretriz de produto
Evoluir o app e o site lado a lado, reusando as tabelas e regras de negócios
existentes, sem duplicar Supabase nem criar permissões globais para o mobile.

## Build Android sem uma conta Expo paga (GitHub Actions)
Uma workflow manual `.github/workflows/conecta-android-apk.yml` executa
Expo Prebuild + Gradle no GitHub e publica um APK de homologação nos artefatos
da execução. Abra GitHub → Actions → **Conecta V2 · Android APK de testes** →
Run workflow. Se aprovada, baixe o artefato `conecta-v2-android-apk-teste`.
A compilação no runner usa a assinatura de desenvolvimento gerada pelo
projeto, **nunca** certificados definitivos nem assinatura para loja.
Só execute builds quando necessário para controlar os minutos do GitHub.

## Roteiro de homologação — versão Alpha mobile

1. Entre com uma conta **18+ verificada**, depois repita com perfil incompleto
   para confirmar o bloqueio de cadastro e idade.
2. Selecione 1 e 5 fotos, veja as prévias, publique e confirme imagens no
   feed e no site usando a mesma conta. Tente 6 fotos ou arquivo acima de
   50 MB: o app deve recusar.
3. Publique um vídeo com legenda e reproduza no feed nativo; confirme a
   disponibilidade na versão web. Repita com permissão de câmera negada.
4. Comente uma publicação e responda outro comentário. Valide que comentários
   pendentes de moderação não se tornam públicos por ação do aplicativo.
5. Salve uma publicação e confirme a aba **Salvos**; remova e reabra a aba.
6. Escreva uma publicação sem enviar, reinicie o aplicativo e valide o
   rascunho. Envie ou descarte e confirme que o rascunho não reaparece.
7. Troque de conta: o rascunho da conta anterior não deve ser exibido.
8. Crie um Story com foto e outro com vídeo; confira moderação, visibilidade,
   vencimento em 24 horas e exclusão pelo autor.
9. Grave uma mensagem de voz em uma conversa real, envie e reproduza nos dois
   sentidos (Android ↔ site). Confirme que negar microfone não grava nada,
   e que a gravação termina ou é descartada ao deixar a tela.
10. Teste denúncias nativas de publicações e mensagens e a fila de moderação.
11. Abra Reels, reproduza e curta um vídeo público; confirme que vídeos
    privados e de conexões não aparecem nesta seção.
12. Troque foto de perfil e capa pelo celular e confirme a mudança também no
    site. Tente um arquivo maior que 8 MB para verificar a proteção.
13. Teste chat, conexões, notificações, perfil e logout; valide que conteúdo
   privado não aparece após encerrar a sessão.
14. No chat, carregue mensagens antigas; em seguida receba uma mensagem nova e
    confirme que não há duplicação nem desaparecimento do histórico carregado.
    Teste responder, editar, apagar, reagir e remover reação.
15. Busque um termo no histórico da conversa e responda a um resultado;
    confirme que mensagens apagadas não aparecem.
16. Confirme o contador de notificações não lidas e a atualização após
    marcar uma notificação ou todas como lidas.
17. Valide em aparelhos Android e iOS reais. A execução dos testes/TypeScript
   no GitHub não substitui o teste do APK e nem equivale a build iOS assinada.

As partes ainda disponíveis só no site devem permanecer acessíveis sem
fingir que foram implementadas no aplicativo.

## Conecta Mobile 0.4.0 — identidade e navegação

O app nativo agora compartilha os tokens de marca do site (roxo Conecta
`#8055F5`, fundo claro `#F9F9FE`, texto `#16213F`), usa ícones
Lucide/SVG e uma barra inferior de cinco ações: Início, Explorar,
Publicar, Grupos e Perfil. Reels, Conversas e Notificações ficam na
barra superior, sem esconder recursos existentes.

- Feed: capa editorial, Stories, criação em modal, mídias em grade,
  indicadores de curtidas e botões de interação vetoriais.
- Perfil: capa real em destaque, avatar sobreposto, ações de editar foto
  e capa e informações pessoais.
- Comunidades e conexões: cartões com imagens reais, banners com a paleta
  do site, busca e botões consistentes.
- Android: modo de tela imersiva com barra de navegação do sistema oculta,
  tratamento dos recortes da câmera e áreas seguras para os controles.
  O gesto de sistema ainda pode reaparecer conforme a versão do Android
  e o teclado; a navegação do sistema jamais é substituída pelo app.
- Marca: assets reais em `assets/icon.png`, `assets/adaptive-icon.png`
  e `assets/splash-icon.png`, inspirados no símbolo existente do site.
  O ícone só muda **após instalar a nova build**, não por atualização
  dos dados via Supabase.

### Checklist visual obrigatório para Android e iOS

1. Abrir em Android com botões de três teclas e com navegação por gestos;
   confirmar que o menu inferior nunca é coberto pela barra do sistema.
2. Confirmar que nada fica escondido atrás do recorte da câmera,
   barra de status ou indicadores de segurança na parte superior.
3. Abrir e fechar o modal de publicação e os Stories; verificar cabeçalho,
   teclado, botões de publicar/fechar e áreas seguras em cada tela.
4. Testar o launcher após uma instalação limpa: o ícone do Conecta
   (símbolo "C" roxo/azul e ponto rosa) deve aparecer, e a abertura
   deve usar a mesma marca.
5. Conferir telas compactas (largura menor que 360 dp), fontes ampliadas,
   rotação bloqueada e aparelhos com diferentes recortes.
6. Conferir contraste, labels de acessibilidade, teclado de mensagens e
   navegação pelo botão Voltar do Android.
7. Conferir que dados, uploads, moderação e permissões são exatamente os
   mesmos que já funcionavam antes do redesenho.

A CI valida TypeScript, contratos do Supabase e recursos PNG. Homologação
visual e das barras do Android exige o APK em dispositivo físico.

## Alpha 0.5.0 — mais funcionalidades nativas

Esta atualização preserva a UI 0.4.0 (cores, ícones, navegação,
fullscreen e launcher) e substitui novos redirecionamentos ao navegador.

### Comunidades

- Diretório com busca e filtro de participação
- Página nativa com capa, avatar, descrição, regras e número de membros
- Entrada e saída de comunidades sob RLS do usuário autenticado
- Publicações da comunidade com texto, fotos (até cinco), vídeo e enquetes
- Feed paginado com curtidas, comentários, salvos e exclusão de posts próprios
- Criação nativa de comunidades com nome, endereço (slug), descrição e regras
- Moderação compartilhada com o site: nenhuma mídia recebe aprovação direta
- Recursos administrativos avançados continuam disponíveis no site

### Enquetes

- Pergunta de 5 a 250 caracteres, 2 a 6 opções distintas (até 120 caracteres)
- Encerramento em 1, 3, 7 ou 14 dias
- Voto único conforme políticas do servidor; exibição de percentuais
- Utiliza `post_polls`, `post_poll_options`, `post_poll_votes` e
  `poll_results` já existentes, sem tabela paralela
- Enquetes nos posts do feed e nas comunidades

### Marcações, perfil e exclusão

- Sugestões de `@usuário` por handle durante publicações, comentários,
  respostas e mensagens privadas; buscas com debounce e limite de seis pessoas
- Perfil exibe timeline pessoal, curtidas, comentários, salvos e histórico
- Publicações próprias podem ser excluídas pelo aplicativo com confirmação,
  filtragem por autor e limpeza das respectivas mídias no bucket

### Homologação dos novos fluxos

1. Criar uma comunidade, confirmar a entrada e abrir pelo app e pelo site.
2. Entrar, sair e tentar publicar quando não for membro: o app e o RLS devem bloquear.
3. Publicar texto, múltiplas fotos e vídeo numa comunidade; conferir no site.
4. Testar moderação e visualização de conteúdo pendente apenas pelo autor.
5. Criar enquetes no Feed e numa comunidade; votar em contas diferentes e
   confirmar total e percentuais. Impedir segundo voto e prazo expirado.
6. Testar pergunta curta, opções repetidas, mais de seis opções e texto longo.
7. Digitar `@usuário` e escolher sugestão no Feed, comentários e chat;
   confirmar o texto final e que não há consulta antes de dois caracteres.
8. Excluir post próprio com mídia e confirmar remoção no site e no aplicativo.
   Confirmar que não existe botão de exclusão em publicação de terceiro.
9. Visualizar publicações próprias no perfil e carregar posts mais antigos.
10. Testar a mesma versão com Android por gestos e por três botões, conferindo
    o ícone, os recortes da câmera, a barra superior e a barra inferior.

A aprovação dos testes automatizados **não substitui a homologação em
dispositivos reais** nem indica que notificações push e chamadas WebRTC nativas
estejam prontas.
