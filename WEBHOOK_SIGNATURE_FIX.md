# Correção do Problema de Assinatura do Webhook Stripe

## Problema Identificado

O webhook do Stripe está falhando com erro de verificação de assinatura em produção. O problema é que o sistema está detectando o ambiente como TESTE em vez de PRODUÇÃO, causando o uso das chaves erradas.

## Análise dos Logs

```
ERROR: Webhook signature verification failed: No signatures found matching the expected signature for payload
```

**Causa raiz**: O webhook está sendo detectado como ambiente TESTE, mas deveria ser PRODUÇÃO.

## Soluções Implementadas

### 1. Melhor Detecção de Ambiente

Atualizei o `environment-detector.ts` para:
- Detectar webhooks do Stripe pelo User-Agent
- Verificar se as variáveis de produção estão disponíveis
- Usar lógica mais robusta para determinar o ambiente

### 2. Logs de Debug Aprimorados

Adicionei logs detalhados para:
- Mostrar qual ambiente está sendo detectado
- Exibir informações sobre as chaves sendo usadas
- Debug da verificação de assinatura

### 3. Script de Teste

Criei `test-webhook-config.ts` para verificar a configuração.

## Configuração Necessária

### Variáveis de Ambiente Obrigatórias

Certifique-se de que estas variáveis estão configuradas no Supabase:

**Para Produção:**
```
STRIPE_SECRET_KEY_PROD=sk_live_...
STRIPE_WEBHOOK_SECRET_PROD=whsec_...
STRIPE_PUBLISHABLE_KEY_PROD=pk_live_...
```

**Para Teste:**
```
STRIPE_SECRET_KEY_TEST=sk_test_...
STRIPE_WEBHOOK_SECRET_TEST=whsec_...
STRIPE_PUBLISHABLE_KEY_TEST=pk_test_...
```

### Verificação das Configurações

1. **Verificar no Dashboard do Supabase:**
   - Vá para Settings > Edge Functions
   - Verifique se todas as variáveis estão configuradas

2. **Testar a configuração:**
   ```bash
   # Execute o script de teste
   deno run --allow-env supabase/functions/test-webhook-config.ts
   ```

## Próximos Passos

1. **Verificar variáveis de ambiente** no Supabase
2. **Deploy das correções** para produção
3. **Testar webhook** com um pagamento real
4. **Monitorar logs** para confirmar que está funcionando

## Debug Adicional

Se o problema persistir, verifique:

1. **URL do webhook no Stripe:**
   - Deve apontar para: `https://[seu-projeto].supabase.co/functions/v1/stripe-webhook`

2. **Chave do webhook no Stripe:**
   - Deve corresponder à variável `STRIPE_WEBHOOK_SECRET_PROD`

3. **Logs detalhados:**
   - Os novos logs mostrarão qual ambiente está sendo detectado
   - Verificar se está usando as chaves corretas

## Monitoramento

Após o deploy, monitore os logs para:
- ✅ "Environment detected: PRODUCTION"
- ✅ "Using Stripe in production mode"
- ✅ "Assinatura verificada com sucesso"

Se ainda houver problemas, os logs detalhados ajudarão a identificar a causa exata.
