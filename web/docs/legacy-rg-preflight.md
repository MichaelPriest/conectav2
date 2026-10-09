# RG antigo no Conecta ID (homologação)

A carteira estadual antiga continua válida até 28/02/2032:
https://www.gov.br/governodigital/pt-br/identidade/identificacao-do-cidadao-e-carteira-de-identidade-nacional/perguntas-frequentes-sobre-a-cin/ate-quando-posso-ficar-com-a-minha-atual-identidade

## Funcionalidade gratuita
- Seletor de UF e upload opcional de frente e verso; JPG, PNG ou WebP até 8 MB por imagem.
- Tesseract.js 6.0.1 (Apache-2.0) processa OCR no navegador, com modelos/worker de idioma baixados de servidores externos pela biblioteca. Imagens não são enviadas ao backend, nem persistidas.
- O parser só considera datas próximas ao rótulo 'data de nascimento' e exige um resultado único/plausível. A data não é gravada nem exibida.
- Resultados de OCR e eventual inconsistência com cadastro são INDICATIVOS; nunca aprovam identidade, documento nem faixa etária.
- Para SP, links gratuitos do RG Digital SP oficial em Android e iOS, quando o RG possui QR Code compatível, emitido a partir de fevereiro de 2014.
- Human + assinatura gov.br continuam como etapas separadas; PDF assinado não confirma autenticidade do RG estadual.
- O RG não segue um formato único de QR Code ou consulta de autenticidade entre estados.
- Não pedir envio de foto via chat e nunca guardar CPF, registro geral ou imagens do RG em banco.

Pendências: testes com documentos autorizados de diferentes estados, revisão especializada quando necessária, integração oficialmente autorizada de autenticidade e controle de menores.
