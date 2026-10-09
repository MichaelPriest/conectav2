# Conecta V2 — pendências consolidadas (2026-10-08)

## Prioridade P0 — identidade, idade e segurança
- [x] Captura facial local com Human, teste de vivacidade experimental, sem selo.
- [x] Leitor local ZXing da CIN e conferência ES512 experimental, sem consulta oficial automática.
- [x] Declaração individual PDF + retorno de assinatura gov.br + verificação criptográfica preliminar. Não valida cadeia gov.br/revogação/titularidade nem comprova idade.
- [x] Entrada de data de nascimento no cadastro **apenas localmente**, armazenamento da faixa autodeclarada, RLS com uma declaração por conta.
- [x] Declarações de adolescentes inicializam proteções e vínculo parental pendente; operações de posts, comentários e mensagens bloqueadas em gatilhos de banco.
- [ ] Verificar com documento real autorizado, integração oficial ou atestado digital confiável que o backend possa validar automaticamente (sem scraping).
- [ ] Verificar assinatura gov.br com cadeia de certificados, revogação, signatário e controle de replay; testar PDF real no Render.
- [ ] Comparação selfie-documento autêntico, com revisão humana e avaliação antifraude, consentimento e retenção adequada.
- [ ] Verificação e supervisão do responsável; fluxo de contestação, auditoria e retirada de proteção apenas após atestado confiável.
- [ ] Aplicar controles de idade em todas as superfícies (mídia, reação, notificações, descoberta, convites, anexos e URLs), auditoria de RLS e testes reais.
- [ ] Concluir LGPD: exportação, exclusão, retenção, direitos titulares e política de dados biométricos.
- [x] Entrada de denúncias em publicações e mensagens privadas, com motivos, evidência textual limitada, RLS e proteção contra duplicidade. Corrigida política que permitia informar uma comunidade diferente da publicação; denúncias de comunidades continuam visíveis à equipe autorizada.
- [x] Central administrativa de moderação geral: fila protegida por cargo separado das comunidades, filtros, registro de análise/decisões com justificativa, histórico auditável e contagem de denúncias por autor. Configuração explícita de equipe ainda pendente; não há autoatribuição de administrador.
- [x] Pipeline inicial gratuito de moderação: quarentena de novas mídias em posts/Stories via RLS, verificação autenticada por API gratuita de texto/foto se configurada, worker open-source de toxicidade/NSFW/quadros de vídeo, fila de revisão humana de mídia na central (aprovar/rejeitar + trilha auditável). Não afirmar que o worker esteja ativo até instalar/configurar a máquina ou a chave de API.
- [ ] Moderação automatizada realmente completa em todas as superfícies: comentários, DMs/áudio mediante privacidade/consentimento, avatares e capas, OCR, semântica multimodal/português, remoção administrativa, apelações/contestações, escalonamento de incidentes, política de retenção e validação de acurácia/bias, sem falsas aprovações automáticas.

## Prioridade P1 — experiência social
- [x] Comunidades oficiais, cargos, moderadores, recados, perfil estilo MySpace, enquetes, salvamentos, respostas e chat básico já iniciados/entregues.
- [ ] Revisar bugs e fluxos completos de moderação, comunidades, perfis/álbuns e recados/depoimentos. Denúncias gerais e conteúdo de feed/Stories pendentes têm fila, mas faltam testes reais em múltiplas contas e revisão de todas as superfícies.
- [x] Stories de foto/vídeo com visibilidade público/amigos/privado, leitura por RLS, exclusão pelo autor e expiração de visibilidade em 24 horas; faltam a limpeza física agendada dos arquivos e teste multiusuário real.
- [ ] Círculos próximos, eventos e demais recursos nostálgicos.
- [x] Conversas em grupo entre amizades aceitas; anexos privados de imagem, vídeo e áudio, mais gravação local de recados de voz em navegadores compatíveis.
- [x] Edição de texto, exclusão lógica de mensagens e indicadores de leitura no chat: RLS com autorização do remetente, imutabilidade de identidade e carimbo de leitura no servidor. Interface do chat e widget sincronizados; testes end-to-end multiusuário continuam pendentes.
- [ ] Reações às mensagens, chamadas de voz/vídeo, exclusão física agendada de anexos apagados e testes multiusuário com controles para adolescentes.
- [ ] Acessibilidade e 10 idiomas completos (as traduções ainda são parciais). Stories e mensagens multimídia ainda têm textos fixos em português.
- [ ] Testes reais multiusuário e testes mobile de todas as telas.

- [x] Página inicial pública atualizada: apresenta recursos realmente implementados, comunidades oficiais, experiência nostálgica e acolhimento para mães atípicas, sem conteúdo fictício.
- [x] Correção da dependência circular RLS em conversation_members e criação atômica de conversas/grupos; permanecem testes multiusuário completos no navegador.

## Prioridade P2 — monetização e lançamento
- [x] Dois slots de publicidade discretos: desktop lateral e mobile após a sexta publicação.
- [ ] **Não habilitar** scripts externos enquanto não houver idade adulta verificada e auditoria das campanhas. Sem popunder, push, interstitial ou poluição visual.
- [ ] Política de segurança/anúncios, domínio e consentimento; auditoria de elegibilidade no servidor.
- [ ] Homologar Render, validar produção, sem mexer automaticamente na Vercel nem em outros projetos.

## Limite explícito do produto
Assinatura criptograficamente íntegra, Human, OCR, QR code experimental e idade informada
no cadastro NÃO são verificação oficial de identidade/idade. O fluxo permanecerá
indisponível para selo +18 e para liberar menores sem prova confiável de idade/responsável.
Não utilizar mocks, cadastros fictícios ou enfraquecer testes.

## Continuação de desenvolvimento
Repositório MichaelPriest/conectav2, main autorizada para evoluções da rede social.
Confirmar HEAD antes de editar. Publicar somente após CI; Render em homologação, Vercel intacta.
Conferir sempre a última versão da branch antes de realizar mudanças.
