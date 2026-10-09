# Conecta ID — declaração gov.br e verificação de assinatura

**Gratuito e sem API privada.** A pessoa gera um documento com desafio exclusivo,
assina fora do Conecta em https://assinador.iti.br e devolve o PDF assinado.

A análise automática local com OpenSSL utiliza o conteúdo CMS e a ByteRange
que cobre o documento completo. A flag **-noverify** desativa explicitamente
a verificação da cadeia de confiança. Assim, uma assinatura criptograficamente
íntegra não prova que foi feita pelo gov.br ou por uma pessoa particular.

Para uma validação oficial gratuita, o usuário deve conferir o PDF em
https://validar.iti.gov.br — resultado oficial não retorna automaticamente
ao Conecta; não tratamos prints, confirmações manuais ou cliques como prova.

Endpoints sob autenticação Supabase:
- GET /api/identity/govbr/challenge: última declaração disponível;
- POST /api/identity/govbr/challenge: gerar PDF e desafio, até 3 por 24h;
- POST /api/identity/govbr/inspect: análise de PDF <=6 MB, até 5 tentativas.

Supabase: tabela privada `identity_signature_challenges` com RLS e nenhum
acesso direto de usuários. Guarda nonce, status, hash SHA256 e prazo, mas
nenhuma selfie, documento, CPF ou data de nascimento. PDFs processados
em arquivos temporários com remoção ao final.

**NÃO** altera `identity_verifications` ou permissões RLS, não aprova
identidade e não emite `age_band=18_plus`. Testes com PDF gov.br real e
validação da cadeia/certificados/revogação ainda necessários antes de
uma autorização de identidade ou idade.

Referências oficiais:
https://www.gov.br/pt-br/servicos/assinatura-eletronica
https://www.gov.br/pt-br/servicos/realizar-validacao-de-assinaturas-eletronicas-validar

## Avanço de etapas (2026-10-08)
- GET desafio informa apenas quantidade de tentativas, não expõe nonce.
- PDF obviamente sem ByteRange ou que não começa com %PDF- não gasta cota.
- Resultado `integrity_checked` conduz à conferência no VALIDAR; **não** emite atestado.
- Contas autodeclaradas adultas podem navegar à experiência básica já existente,
  mas sem qualquer selo ou publicidade para adultos sem certificação.
- Contas adolescentes continuam bloqueadas até aferição independente e vínculo de responsável.
- Limite de 5 tentativas por declaração continua ativo; quando atingido, novo desafio conforme limite diário.
