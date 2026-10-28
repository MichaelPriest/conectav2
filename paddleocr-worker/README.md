# Conecta ID: PaddleOCR privado (alternativa ao Tesseract)

O Next.js continua usando Tesseract localmente. Se não conseguir extrair **uma única** data de nascimento, ele pode chamar este serviço privado, processando somente as imagens do documento, nunca selfie/quadros. Este serviço é opcional e permanece desligado sem configuração.

## Implantação

1. Publique `paddleocr-worker/` em um servidor/container Python com memória suficiente para carregar os modelos PaddleOCR 3.7, HTTPS e acesso restrito. O primeiro carregamento pode baixar modelos; disponibilize/copie modelos na imagem de produção para eliminar downloads em tempo de uso.
2. Configure no serviço `CONECTA_OCR_SECRET` (chave aleatória longa), com o mesmo valor em `CONECTA_PADDLE_OCR_SECRET` no Next.js.
3. Configure no Next.js `CONECTA_PADDLE_OCR_URL=https://seu-servico-privado.exemplo/v1/recognize`. Não use links públicos sem autenticação nem HTTP em produção.
4. Proíba logs de body, rastros de erro com dados pessoais, persistência das imagens, cache compartilhado e telemetria com PII.
5. Faça homologação com documentos sintéticos/consentidos e valide adequação à LGPD. O resultado é somente um texto OCR: **não** comprova autenticidade.

Sem URL e chave o serviço não é chamado, e o comportamento anterior do Tesseract permanece.

`GET /health` fornece somente estado não sensível. A chamada `POST /v1/recognize` exige `X-Conecta-OCR-Key` e `{"images":["<base64>","<base64>"]}`, com no máximo dois arquivos de 4 MiB.
