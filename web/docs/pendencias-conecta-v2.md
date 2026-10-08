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
- [ ] Moderador de texto/imagens/vídeos multilíngue e centralização das denúncias, sem falsas aprovações automáticas.

## Prioridade P1 — experiência social
- [x] Comunidades oficiais, cargos, moderadores, recados, perfil estilo MySpace, enquetes, salvamentos, respostas e chat básico já iniciados/entregues.
- [ ] Revisar bugs e fluxos completos de moderação, comunidades, perfis/álbuns e recados/depoimentos.
- [ ] Stories, círculos próximos, eventos, compartilhamento de música legalmente autorizado, funcionalidades únicas de nostalgia.
- [ ] Chat em grupo, anexos, edição/exclusão, reações, recibos, áudio e vídeo com proteção parental.
- [ ] Acessibilidade e 10 idiomas completos (as traduções ainda são parciais).
- [ ] Testes reais multiusuário e testes mobile de todas as telas.

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
