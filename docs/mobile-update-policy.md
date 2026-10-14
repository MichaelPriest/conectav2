# Conecta V2 — política de atualização do APK

## Regra da primeira versão

A primeira versão Android é distribuída por APK instalado diretamente, fora da Google Play. As atualizações devem ser descobertas, baixadas e verificadas **dentro do próprio Conecta**. O usuário não deve precisar abrir GitHub, navegador ou uma página externa para baixar um APK.

## Fluxo obrigatório

1. O app consulta as publicações oficiais `mobile-vX.Y.Z` do repositório Conecta V2 ao iniciar e quando volta ao primeiro plano, respeitando o intervalo de verificação.
2. O atualizador só considera APKs de uma Release pública, com nome e caminho correspondentes à versão, tamanho permitido e SHA-256 verificável.
3. O download ocorre dentro do app, com progresso visível; o tamanho e o SHA-256 são verificados antes de abrir o instalador do Android.
4. O app pede ao Android para instalar o APK verificado. O Android pode exigir autorização para instalar por essa fonte e sempre mantém a confirmação do usuário; não prometemos nem tentamos instalação silenciosa.
5. O pacote novo precisa manter o mesmo application ID e a mesma chave de assinatura permanente. Se a assinatura não corresponder, o Android deve rejeitar a atualização; nunca orientar o usuário a desinstalar a versão atual como atalho.
6. Se não houver SHA-256 confiável, a atualização permanece bloqueada e o app informa que deve tentar novamente depois. Não redirecionar o usuário para baixar manualmente pelo GitHub e não aceitar artifacts temporários do Actions.
7. A distribuição pela Google Play é um canal separado e futuro; não deve ser presumida nem exigida no primeiro lançamento.

## Publicação de cada versão

- Incrementar a versão do app e o `versionCode` Android.
- Gerar o APK pelo workflow oficial de release, usando a chave permanente já validada; não assinar versões sucessivas com uma chave debug/efêmera.
- Publicar uma Release `mobile-vX.Y.Z` e anexar `conecta-v2-android-X.Y.Z.apk`.
- Incluir no corpo da Release `APK-SHA256: <64 caracteres hexadecimais>` e `APK-SIZE: <bytes>`, calculados a partir do APK final anexado.
- Confirmar que o digest publicado corresponde exatamente ao arquivo anexado e que a assinatura Android é compatível com a versão instalada.
- Não anunciar a atualização como disponível até o APK e os metadados de integridade estarem publicados.

## Limites de segurança e experiência

- A atualização não pode alterar nem apagar os dados de conta no Supabase; dados locais temporários e rascunhos ainda podem existir no dispositivo, então o app alerta o usuário antes da instalação.
- Não usar APKs de artifacts de CI como feed de atualização: são temporários e podem exigir autenticação.
- Não contornar a confirmação do instalador Android, assinatura de pacote ou proteção contra downgrade/arquivo adulterado.
- A atualização é iniciada no app, mas o sistema operacional controla a instalação final. O Android pode exibir uma tela do instalador e solicitar uma confirmação explícita.
- O fluxo de iOS, caso seja incluído futuramente, usa o mecanismo de distribuição da Apple; esta política descreve o APK Android sideloaded.

## Estado atual

O app já contém monitor de versão, download dentro do app, verificação de tamanho/SHA-256 e chamada ao instalador Android. O fluxo foi ajustado para não abrir o GitHub como alternativa quando o APK não tem digest confiável. A conclusão ainda depende de testes automatizados executados, build real, validação em aparelho e publicação de uma Release assinada com a chave permanente. Não afirmar que atualização de ponta a ponta foi homologada antes dessas etapas.
