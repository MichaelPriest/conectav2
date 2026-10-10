# Conecta V2 — auditoria de paridade Web × Mobile

Estado auditado: branch `main`, aplicativo Alpha 0.5.0, em 09/10/2026.
Fonte: arquivos reais sob `web/src/app`, `web/src/components`,
`mobile/App.tsx` e `mobile/src`. **Não** é uma lista de recursos
homologados em dispositivos: a CI só verifica contratos e compilação.

| Área | Web de referência | Situação no app | Próxima entrega |
|---|---|---|---|
| Acesso / sessão | `auth/page.tsx` | Básico pronto | Cadastro, recuperar e redefinir senha nativos |
| Cadastro / Conecta ID | `onboarding`, `verificar-identidade` | Apenas encaminha ao site | Fluxos nativos protegidos, CIN QR, RG e gov.br |
| Feed e publicação | `feed/page.tsx` | Texto, foto, vídeo, salvos, rascunhos, enquetes | Músicas incorporadas, refinamento de menções |
| Comentários | `post-card.tsx` | Comentar e responder | Ligação com perfis, recursos/revisão quando rejeitado |
| Publicações próprias | `perfil`, `profile-timeline` | Timeline e exclusão básica | Página nativa individual de post e compartilhamento via link profundo |
| Galeria / mídia | `post-card.tsx` | Grade e vídeo | Visualizador em tela cheia com swipe, zoom e navegação |
| Pessoas / conexões | `conexoes/page.tsx` | Amizades, convites recebidos, descoberta | Convites enviados, perfis públicos completos e bloqueio/desbloqueio |
| Descoberta global | `explorar/page.tsx` | Busca de pessoas e comunidades em áreas distintas | Busca unificada: pessoas, comunidades, posts, vídeos |
| Perfis | `perfil/page.tsx`, `p/[handle]` | Editar nome/bio, foto/capa, posts próprios | @handle, headline, localização, site, interesses, emoji, humor |
| Identidade MySpace | `myspace-panel`, `music-embed` | Ausente | Layout/tema, música, MySpace e presença social |
| Comunidades | `comunidades/[slug]/page.tsx` | Entrar/sair/criar/ver regras/posts/votar | Alterar dados/capa/avatar e controles do proprietário |
| Administração de comunidades | `comunidades/[slug]/moderar` | Ausente | Moderadores, cargos, denúncias, banimento, termos de revisão |
| Chat privado e grupos | `mensagens/page.tsx` | Inbox, mensagens/mídias/áudio, reply, reactions, editar/apagar, buscar | Criar grupos, convites, cargos, membro/papel, conversa arquivada |
| Conversas avançadas | `mensagens/page.tsx` | Leitura e paginação | Digitando, online/ausente, silenciar, fixar mensagem, recibos por participante |
| Chamadas WebRTC | `chat-calls.tsx` | Ausente | Áudio e vídeo no game app, chamada recebida, toque, perdido, TURN |
| Notificações | `notificacoes/page.tsx`, `chat-push-control` | Lista e badge em primeiro plano | Push Android/iOS em segundo plano, deep-links dos alertas |
| Stories | `story-ui` e `stories` | Captura, visualização, publicação, exclusão | Alinhar visualizações e interações específicas do site |
| Reels | `reels/page.tsx` | Visualizar, curtir e compartilhar | Tela de criação nativa contextual e navegação ao post/comentários |
| Moderação geral | `moderacao/page.tsx` | Somente denunciar; bloqueios continuam no servidor | Central administrativa, fila de denúncias, decisão/recurso |
| Segurança pessoal | `p/[handle]/page.tsx` | Sem interface de bloqueios | Bloquear/desbloquear pessoas e gerenciar privacidade |
| Espaço de apoio | `acolhimento/page.tsx` | Ausente | Área de mães atípicas / acolhimento e modo calmo |
| Publicidade discreta | `feed/page.tsx` e outros componentes web | Sem espaços publicitários no nativo | Modelo discreto com conformidade Play/App Store |
| Atualizações | `mobile/src/update-ui.tsx` | Verificação Android/iOS ao abrir | Publicação de versões estáveis e mesma assinatura Android, OTA EAS |
| Distribuição de loja | `mobile/eas.json` | APK Alpha para testes | Google Play, App Store, assinatura definitiva, políticas e testes físicos |

## Próximas prioridades

**P0 — Essencial antes do lançamento**
1. Registrar tokens APNs/FCM por dispositivo, push real e redirecionamentos seguros.
2. Chamadas WebRTC de áudio/vídeo, toques e permissões com TURN operacional.
3. Cadastro, recuperação de senha e verificação de identidade no fluxo mobile.
4. Assinatura Android permanente, canal de distribuição pública e publicação dos APKs.
5. Homologação de conteúdo, moderação, segurança e UX em Android/iOS reais.

**P1 — Paridade social**
6. Gerenciamento de grupos (criar, convidar, membros/cargos), typing, presença e silenciar/fixar.
7. Perfis públicos e bloqueio/desbloqueio nativos, busca global, notificações clicáveis.
8. Personalização de perfis (temas, música, MySpace), mídia em tela cheia.
9. Administração de comunidades e envio de capa/avatar.

**P2 — Diferenciação e operação**
10. Acolhimento/mães atípicas e acessibilidade com modo calmo.
11. Publicação contextual de Reels, melhorias adicionais de Stories e menções.
12. Publicidade limitada e transparente, se aprovada nas lojas.

## Atualização de versões

A partir da versão que incorporar o verificador
(`mobile/src/update-ui.tsx`), no Android o app consultará ao iniciar e
retomar a frente as releases **públicas, não draft** do repositório GitHub.
Somente uma release com tag `mobile-vX.Y.Z` contendo um arquivo
`conecta-v2-android-<versão>.apk` de no mínimo 2 MB, e hospedado sob
`github.com/MichaelPriest/conectav2/releases/download/`, é aceita.
No iOS a consulta é feita à listagem oficial da App Store pelo bundle ID
`br.com.conectav2.app`, quando o app for publicado lá.

* Os artefatos do GitHub Actions **não** bastam: são temporários e o
  instalador só deve vir de uma release oficial.
* O Android exige aprovação do usuário para instalar ou atualizar APK.
* A atualização só instala por cima se a assinatura do novo APK for a
  mesma da versão anterior. Devemos definir um **keystore permanente**.
* `expo-updates`/EAS Update para JS e imagens ainda exige configurar o
  projeto Expo e o canal de atualização. Não há serviço OTA ativo.
* Quando não há publicação válida ou a rede está indisponível, o
  aplicativo continua funcionando normalmente, sem falsa notificação.

### Checklist para publicação do próximo APK

- Incrementar `expo.version`, `android.versionCode` e `ios.buildNumber`
- Executar `npm test`, `npm run typecheck`, `npx expo install --check`
- Homologar no celular e confirmar a assinatura de distribuição consistente
- Publicar GitHub Release `mobile-v0.6.0` (exemplo) com APK
  `conecta-v2-android-0.6.0.apk`, usando um instalador **estável**
- Testar um celular com versão anterior e verificar o alerta na abertura
- Testar recusa, perda de conexão, URL alterada e relançamento do app
- Depois configurar EAS Update para JS compatível com a mesma versão nativa
