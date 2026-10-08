# Conecta ID — leitor gratuito da CIN (experimental)

## Componentes gratuitos implementados
- **@zxing/browser 0.2.1 (MIT)**: leitura do QR Code via câmera traseira ou imagem local (até 12 MB). Sem upload.
- **WebCrypto nativa**: verificação criptográfica local de um JWS ES512/P-521, com chave pública de produção **reproduzida de um projeto experimental**, não verificada de maneira independente com uma fonte governamental.
- **Digital Document Checker (MIT)**: referência de formato do QR Code da CIN; a rotina de verificação foi reimplementada em TypeScript. Não foi executado Python no Render nem instalada uma API não oficial.
- **Human 3.3.6**: teste guiado local de vivacidade, sem certificado de identidade.
- **Aplicativo oficial da CIN**: link explícito para verificação completa, que exige gov.br e acesso autorizado.

## Uso e limites
- A CIN possui um QR Code JWT com claims `iss`, `cpf`, `dns`, `dvd` e `url`.
- A verificação offline compara a assinatura com JWK P-521 extraída por um terceiro do app oficial; só funciona para esse formato e chave conhecidos. Chaves e formato podem mudar.
- A tela informa a faixa etária **indicativa** apenas após a verificação da assinatura e checagens de dados, mas isso não é autorização etária.
- Nenhum token, CPF, documento, data de nascimento ou foto é enviado ao servidor ou persistido no banco. A chave é pública; o conteúdo do QR Code, não.
- O código não modifica `identity_verifications`, `teen_safety_preferences`, anúncios, RLS nem privilégios.
- **NÃO** confirma se a CIN foi revogada, se é a versão atual, se o titular é a pessoa na câmera, nem se a chave é oficialmente confiável.
- O RG antigo e CNH/VIO não são interpretados por esse leitor; mostrar mensagem de formato não suportado em vez de inventar um resultado.
- Verificação de idade e identidade reconhecida pela plataforma exige fonte oficial/credenciada, titularidade confirmada e controles de responsáveis para menores.
- Uma prova de vida concluída no navegador é falsificável e não constitui autenticação.
- Não copiar nem republicar chaves privadas ou invocar APIs governamentais restritas.

## Referências e licença
- https://github.com/zxing-js/browser — MIT
- https://github.com/helviojunior/digital-document-checker — MIT, © 2026 Helvio Junior. Chave P-521 PROD extraída do arquivo experimental `digital_document_checker/data/cin_keys.json`; parser referenciado de `documents/cin.py`.
- https://www.gov.br/pt-br/servicos/verificar-validade-de-qr-code-da-carteira-de-identidade-nacional
