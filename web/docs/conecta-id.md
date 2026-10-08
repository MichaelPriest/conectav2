# Conecta ID — prova de vida e conformidade etária (preparação)

Este é um fluxo real **preparado para Persona**, não um simulador de selfie.
Sem credenciais configuradas, `/verificar-identidade` informa que a integração está indisponível.

## Decisões de privacidade
- O app não solicita acesso à câmera; o provedor faz a captura em seu domínio seguro.
- Não salvamos selfie, template biométrico, foto de documento, número de CPF ou data de nascimento no PostgreSQL do Conecta.
- O backend guarda apenas o ID da consulta, decisão e indicadores mínimos.
- Apenas `approved` do provedor conta como identidade aprovada: `completed` e callbacks de browser **não** são prova.
- `age_band` continua `unknown` até integrar um **método de aferição de idade validado**, não apenas um campo DOB autodeclarado. Aprovação de identidade **não** libera recursos +18 nem dispensa responsável.
- Usuários de até 16 anos precisam de fluxo adicional de vínculo do responsável legal, que ainda não está pronto.
- **Não declarar conformidade legal ou liberar acesso a menores** sem enforcement de RLS, relatórios e testes reais.

## Variáveis secretas necessárias, apenas no servidor
```shell
PERSONA_API_KEY=persona_sandbox_... # sandbox primeiro
PERSONA_TEMPLATE_ID=itmpl_...
SUPABASE_SERVICE_ROLE_KEY=... # JAMAIS NEXT_PUBLIC
```

Crie um projeto Persona, configure a template para verificação de documento + selfie com prova de vida, políticas de retenção e permissões para adolescentes, e revise aspectos de LGPD e ECA Digital com assessoria jurídica.

A tabela `identity_verifications` aceita leitura somente do próprio usuário; clientes não têm permissões de escrita. O backend usa um Supabase service role isolado.

## Antes de liberar o recurso
1. Configurar template e ambiente sandbox, lista de domínios, credenciais e privacidade do provedor.
2. Testar um caso válido, recusado, repetido e expirado; revisar antifraude/rate limits.
3. Implementar e validar em backend regras etárias e vínculo/verificação de responsável.
4. Aplicar gates também **no banco/RLS**, e não apenas esconder telas ou botões.
5. Testar com contas reais e avaliar RIPD, retenção e mecanismos de exclusão e contestação.
6. Habilitar somente após concluir os requisitos acima.

Refs:
- https://docs.withpersona.com/api-reference/inquiries/create-an-inquiry
- https://docs.withpersona.com/api-reference/inquiries/retrieve-an-inquiry
- https://www.gov.br/anpd/pt-br/assuntos/eca-digital/
