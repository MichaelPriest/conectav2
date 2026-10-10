# Conecta V2 — auditoria de paridade Web × Mobile

Estado auditado: branch `main`, aplicativo Alpha 0.7.0, em 09/10/2026 (validação automatizada).
Fonte: arquivos reais sob `web/src/app`, `web/src/components`,
`mobile/App.tsx` e `mobile/src`. **Não** é uma lista de recursos
homologados em dispositivos: a CI só verifica contratos e compilação.

| Área | Web de referência | Situação no app | Próxima entrega |
|---|---|---|---|
| Acesso / sessão | `auth/page.tsx` | Login e solicitação nativa de recuperação; redefinição segura pelo Web | Cadastro e conclusão nativa de recuperação |
| Cadastro / Conecta ID | `onboarding`, `verificar-identidade` | Apenas encaminha ao site | Fluxos nativos protegidos, CIN QR, RG e gov.br |
| Feed e publicação | `feed/page.tsx` | Texto, foto, vídeo, salvos, rascunhos, enquetes | Músicas incorporadas, refinamento de menções |
| Comentários | `post-card.tsx` | Comentar e responder | Ligação com perfis, recursos/revisão quando rejeitado |
| Publicações próprias | `perfil`, `profile-timeline` | Timeline e exclusão básica | Página nativa individual de post e compartilhamento via link profundo |
| Galeria / mídia | `post-card.tsx` | Grade, vídeo e visualizador de imagens em tela cheia com ampliação e navegação | Gestos avançados/zoom por pinch em todos os Androids |
| Pessoas / conexões | `conexoes/page.tsx` | Amizades, convites recebidos/enviados, descoberta e bloqueio/desbloqueio | Perfis públicos completos e filtros avançados |
| Descoberta global | `explorar/page.tsx` | Busca unificada por pessoas, comunidades, publicações e vídeos | Ranking, busca remota paginada e filtros avançados |
| Perfis | `perfil/page.tsx`, `p/[handle]` | Perfis públicos com capa, posts, interesses e ações; editor nativo de headline, cidade, site, emoji, humor, música, temas e layout | Ajustes finos de visualização MySpace e player incorporado |
| Identidade MySpace | `myspace-panel`, `music-embed` | Campos MySpace, temas, status e música editáveis; sem player incorporado | Player seguro, estilos completos e pré-visualização |
| Comunidades | `comunidades/[slug]/page.tsx` | Entrar/sair/criar/ver regras/posts/votar | Alterar dados/capa/avatar e controles do proprietário |
| Administração de comunidades | `comunidades/[slug]/moderar` | Ausente | Moderadores, cargos, denúncias, banimento, termos de revisão |
| Chat privado e grupos | `mensagens/page.tsx` | Inbox, mídias/áudio, resposta, reações, busca, grupos com convites/cargos/permissões | Conversas arquivadas e sincronização avançada |
| Conversas avançadas | `mensagens/page.tsx` | Digitação, presença opt-in, silenciar e fixar mensagens | Recibos avançados por participante e notificações push |
| Chamadas WebRTC | `chat-calls.tsx` | Ausente | Áudio e vídeo no game app, chamada recebida, toque, perdido, TURN |
| Notificações | `notificacoes/page.tsx`, `chat-push-control` | Lista, badge, abertura nativa de posts e avisos do sistema opt-in enquanto app está aberto | Push FCM/APNs em segundo plano, toques e navegação completa |
| Stories | `story-ui` e `stories` | Captura, visualização, publicação, exclusão | Alinhar visualizações e interações específicas do site |
| Reels | `reels/page.tsx` | Visualizar, curtir e compartilhar | Tela de criação nativa contextual e navegação ao post/comentários |
| Moderação geral | `moderacao/page.tsx` | Somente denunciar; bloqueios continuam no servidor | Central administrativa, fila de denúncias, decisão/recurso |
| Segurança pessoal | `p/[handle]/page.tsx` | Bloqueio e desbloqueio, perfil público com proteção RLS, central de permissões | Controles avançados de privacidade e transparência da conta |
| Espaço de apoio | `acolhimento/page.tsx` | Ausente | Área de mães atípicas / acolhimento e modo calmo |
| Publicidade discreta | `feed/page.tsx` e outros componentes web | Sem espaços publicitários no nativo | Modelo discreto com conformidade Play/App Store |
| Atualizações | `mobile/src/update-ui.tsx` | Verificação e download nativo Android com SHA-256, progresso e instalação confirmada; iOS via App Store | Release oficial, keystore permanente, homologação real e OTA EAS |
| Distribuição de loja | `mobile/eas.json` | APK Alpha para testes | Google Play, App Store, assinatura definitiva, políticas e testes físicos |

## Próximas prioridades

**P0 — Essencial antes do lançamento**
1. Registrar tokens APNs/FCM por dispositivo, push real e redirecionamentos seguros.
2. Chamadas WebRTC de áudio/vídeo, toques e permissões com TURN operacional.
3. Cadastro, recuperação de senha e verificação de identidade no fluxo mobile.
4. Assinatura Android permanente, canal de distribuição pública e publicação dos APKs.
5. Homologação de conteúdo, moderação, segurança e UX em Android/iOS reais.

**P1 — Paridade social**
6. Aperfeiçoar grupos já implementados: arquivamento, recibos, sincronização completa e QA.
7. Perfis públicos completos, busca global e notificações clicáveis.
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
`conecta-v2-android-<versão>.apk` de 2–250 MB, e hospedado sob
`github.com/MichaelPriest/conectav2/releases/download/`, é aceita.
No iOS a consulta é feita à listagem oficial da App Store pelo bundle ID
`br.com.conectav2.app`, quando o app for publicado lá.

* Os artefatos do GitHub Actions **não** bastam: são temporários e o
  instalador só deve vir de uma release oficial.
* Na Alpha 0.6.1, o app pode baixar o APK diretamente, mostrar progresso,
  verificar seu tamanho e hash SHA-256 do GitHub e então abrir o instalador
  do sistema. Sem hash, oferece somente o link externo oficial.
* A distribuição Google Play não utiliza `REQUEST_INSTALL_PACKAGES`;
  o canal `sideload` configura essa permissão separadamente.
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

## Alpha 0.7.0 — permissões mínimas e paridade social

A nova área **Explorar** substitui a navegação anterior limitada a pessoas,
sem remover a tela de convites. O perfil público é nativo e carrega apenas
publicações públicas aprovadas; contas bloqueadas não devem aparecer nos
resultados. Comunidades da descoberta abrem na página nativa.

Os campos de personalização (`profile_details`) agora são editados dentro
do aplicativo com normalização de nulos, limites de tamanho, URLs
`http/https` sem credenciais e preservação do `cover_path` existente.
O arquivo `mobile/src/profile-details-validation.ts` centraliza essa
validação. Fotos publicadas abrem em modal nativo com ampliação e
navegação. Ações das notificações abrem posts e convites dentro do app,
e os links `conecta://post/{uuid}` passam por validação de origem e UUID.

### Matriz de permissões

| Permissão | Plataforma | Quando solicitar | Funcionalidade |
|---|---|---|---|
| Câmera | Android / iOS | Ao tocar em capturar | Fotos e Stories |
| Microfone | Android / iOS | Ao iniciar gravação | Mensagens de voz |
| Seleção de fotos | Android / iOS | Ao selecionar | Seletor do sistema, sem leitura irrestrita |
| Avisos do sistema | Android 13+ / iOS | Ao ativar nas configurações do Conecta | Avisos locais em primeiro plano |
| Instalar APK de fontes externas | Android *sideload* | Ao instalar uma release oficial | Atualização de APK, confirmação do sistema |
| Acesso à Internet | Android / iOS | Permissão normal do sistema | Supabase e serviços Conecta |

**Não necessários neste estágio**: localização, contatos, SMS, histórico
de chamadas, sobreposição de tela, gerenciamento de arquivos, alarmes
exatos e gravação em segundo plano. Essas permissões estão explicitamente
bloqueadas na configuração Android. Backup automático da aplicação e
tráfego HTTP sem criptografia também estão desativados.

**Diferença entre local e push remoto**: a 0.7 adiciona o módulo
`expo-notifications` e solicita autorização apenas sob ação explícita.
As notificações exibidas derivam de eventos Supabase enquanto o app está
**aberto**. Não há registro de tokens FCM/APNs ou entrega com o app
fechado; isso continuará pendente até termos configuração de projeto
Expo, credenciais e serviço autenticado de envio.

### Homologação física necessária

Verificar Android 13/14+ por gestos e três botões, iOS, permissão
concedida, recusada e revogada; foto, câmera, áudio, seletor limitado,
push desativado, troca de conta, links malformados, moderação pendente,
bloqueios, visualizador de fotos, atualização e restauração da sessão.
Não interpretar testes unitários/TypeScript como prova de homologação
nativa em dispositivos reais.
