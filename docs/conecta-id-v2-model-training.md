# Conecta ID 2.0 — protocolo de treinamento e avaliação

## Estado atual
O mecanismo `rules-v1` é uma linha de base explicável. **Não foi treinado com exemplos reais.**
Sua recomendação não comprova identidade/idade, não aprova acesso social restrito e não pode rejeitar automaticamente uma conta.

## Dados autorizados para treinamento
Usar apenas eventos operacionais minimizados, rotulados após revisão humana e contestação: resultados de verificações, motivo categorizado, data, versão da regra, resultado da revisão e desfecho confirmado. Não exportar selfies, documentos, nomes, e-mails, biometria ou datas de nascimento para conjuntos de treinamento.

## Rotulagem
Distinguir fraude confirmada, suspeita não confirmada, erro de verificação, cadastro legítimo e resultado inconclusivo. Uma rejeição de documento isolada não é fraude confirmada. Excluir casos inconclusivos de rótulos binários. Revisar vieses por faixa etária quando permitido, sem inferir atributos sensíveis.

## Treinamento
1. Construir conjunto de dados desidentificado com consentimento/base legal e retenção definida.
2. Separar treino, validação e teste por usuário e tempo; evitar vazamento entre contas relacionadas.
3. Comparar modelo candidato com `rules-v1` e registrar versão, parâmetros e dados de origem.
4. Medir precisão, recall, falsos positivos, falsos negativos, calibração, cobertura de abstenção e recursos aceitos após contestação.
5. Validar estabilidade e revisão humana de falsos positivos antes de qualquer rollout.
6. Executar em *shadow mode* (somente recomendação) até aprovação formal de segurança, privacidade e produto.

## Regras de produção
- Nunca usar autodeclaração de idade como prova.
- Não usar a saída da IA para ignorar RLS, vínculo de responsável ou verificação de idade.
- Rejeição definitiva requer decisão humana documentada e possibilidade de contestação.
- Não usar sinais de terceiros sem autorização nem identificar usuários por características protegidas.
- Não alegar treinamento ou acurácia sem conjunto de avaliação auditável.
