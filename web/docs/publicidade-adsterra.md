# Política de publicidade Conecta V2 — Adsterra (proposta)
Atualizado: 2026-10-08

## Formatos priorizados (somente após aprovação do domínio)
1. Display 728×90: desktop entre blocos do feed.
2. Display 300×250: coluna lateral do feed e das comunidades.
3. Display 320×50: dispositivos móveis.
4. Native Banners: entre grupos de publicações, com rótulo explícito **Publicidade**.

Não habilitar Popunder, Smartlink, Social Bar, In-Page Push nem interstitial no Conecta: são intrusivos e podem parecer chats/notificações verdadeiras.

## Bloqueio obrigatório antes de instalar qualquer script de publicidade
- O app recebe contas adolescentes e contas ainda sem aferição de idade confiável.
- Nenhum script da Adsterra pode ser incluído globalmente em layout.tsx/app-shell.tsx.
- Nenhum anunciante externo pode acessar dados de identificação pessoal, mensagens, histórico, interesses, grupos ou dados de verificação etária.
- A verificação da idade precisa ocorrer no **servidor** e estar protegida por uma autorização confiável; cliente localStorage e idade declarada não são suficientes.
- Para menores, veda-se o perfilamento publicitário (Lei 15.211/2025, arts. 22 e 26). Antes de disponibilizar anúncios, revisar categorias vedadas, segurança, privacidade e consentimento com assessoramento jurídico.
- Se o provedor não oferecer garantias adequadas para anunciantes, conteúdo dos anúncios e não perfilamento, manter anúncios externos desligados e usar somente patrocínios contextuais aprovados manualmente.
- Confirmar com a Adsterra exclusão de campanhas adultas, apostas, namoro, suplementos restritos, scams e outras categorias impróprias.
- Exibir publicidade claramente identificada, com botão de denunciar anúncios e procedimento de remoção.

## Configuração e ativação
- É necessário cadastrar o domínio correto no painel **Publisher → Websites → Add website**, escolher formatos permitidos, desativar BOOST CPM (não aceitar todos os tipos de anúncio) e solicitar aprovação.
- Quando houver código Adsterra aprovado, revisar manualmente os domínios e funcionalidades de cada script.
- Usar componentização opt-in com modo desativado por padrão e cheque server-side de elegibilidade. **Nada implementado aqui ativa ads de terceiros.**
- Registrar versionamento dos fornecedores e permita desativar todos os anúncios sem nova publicação.
- Nunca misturar anúncios com a moderação automática de publicações.

Referências:
https://adsterra.com/ad-formats/
https://adsterra.com/blog/set-up-publishers-dashboard/
https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15211.htm

## Implementação de baixo impacto — 2026-10-08
O usuário forneceu códigos Adsterra para Native Banner, 728×90, 320×50, 160×300,
160×600 e 300×250. Foram preparados APENAS estes dois formatos:

- **300×250 (desktop):** um anúncio na coluna lateral do feed; código de formato `cb662f26f82b4b95fede2e5dc913f911`.
- **320×50 (mobile/tablet):** um anúncio depois da sexta publicação do feed; código `61dce6924b1bd636ce02c9ae38409b1e`.
- Native Banner, 728×90 e ambos banners verticais foram deliberadamente omitidos.
- Nenhum anúncio em mensagens, perfis, comunidades, telas de cadastro ou Reels.
- A tela usa no máximo um anúncio por feed, com identificação **Publicidade** e botão **Desativar**.
- Iframe `sandbox=allow-scripts`: o criativo não recebe acesso ao documento do Conecta
  nem permissão para abrir janelas ou redirecionar a aba principal. É necessário
  testar compatibilidade desse isolamento com o formato fornecido.

### Portões obrigatórios
1. Variável **somente no servidor** `CONECTA_ADS_ENABLED=true`.
   A ausência da variável significa **desativado** (inclusive no Render).
2. API `/api/ads/eligibility` confirma o JWT do Supabase com `auth.getUser`;
   lê a tabela de atestados RLS `identity_verifications` e exige
   `status=approved`, `age_band=18_plus` e `verified_at` presente.
3. Depois da elegibilidade, cada adulto precisa consentir explicitamente
   em permitir publicidade externa, armazenada no navegador por ID de usuário.
4. Em caso de erro, idade não verificada ou falta de configuração, nada carrega.

**Não habilitar** a variável enquanto não houver aferição real e confiável de
maioridade, revisão das campanhas/filtragem Adsterra, transparência LGPD e testes
de segurança. A aprovação de identidade isolada, teste facial Human ou
autodeclaração de idade não qualifica para anúncios.

O isolamento do iframe protege a aplicação, mas não garante que o Adsterra
sirva criativos sob um sandbox. Caso o provedor exija relaxar permissões
para pop-ups ou redirecionamentos, não relaxar sem uma revisão de riscos.
