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
- Stories nativos de até 24 horas: listagem, câmera/galeria, publicação,
  legenda, privacidade, visualização e exclusão pelo autor, com moderação
  no endpoint real do Conecta.
- Comunidades: listagem, busca e participar/sair. Detalhes avançados são
  abertos pelo site no navegador.
- Notificações: listagem, atualização em tempo real e marcar como lidas.
- Perfil: exibir foto/capa existente, editar nome/biografia, sair.
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
11. Teste chat, conexões, notificações, perfil e logout; valide que conteúdo
   privado não aparece após encerrar a sessão.
12. Valide em aparelhos Android e iOS reais. A execução dos testes/TypeScript
   no GitHub não substitui o teste do APK e nem equivale a build iOS assinada.

As partes ainda disponíveis só no site devem permanecer acessíveis sem
fingir que foram implementadas no aplicativo.
