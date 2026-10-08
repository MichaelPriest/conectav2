# Roadmap do Conecta — inspiração de redes clássicas e ideias novas

## Entregue no projeto principal (2026-10-08)
- 10 comunidades oficiais sem contas fictícias; acesso real por RLS.
- Perfil com apresentação, interesses, cidade opcional, emoji, capa, foto, site e música.
- Chat privado entre amizades aceitas; Supabase Realtime e RLS, bloqueio de contatos.
- Emoji Picker Unicode com categorias, busca, diversidade de tons de pele e inserção no feed, comentários, comunidades e chat.
- Players Spotify e YouTube carregados apenas após interação explícita; sem copiar ou hospedar arquivos protegidos por direitos autorais.
- Conecta ID com integração preparada para fornecedor de identidade; **não é aferição de idade completa**.

## Próximas prioridades (não implementadas ainda)
1. **Proteção de adolescentes**: sinais confiáveis de idade, supervisão parental de menores de 16, classificação indicativa, restrição de DMs e moderação.
2. **Segurança**: denúncia com fila e tratamento, bloqueio global de conteúdo, políticas de privacidade, exclusão/exportação de dados.
3. **Nostalgia reimaginada**: recados e depoimentos (Orkut), status e música favorita (MSN / MySpace), álbuns e comunidades moderadas.
4. **Conteúdo moderno**: stories e círculos próximos, vídeos curtos originais, feed cronológico/opcional, threads, enquetes e eventos.
5. **Chat avançado**: grupos, mensagens com anexos, edição/remoção, reações, leitura, vídeo e voz com controle parental.
6. **Recursos únicos**: cápsulas do tempo privadas, mural de projetos colaborativos, comunidade local sem geolocalização precisa, recomendações por interesses controladas pelo usuário.
7. **Música**: compartilhamento de faixas, playlists colaborativas e associação a posts/eventos usando players oficiais com autorização do provedor.
8. **Acessibilidade**: texto alternativo, legenda para vídeos, tradução automática opcional, configurações de redução de movimento.

## Verificação biométrica gratuita
- Human: https://github.com/vladmandic/human — MIT; modelos locais de face/liveness como **protótipo**. Não comprova identidade/idade e não substitui a checagem documental, governança e auditoria necessárias.
- Persona: sandbox sem validação real; trial limitado. Verificação real pode ser paga.
- Recomenda-se evitar guardar biometria, CPF ou documentos no banco da rede social.

## Transparência
Não inventar perfis, comentários, curtidas, contadores, notícias ou moderadores. As comunidades de partida são categorias reais do aplicativo, ainda sem conteúdo. Nunca ativar badges de idade ou identidade com base apenas em campos declarados pelo usuário.

## Integrações de música
- Embed de Spotify, vídeos musicais do YouTube com domínio de privacidade, SoundCloud e Apple Music, mediante URL validada.
- Links são incorporados no site apenas após clique explícito do usuário; reproduções estão sujeitas aos termos e limitações do provedor.
- A integração não fornece streaming independente, download ou importação de bibliotecas protegidas por direitos autorais.
