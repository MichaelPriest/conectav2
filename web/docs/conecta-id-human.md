# Conecta ID — arquitetura de prova de vida e aferição de idade

## O que já funciona
- Human v3.3.6 processa quadros de câmera localmente após consentimento.
- Fluxo de 4 desafios: rosto centralizado, virar para lados opostos em ordem variável, piscar.
- Regras locais sobre presença de um rosto, qualidade, antivídeo/antispoof e vivacidade.
- Cancelamento encerra a câmera; timeout, ausência de pontuação e mais de um rosto dão resultado inconclusivo.
- A implementação não grava dados biométricos, não chama APIs de aprovação e não modifica o Supabase.
- A ordem dos movimentos muda por sessão. **O navegador é manipulável**, portanto esse teste não é um atestado oficial.

## Etapas pendentes para identidade real
1. **Documento genuíno**: origem governamental ou prestador habilitado com verificação de autenticidade (p.ex. CNH ou CIN). OCR local de Tesseract pode auxiliar na leitura mas NÃO comprova autenticidade.
2. **Comparação facial**: Human pode gerar embeddings da selfie e do retrato do documento autenticado, mas exige testes de precisão, detecção de falsificação e revisão humana de casos ambíguos.
3. **Idade confiável**: calcular idade com data de nascimento atestada pela verificação documental; armazenar somente faixa etária e atestado quando possível, sem data ou imagem bruta desnecessárias.
4. **Proteção parental**: verificação independente de vínculo do responsável, restrições de contas adolescentes e configuração protegida pelo servidor.
5. **Modelo de confiança**: resultado só pode ser concedido por backend autorizado após confirmação criptograficamente verificável. Nunca aceitar resultados enviados pelo cliente como fonte de verdade.
6. **Privacidade e LGPD**: bases legais, informação transparente, minimização, proteção reforçada a menores, retenção limitada, contestação e auditoria.

## Restrições obrigatórias
- Nunca converter conclusão do Human em identity_verifications.status=approved ou age_band=18_plus.
- Nunca usar estimativa visual de idade como prova de maioridade para liberar anúncios ou recursos.
- Nunca copiar selfies/documentos para um bucket público, telemetria, histórico de chat ou logs.
- O fluxo gratuito é **triagem experimental**, não substitui prestador documental nem integração governamental confiável.

Referências: https://github.com/vladmandic/human/tree/main/demo/faceid
Relatório NIST sobre estimativa etária: https://www.nist.gov/publications/face-analysis-technology-evaluation-age-estimation-and-verification
Lei 15.211/2025: https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15211.htm
