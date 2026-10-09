# Conecta · Moderação gratuita e executável localmente

Worker opcional e isolado, **não incluído** no deploy principal do Render. Modelos Hugging Face Apache 2.0:
- Texto multilíngue: [unitary/multilingual-toxic-xlm-roberta](https://huggingface.co/unitary/multilingual-toxic-xlm-roberta) (detecta toxicidade, não todas as violações).
- Imagem: [Falconsai/nsfw_image_detection](https://huggingface.co/Falconsai/nsfw_image_detection) (detecta NSFW, não fraude, violência ou CSAM).
- Vídeo: ffprobe + FFmpeg extraem até quatro quadros; todos os vídeos ainda exigem revisão humana.

## Executar no seu servidor (CPU, acesso PRIVADO)

```bash
docker build -t conecta-moderation ./moderation-worker
docker run --rm -p 127.0.0.1:8080:8080 \
  -e MODERATION_WORKER_TOKEN="COLOQUE-SEGREDO-UNICO-ALEATORIO" \
  -v conecta-ai-cache:/models conecta-moderation
```

Modelos não são baixados no repositório. Na primeira análise serão baixados para `/models`; a primeira requisição pode ser demorada. Os dois modelos e PyTorch podem exigir vários GB de RAM e armazenamento. As licenças são gratuitas, **a máquina que executa não necessariamente**. Prefira máquina própria ou instância dedicada sem acesso público direto. Não expor a porta, não reutilizar tokens e não registrar uploads.

Para integrar ao Next.js, configure **somente no servidor** `CONEXA_MODERATION_WORKER_URL=https://seu-worker-privado` e `CONEXA_MODERATION_WORKER_TOKEN`. A URL precisa ser HTTPS válido e o serviço deve validar o token constante em todas as requisições. Se configurar, o worker tem precedência sobre `OPENAI_API_KEY`.

## Alternativa leve para texto e imagem
A API `omni-moderation-latest` é gratuita para usuários da API OpenAI (pode exigir conta/chave de API). Basta definir `OPENAI_API_KEY` no Render, **nunca** `NEXT_PUBLIC_`. Não enviaremos mensagens privadas automaticamente: esta integração analisa publicações e Stories conforme as regras de privacidade e consentimento. O endpoint não analisa vídeos e não deve receber material identificado ou suspeito de CSAM.

## Segurança do pipeline
- Novas mídias no feed/comunidades e Stories são mantidos sob revisão no banco até validação.
- Os guardas de RLS e Storage impedem acesso de outros usuários a itens pendentes.
- O navegador jamais assina uma aprovação; o servidor consulta a sessão e o banco.
- Ausência/falha do classificador => `pending` para novas mídias. Classificação de alto risco => `pending`, não remoção automática.
- Os dois modelos Apache detectam apenas categorias específicas. Assim, quando só o worker OSS está ligado, seus resultados **não** aprovam automaticamente imagens/vídeos: a revisão humana continua necessária.
- Publicações anteriores não são retroativamente classificadas; backfill e políticas completas de LGPD e escalonamento ainda faltam.
- Não é apropriado usar modelos genéricos para detecção especializada de abuso sexual infantil.
