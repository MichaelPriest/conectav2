# E-mails do Conecta · Supabase Auth

Seis modelos de e-mail de autenticação em português, com a identidade visual roxa do Conecta V2. Sem imagens remotas, rastreamento ou scripts.

## Projeto
Supabase: `opdlxxrcdsxqmlhgayfm` (`conecta Project`). Não aplicar em outros projetos.

## Templates
- `confirmation.html` — **Confirme seu e-mail | Conecta**
- `recovery.html` — **Recupere sua senha | Conecta**
- `invite.html` — **Você recebeu um convite | Conecta**
- `magic_link.html` — **Seu link de acesso | Conecta**
- `email_change.html` — **Confirme a alteração do e-mail | Conecta**
- `reauthentication.html` — **Seu código de segurança | Conecta**

Os modelos de confirmação, recuperação, convite, link de acesso e mudança de e-mail usam `{{ .ConfirmationURL }}`. A reautenticação usa `{{ .Token }}`. Essas variáveis são resolvidas pelo Supabase; nunca substitua links de verificação por caminhos fixos.

## Aplicação no painel

1. Abra [Authentication > Email Templates](https://supabase.com/dashboard/project/opdlxxrcdsxqmlhgayfm/auth/templates). Cole o HTML de cada arquivo no evento correspondente e preencha o assunto do `manifest.json`.
2. Configure **Authentication > URL Configuration** com o Site URL de produção **real**. Autorize especificamente os redirects usados pelo site: `/auth/callback?next=/onboarding` (confirmação) e `/auth/callback?next=/auth/redefinir-senha` (recuperação). Evite curingas de domínio em produção.
3. Em **Authentication > SMTP Settings**, configure um provedor SMTP transacional, domínio de envio verificado e nome do remetente **Conecta**. Não use o serviço de e-mail padrão do Supabase em produção para envio geral.
4. Não desative confirmações de conta para contornar erro de SMTP. Desative **link tracking** no provedor, pois ele pode quebrar o token de uso único.
5. Teste o envio para um e-mail seu, a confirmação da conta e a redefinição de senha; confira a pasta spam e logs de Auth.

> Apenas versionar estes arquivos não altera as configurações remotas. Para publicar diretamente com um token pessoal do Supabase, use o script `sync.mjs`.

## Sincronização segura pela API de gerenciamento

No terminal na raiz do repositório:

```bash
export SUPABASE_PROJECT_REF=opdlxxrcdsxqmlhgayfm
export SUPABASE_ACCESS_TOKEN="token_pessoal_do_painel"
node supabase/email-templates/sync.mjs           # verifica sem alterar
node supabase/email-templates/sync.mjs --apply   # aplica os templates
node supabase/email-templates/sync.mjs           # confirma os valores
```

No PowerShell: `$env:SUPABASE_PROJECT_REF="opdlxxrcdsxqmlhgayfm"` e `$env:SUPABASE_ACCESS_TOKEN="..."`.

Obtenha seu token pessoal em https://supabase.com/dashboard/account/tokens. **Nunca publique o token nem o copie para o GitHub ou chat.** O script não altera SMTP, limites, usuários, provedor nem URL do projeto, somente assunto e corpo dos templates. O projeto fica bloqueado por ref por padrão.

Documentação: https://supabase.com/docs/guides/auth/auth-email-templates e https://supabase.com/docs/guides/auth/auth-smtp
