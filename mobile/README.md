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
  publicação de texto pelo mesmo caminho de moderação do site.
- Conexões: solicitações, aceitar, remover, descobrir e começar conversa,
  usando o RPC existente com verificação de amizade/participação.
- Chat privado e em grupo: inbox, contadores, últimas mensagens, texto,
  recibo de leitura e atualização em tempo real via RLS do Supabase.
- Comunidades: listagem, busca e participar/sair. Detalhes avançados são
  abertos pelo site no navegador.
- Notificações: listagem, atualização em tempo real e marcar como lidas.
- Perfil: exibir foto/capa existente, editar nome/biografia, sair.
- Identidade visual Conecta para Android e iOS, navegação nativa inferior.

**Não incluídos nesta etapa:** chamadas WebRTC nativas, mensagens de voz,
upload de mídia/reels/stories, notificações push APNs/FCM, moderação
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
- Acesso à galeria é somente leitura via links assinados de curta duração.
- O login na página web não compartilha automaticamente cookies com o app:
  após criar/verificar a conta no site, entrar com as mesmas credenciais no app.
- Fotos de usuários e mensagens não são reproduzidas com dados fictícios.
- Logout remove a sessão local; nunca imprimir tokens, SDP ou dados pessoais em logs.

## Diretriz de produto
Evoluir o app e o site lado a lado, reusando as tabelas e regras de negócios
existentes, sem duplicar Supabase nem criar permissões globais para o mobile.
