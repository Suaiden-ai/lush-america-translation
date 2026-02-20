# Guia de Atualização de Credenciais Stripe (Migração para Conta Suaiden)

Este documento é um guia de referência para substituição das credenciais Stripe no Supabase.
As chaves reais **não devem ser armazenadas aqui** — use o Supabase Dashboard diretamente.

> **⚠️ Atenção:** Acesse `Settings > Edge Functions > Management Executable Secrets` no Supabase Dashboard para configurar as variáveis abaixo com os valores corretos.

## 1. Ambiente de TESTE (Test Mode)
Use estas chaves para habilitar testes seguros na conta nova.

| Variável | Descrição |
| :--- | :--- |
| `STRIPE_PUBLISHABLE_KEY_TEST` | Chave pública de teste — começa com `pk_test_` |
| `STRIPE_SECRET_KEY_TEST` | Chave secreta de teste — começa com `sk_test_` |
| `STRIPE_WEBHOOK_SECRET_TEST` | Webhook secret de teste — começa com `whsec_` |

---

## 2. Ambiente de PRODUÇÃO (Live Mode)
Use estas chaves apenas quando estiver pronto para receber pagamentos reais na conta nova.

| Variável | Descrição |
| :--- | :--- |
| `STRIPE_PUBLISHABLE_KEY_PROD` | Chave pública de produção — começa com `pk_live_` |
| `STRIPE_SECRET_KEY_PROD` | Chave secreta de produção — começa com `sk_live_` |
| `STRIPE_WEBHOOK_SECRET_PROD` | Webhook secret de produção — começa com `whsec_` |

---

## 3. Onde encontrar as chaves?
- Acesse [https://dashboard.stripe.com](https://dashboard.stripe.com) com a conta Suaiden.
- Vá em **Developers > API Keys** para as chaves de API.
- Vá em **Developers > Webhooks** para os Webhook Secrets.

---

## 4. Checklist de Verificação Pós-Troca

1.  [ ] **Teste:** Faça uma compra de teste com cartão `4242 4242 4242 4242`.
    *   Verifique se apareceu no Stripe Dashboard (Suaiden) > Test Mode > Payments.
2.  [ ] **Produção:** Faça uma compra real de $1.00 (se possível).
    *   Verifique se o recibo chegou com o nome "Lush America Translations" (configurado na conta Suaiden).
3.  [ ] **Webhook:** Verifique se as Edge Functions não deram erro de "Signature verification failed" nos logs.
