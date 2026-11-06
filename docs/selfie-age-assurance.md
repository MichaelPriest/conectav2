# Conecta ID V2 — maioridade por selfie ao vivo

## Objetivo
A captura guiada é o caminho inicial e opcional para um usuário que se declarou adulto.
Documento permanece disponível para qualquer pessoa, principalmente se o modelo
não puder concluir a maioridade. A selfie **não comprova identidade**, titularidade
de documento, idade exata, nem autenticação oficial.

## Protocolo e segurança
1. Usuário autenticado informa consentimento específico para análise temporária.
2. O servidor emite desafio aleatório de 90 segundos, uso único e com ordem de
   movimentos aleatória (frente → esquerda/direita → lado oposto → frente).
3. O navegador usa MediaPipe para orientar o rosto, nunca para aprovar idade.
4. Quatro quadros JPG seguem em multipart autenticado, sem selfie da galeria.
5. O backend consome o desafio antes do cálculo, exige exatamente um rosto em
   cada quadro e valida pose no servidor via Human, consistência biométrica entre
   quadros frontais e apresentação antifraude por MiniFASNet ONNX.
6. O modelo FaceRes do Human produz uma estimativa de idade para os dois quadros
   frontais. A regra preliminar é ambos >=25 anos estimados e diferença <=6 anos.
   **Esses limites são heurísticos, não intervalo de confiança nem prova de idade.**
7. Somente uma decisão etária `18_plus` e hash de evidência são persistidos por
   `complete_conecta_selfie_age_assurance` via service_role. Imagens, embeddings
   e idades individuais são descartados em memória.

Se um modelo estiver indisponível, os quadros não forem consistentes, a prova
de vida falhar ou o valor ficar próximo do limiar, nenhuma decisão etária é
gravada. Resposta inconclusiva **não equivale a reprovação de menoridade**; o
usuário pode enviar documento. Contas declaradas menores nunca são promovidas
por essa estimativa.

## Autorizações
- `age_assurance_decisions.method = conecta_selfie_age_estimate` é distinto de
  `identity_verifications.status = approved`.
- Publicações, comunidades e ações sociais comuns usam a regra do adulto com
  idade aferida, desde que a declaração também seja `18_plus`. Consultas
  sensíveis, mensagens privadas e outros gates de identidade não são relaxados.
- A elegibilidade publicitária vigente exige sinal etário adicional e permissão
  explícita do usuário; a introdução da selfie não libera automaticamente anúncios.
- Todas as verificações de idade são no servidor, não no perfil, `user_metadata`
  nem em parâmetros de idade enviados pelo navegador.

## Validação antes de produção
A implementação é uma primeira versão; deve ser validada em dispositivos reais
contra bases demograficamente representativas de adultos e menores, incluindo
cenários de iluminação, tonalidades de pele, câmeras, apresentação de vídeos,
latência e falsos positivos acima do limiar. Ajuste os limites só com métricas
medidas por estrato e revisão de privacidade/legislação aplicável; *não use a
heurística como comprovação de idade de alto grau de segurança*.

Verificar migração em Supabase, RLS social, status, ads, gate de mensagens e
build de Next.js antes da liberação pública.
