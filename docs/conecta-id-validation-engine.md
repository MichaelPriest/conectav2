# Conecta ID — especificação do motor próprio de validação

## Objetivo

Implementar um fluxo próprio, prioritariamente gratuito, com decisão etária no servidor e sem dependência obrigatória de fornecedor comercial. Este documento é uma especificação de engenharia, não uma declaração de conformidade legal nem de validação oficial já concluída.

## Regras obrigatórias

- Autodeclaração de data de nascimento nunca comprova idade.
- Validar formato/dígito verificador de CPF não prova titularidade, existência de cadastro oficial ou idade. CPF só pode ser consultado por integração oficial autorizada, se existir e estiver legalmente disponível; não presumir que uma API pública gratuita esteja disponível.
- OCR, QR/JWS, assinatura isolada, estimativa facial e prova de vida são sinais distintos. Não conceder privilégios adultos sem uma fonte confiável e verificação server-side apropriada.
- Não ativar o Persona ou qualquer serviço cobrado sem preço por tentativa claramente divulgado, consentimento explícito e autorização separada.
- Processar documentos e biometria apenas em memória/armazenamento temporário protegido; apagar os originais e buffers assim que o processamento terminar e não gravá-los em logs. A aplicação só pode declarar a exclusão concluída quando o pipeline tiver confirmado isso.
- O payload de decisão não pode incluir CPF, data de nascimento, imagem, vídeo, QR/JWS bruto, claims do documento ou vetor biométrico.
- Registros técnicos mínimos podem conter timestamp, UUID aleatório da transação, resultado e referência opaca não reversível. Nunca incluir conteúdo identificador no identificador de auditoria.
- Bloquear publicidade comportamental e rastreamento comercial na saída do motor.
- Faixa etária desconhecida deve permanecer no modo protegido e sem recursos restritos.
- Todos os menores de 18 anos precisam ter a conta associada a uma conta de pai, mãe ou responsável; a ativação fica pendente até o vínculo ser aceito e a maioridade do responsável ser confirmada por evidência confiável. Menores de 16 anos também ficam sujeitos aos requisitos adicionais de autorização aplicáveis.
- Mitigação de viés e avaliação por grupos devem ser validadas antes de usar estimativa facial para qualquer decisão. Uma estimativa facial não deve ser a única prova de idade.

## Contrato do veredito

O módulo `web/src/lib/conecta-id-verdict.ts` produz o payload mínimo e falha de forma segura. A propriedade `evidenceVerified` é exclusivamente interna: somente um adaptador de servidor que valide evidência real pode defini-la como verdadeira. Nunca mapear diretamente campos enviados pelo cliente para essa propriedade.

`dados_originais_deletados` reflete o resultado informado pelo pipeline de processamento; o helper não apaga arquivos por conta própria. A ativação só é permitida quando há evidência confiável, faixa etária determinada, exclusão confirmada dos dados originais e, para menores de 16 anos, responsável autenticado.

## Parentescos e contas de responsáveis

A página Conexões oferece convites privados de parentesco (por exemplo, pai/mãe, filho(a), irmão/irmã, avós, cônjuge e outros) e uma associação separada de responsável. Convites precisam ser aceitos pela outra conta; os vínculos não são públicos por padrão e não constituem prova legal de parentesco. O endpoint exige autenticação e origem confiável, e o responsável precisa ter uma decisão etária confiável e vigente de 18+. As tabelas novas têm RLS ativado e acesso direto revogado para usuários autenticados; a API server-side medeia as operações.

## Gate obrigatório de acesso à rede

O Conecta ID é obrigatório para abrir as áreas sociais. A navegação consulta `/api/identity/access`, mas a navegação sozinha não é a barreira de segurança: a migration `20261014220000_conecta_id_required_network_access.sql` adiciona uma função server-side e políticas RLS restritivas às tabelas sociais, para impedir acesso direto via Supabase.

Para liberar a rede, a conta precisa ter **identidade aprovada**, decisão etária confiável e recente (até 60 dias), método confiável (`verified_age_credential` ou `authorized_provider_callback`) e, para menores, vínculo aceito com responsável cuja identidade e maioridade também estejam verificadas. Autodeclaração, OCR, QR local, PDF assinado isoladamente e prova de vida experimental não liberam o acesso. Se o serviço falhar ou não estiver configurado, a decisão é negar acesso.

A tela de Conecta ID mostra o estado das etapas e mantém as associações de responsável disponíveis durante o bloqueio, sem liberar feed, mensagens, comunidades ou outras áreas sociais. O fluxo pago continua desativado até existir preço divulgado, consentimento explícito e cobrança testada. Até existir uma fonte gratuita confiável capaz de aprovar identidade e idade no servidor, usuários não verificados continuarão bloqueados; a interface não deve oferecer um botão de “continuar sem verificação”.

## Estado atual e próximos componentes

O helper de decisão e seus testes, a interface de parentescos e o endpoint server-side são uma base de contrato, não um provedor de identidade completo. Para uma verificação real, ainda é necessário integrar uma fonte confiável legalmente acessível ou concluir a validação criptográfica da cadeia de certificados e da titularidade; implementar a vinculação do responsável; e garantir a exclusão efetiva de arquivos/buffers no pipeline. Até isso estar pronto, o fluxo atual deve continuar pendente e não pode criar decisões adultas por si só.

Nenhuma migration ou implantação é executada por esta especificação.
