# 🔧 Configuração Dinâmica do Stripe - Setup Guide

## ✅ Implementação Concluída

A configuração dinâmica do Stripe foi implementada com sucesso! O sistema agora detecta automaticamente o ambiente e usa as chaves corretas:

- **Produção** (lushamerica.com) → Sempre usa chaves `sk_live_*` e `pk_live_*`
- **Desenvolvimento** (localhost:5173) → Sempre usa chaves `sk_test_*` e `pk_test_*`

## 📋 Próximos Passos - Configuração no Supabase Dashboard

### 1. Acessar o Supabase Dashboard

1. Vá para [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecione o projeto **Lush America Translations**
3. Navegue para **Settings** > **Edge Functions** > **Environment Variables**

### 2. Adicionar Variáveis de Ambiente

#### Para Produção (sufixo _PROD):
```
STRIPE_SECRET_KEY_PROD=sk_live_...
STRIPE_WEBHOOK_SECRET_PROD=whsec_...
STRIPE_PUBLISHABLE_KEY_PROD=pk_live_...
```

#### Para Teste/Desenvolvimento (sufixo _TEST):
```
STRIPE_SECRET_KEY_TEST=sk_test_...
STRIPE_WEBHOOK_SECRET_TEST=whsec_...
STRIPE_PUBLISHABLE_KEY_TEST=pk_test_...
```

### 3. Variáveis Opcionais (manter para compatibilidade temporária)

Você pode manter as variáveis antigas durante o período de teste:
```
STRIPE_SECRET_KEY=(pode ser removido após testes)
STRIPE_WEBHOOK_SECRET=(pode ser removido após testes)
```

## 🧪 Como Testar

### Teste em Desenvolvimento (localhost:5173)

1. Inicie o servidor de desenvolvimento: `npm run dev`
2. Faça upload de um documento e tente fazer checkout
3. Verifique os logs da Edge Function `create-checkout-session`
4. **Logs esperados:**
   ```
   🔍 Environment Detection: {
     referer: "http://localhost:5173/...",
     environment: "test"
   }
   🔑 Stripe Config (test): {
     secretKey: "sk_test_51ABC123...",
     webhookSecret: "whsec_1234567890..."
   }
   ✅ Stripe config loaded for test environment
   🔧 Using Stripe in test mode
   ```

### Teste em Produção (lushamerica.com)

1. Acesse https://lushamerica.com
2. Faça upload de um documento e tente fazer checkout
3. Verifique os logs da Edge Function `create-checkout-session`
4. **Logs esperados:**
   ```
   🔍 Environment Detection: {
     referer: "https://lushamerica.com/...",
     environment: "production"
   }
   🔑 Stripe Config (production): {
     secretKey: "sk_live_51ABC123...",
     webhookSecret: "whsec_1234567890..."
   }
   ✅ Stripe config loaded for production environment
   🔧 Using Stripe in production mode
   ```

## 🔍 Verificação dos Logs

Para ver os logs das Edge Functions:

1. **Supabase Dashboard** > **Edge Functions** > **Logs**
2. Ou use o comando: `supabase functions logs --project-ref yslbjhnqfkjdoxuixfyh`

## 🚀 Edge Functions Modificadas

As seguintes Edge Functions foram atualizadas para usar a configuração dinâmica:

1. ✅ `create-checkout-session` - Criação de sessões de checkout
2. ✅ `stripe-webhook` - Processamento de webhooks
3. ✅ `get-session-info` - Informações de sessão
4. ✅ `cancel-stripe-payment` - Cancelamento de pagamentos

## 📁 Arquivos Criados

1. ✅ `supabase/functions/shared/environment-detector.ts` - Detecção de ambiente
2. ✅ `supabase/functions/shared/stripe-env-mapper.ts` - Mapeamento de variáveis
3. ✅ `supabase/functions/shared/stripe-config.ts` - Configuração centralizada

## 🛡️ Benefícios da Implementação

1. **Segurança:** Chaves de produção nunca expostas em desenvolvimento
2. **Automatização:** Sem necessidade de alterar código ao trocar ambientes
3. **Confiabilidade:** Impossível usar chaves erradas por engano
4. **Manutenibilidade:** Configuração centralizada e logs detalhados
5. **Escalabilidade:** Fácil adicionar novos ambientes (staging) no futuro

## 🔧 Troubleshooting

### Problema: "Stripe configuration errors"
**Solução:** Verificar se todas as variáveis com sufixo `_PROD` e `_TEST` estão configuradas no Supabase Dashboard

### Problema: Ambiente não detectado corretamente
**Solução:** Verificar se o domínio `lushamerica.com` está sendo detectado nos headers `referer`, `origin` ou `host`

### Problema: Chaves de teste sendo usadas em produção
**Solução:** Verificar se as variáveis `STRIPE_SECRET_KEY_PROD` estão configuradas corretamente

## 📞 Suporte

Se encontrar algum problema:

1. Verifique os logs das Edge Functions
2. Confirme que todas as variáveis de ambiente estão configuradas
3. Teste primeiro em desenvolvimento antes de testar em produção

---

**🎉 Parabéns!** O sistema de configuração dinâmica do Stripe está implementado e pronto para uso!
