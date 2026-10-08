# Conecta ID — caminho oficial gratuito da Carteira de Identidade Nacional

**Atualizado em 2026-10-08**

## Governo federal — validação oficial existente
Serviço: https://www.gov.br/pt-br/servicos/verificar-validade-de-qr-code-da-carteira-de-identidade-nacional

A validação é gratuita PARA O CIDADÃO no aplicativo móvel:
- Android: https://play.google.com/store/apps/details?id=com.identidadenacional
- iPhone: https://apps.apple.com/br/app/carteira-identidade-nacional/id1642584147

**Leitura parcial:** consulta campos básicos, sem confirmar o status atual do documento.
**Leitura detalhada:** login gov.br e conexão online para confirmar a situação atual da CIN.

O app oficial do governo não envia atestado verificável de conclusão ao Conecta.
Não existe integração automática livre confirmada publicamente para aplicativos privados.
A documentação de Login Único gov.br limita integração a órgãos e entidades públicas habilitadas:
https://www.gov.br/governodigital/pt-br/identidade/identidade-digital-para-gestores-publicos/duvidas-frequentes-do-ecossistema-da-identidade-digital-gov-br

**Não** implementar scraping, chamadas não autorizadas a APIs privadas ou reutilização de credenciais gov.br.
Nenhuma caixa "Concluí" ou captura de tela do aplicativo deve conceder identidade/idade
verificada. O Conecta oferece apenas links e instruções oficiais.

## Continuidade do modo gratuito
- ZXing + verificação local ES512/P-521: experimental, sem atestação externa.
- Human + desafios de movimentos/piscada: não certifica presença e pode ser burlado.
- Nenhuma faixa etária extraída localmente pode ser persistida como atestado de 18+.
- Para cadastro/verificação automática de contas de adultos ou menores será necessária uma
  integração formal autorizada com resposta verificável do servidor, ou outro prestador
  reconhecido que ofereça efetivamente esse resultado.
- Confirmar identidade da pessoa é separado de autenticar o documento.
