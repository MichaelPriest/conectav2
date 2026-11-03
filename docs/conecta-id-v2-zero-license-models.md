# Conecta ID 2.0 — modelos sem licença paga

## Critérios
A solução deve funcionar sem APIs pagas ou contratos de licença de modelos. Isso não garante hospedagem gratuita, nem elimina obrigações LGPD, custos de processamento ou avaliação de direitos sobre dados de treinamento.

## Candidatos
- **YuNet**: detecção facial. Fonte: https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet ; pesos com licença MIT conforme diretório upstream.
- **SFace**: comparação facial 1:1. Fonte: https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface ; conferir licença exata do arquivo de pesos e procedência do treinamento antes de distribuição.
- **MediaPipe**: landmarks e desafios ativos de prova de vida; movimento facial isolado não comprova vivacidade contra replay/deepfake.
- **Presidio**: minimização de dados pessoais em conjuntos de avaliação; https://github.com/microsoft/presidio .
- **OpenBiometrics**: candidato para testes de integração de detecção, comparação e prova de vida; https://github.com/openbm/openbiometrics . Revisar todas as dependências, pesos e licença de cada módulo.

## Bloqueios explícitos
- Não incluir pesos `buffalo_*`/`antelopev2` do InsightFace sem autorização comercial.
- Não usar modelo de estimativa de idade como comprovação de maioridade.
- Não usar gênero, raça ou atributos protegidos como sinais de fraude.
- Não armazenar selfie/documento/embedding facial em tabelas de treinamento.
- Não afirmar que o motor de triagem está treinado ou calibrado antes de validar dados reais.
- Não liberar rede social a partir da recomendação de IA; gate de identidade/idade e RLS continuam soberanos.

## Etapas de implantação
1. Fixar versões, SHA-256 e licença dos pesos; obter revisão de licenças e procedência dos dados.
2. Criar adaptador de inferência isolado e autenticado com timeout, limites de tamanho e exclusão dos arquivos temporários.
3. Testar em ambiente de homologação com dados sintéticos/consentidos, verificando falso aceite, falsa rejeição e resistência a replay.
4. Rodar em shadow mode e comparar recomendações com decisões humanas, sem mudar acesso.
5. Publicar gradualmente somente após validação de segurança, privacidade e capacidade operacional.

## Política de fallback
Se o modelo estiver indisponível, não presumir verificação bem-sucedida. Encaminhar a fluxo alternativo seguro ou revisão humana. Recomendação automatizada nunca equivale a aprovação.
