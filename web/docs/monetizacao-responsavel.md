# Monetização responsável · Conecta V2

Entrega inicial: **captação de interesse voluntário**, sem cobrança, assinaturas ativas, receita fictícia ou anúncios novos. A interface está em `/apoiar`; a administração real em `/gestao-monetizacao` (somente `platform_moderators.role='admin'`).

- Conecta Plus (preço proposto R$ 14,90/mês);
- Conecta Negócios (preço proposto R$ 49,90/mês);
- Parcerias locais (referência proposta a partir de R$ 150/campanha).

**Nada será cobrado** até integrar provedor real de pagamentos com webhooks assinados, faturas, cancelamentos, reembolsos e persistência de direitos no backend. O registro NÃO ativa vantagens de plano.

## Banco e privacidade

Migration: `supabase/migrations/20261010_conecta_monetization_interests.sql`.

- RLS obrigatório; somente autenticados com faixa declarada adulta podem enviar solicitação;
- Usuário lê apenas suas próprias solicitações; administradores autorizados leem e atualizam somente o status;
- `INSERT` restrito aos campos editáveis; `UPDATE` restrito à coluna `status`; `anon` sem acesso;
- Uma solicitação por modalidade por conta impede duplicação trivial; permite retirar interesse e apagar os dados de contato dessa solicitação;
- E-mail fornecido conscientemente só é usado para contato sobre a proposta; não usar para anúncios/comportamento ou compartilhar com anunciantes.

Para exclusão de dados de contato, o administrador deverá atender solicitações por canal de privacidade e apagar o registro correspondente usando mecanismo administrativo autorizado. Não armazenar CPF, dados de cartão ou menores.

## Próxima etapa antes de receita

1. Confirmar política legal, termos, privacidade, consentimento e retenção de contatos comerciais;
2. Preparar hospedagem comercial compatível (Hobby da Vercel não permite uso comercial);
3. Integrar Stripe, Mercado Pago ou outro gateway licenciado (checkout hospedado);
4. Webhook assinado/idempotente, estados reais de assinatura, concessão/revogação de benefícios no servidor, cancelamento e reembolsos;
5. Implementar campanhas patrocinadas moderadas, **sempre rotuladas** e somente após análise de idade aplicável. A regra existente de anúncios para maiores verificados permanece inalterada.
6. Medir custo real de Supabase/Vercel/mídias versus receita líquida; definir domínio próprio depois.
