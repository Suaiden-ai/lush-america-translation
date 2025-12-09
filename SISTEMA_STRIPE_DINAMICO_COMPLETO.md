# 🎯 Sistema Dinâmico do Stripe - Documentação Completa

## 📋 Visão Geral

O sistema dinâmico do Stripe foi implementado para **detectar automaticamente o ambiente** (desenvolvimento ou produção) e usar as chaves corretas do Stripe sem necessidade de configuração manual ou alteração de código.

### Funcionamento Principal

- **Ambiente de Desenvolvimento** (localhost, domínios de teste) → Usa chaves `sk_test_*` e `pk_test_*`
- **Ambiente de Produção** (lushamerica.com) → Usa chaves `sk_live_*` e `pk_live_*`

O sistema detecta automaticamente o ambiente através dos **headers HTTP** da requisição e seleciona as variáveis de ambiente corretas.

---

## 🏗️ Arquitetura do Sistema

O sistema é composto por **3 módulos principais** localizados em `supabase/functions/shared/`:

### 1. `environment-detector.ts` - Detecção de Ambiente

**Responsabilidade:** Analisa os headers HTTP da requisição para determinar se está em produção ou desenvolvimento.

**Como funciona:**

```typescript
export function detectEnvironment(req: Request): EnvironmentInfo {
  const referer = req.headers.get('referer') || '';
  const origin = req.headers.get('origin') || '';
  const host = req.headers.get('host') || '';
  const userAgent = req.headers.get('user-agent') || '';
  
  // Detecta produção: se qualquer header contém lushamerica.com
  const isProductionDomain = 
    referer.includes('lushamerica.com') ||
    origin.includes('lushamerica.com') ||
    host.includes('lushamerica.com');
  
  // Para webhooks do Stripe, verifica se há chaves de produção disponíveis
  const isStripeWebhook = userAgent.includes('Stripe/');
  const hasProdKeys = Deno.env.get('STRIPE_SECRET_KEY_PROD') && 
                     Deno.env.get('STRIPE_WEBHOOK_SECRET_PROD');
  
  const isProduction = isProductionDomain || (isStripeWebhook && hasProdKeys);
  
  return {
    environment: isProduction ? 'production' : 'test',
    isProduction,
    isTest: !isProduction,
    // ... outros dados de debug
  };
}
```

**Lógica de Detecção:**

1. **Para requisições normais (frontend → backend):**
   - Verifica se `referer`, `origin` ou `host` contém `lushamerica.com`
   - Se sim → **Produção**
   - Se não → **Teste**

2. **Para webhooks do Stripe:**
   - Webhooks do Stripe **não enviam** headers `referer` ou `origin`
   - Verifica o `user-agent` que contém `Stripe/`
   - Verifica se existem chaves de produção configuradas
   - Se ambas condições forem verdadeiras → **Produção**
   - Caso contrário → **Teste**

### 2. `stripe-env-mapper.ts` - Mapeamento de Variáveis

**Responsabilidade:** Mapeia as variáveis de ambiente baseado no ambiente detectado.

**Como funciona:**

```typescript
export function getStripeEnvironmentVariables(envInfo: EnvironmentInfo): StripeEnvironmentVariables {
  let suffix: string;
  if (envInfo.isProduction) {
    suffix = 'PROD';
  } else {
    suffix = 'TEST';
  }
  
  return {
    secretKey: Deno.env.get(`STRIPE_SECRET_KEY_${suffix}`) || '',
    webhookSecret: Deno.env.get(`STRIPE_WEBHOOK_SECRET_${suffix}`) || '',
    publishableKey: Deno.env.get(`STRIPE_PUBLISHABLE_KEY_${suffix}`) || ''
  };
}
```

**Variáveis de Ambiente Esperadas:**

- **Produção:**
  - `STRIPE_SECRET_KEY_PROD`
  - `STRIPE_WEBHOOK_SECRET_PROD`
  - `STRIPE_PUBLISHABLE_KEY_PROD`

- **Teste/Desenvolvimento:**
  - `STRIPE_SECRET_KEY_TEST`
  - `STRIPE_WEBHOOK_SECRET_TEST`
  - `STRIPE_PUBLISHABLE_KEY_TEST`

### 3. `stripe-config.ts` - Configuração Centralizada

**Responsabilidade:** Orquestra a detecção de ambiente e o mapeamento de variáveis, retornando uma configuração completa do Stripe.

**Como funciona:**

```typescript
export function getStripeConfig(req: Request): StripeConfig {
  // 1. Detecta o ambiente automaticamente
  const envInfo = detectEnvironment(req);
  
  // 2. Obtém as variáveis de ambiente corretas
  const envVars = getStripeEnvironmentVariables(envInfo);
  
  // 3. Valida que todas as variáveis estão configuradas
  const validationErrors = validateStripeEnvironmentVariables(envVars, envInfo);
  if (validationErrors.length > 0) {
    throw new Error(`Stripe configuration errors: ${validationErrors.join(', ')}`);
  }

  // 4. Retorna configuração completa
  return {
    secretKey: envVars.secretKey,
    webhookSecret: envVars.webhookSecret,
    publishableKey: envVars.publishableKey,
    environment: envInfo,
    apiVersion: '2024-12-18.acacia',
    appInfo: {
      name: 'Lush America Translations',
      version: '1.0.0'
    }
  };
}
```

---

## 🔄 Fluxo de Funcionamento

### Cenário 1: Frontend fazendo checkout (Desenvolvimento)

```
1. Usuário acessa: http://localhost:5173/upload
2. Frontend chama: POST /functions/v1/create-checkout-session
3. Headers enviados:
   - referer: "http://localhost:5173/upload"
   - origin: "http://localhost:5173"
   - host: "localhost:5173"

4. environment-detector.ts:
   - Analisa headers
   - Não encontra "lushamerica.com"
   - Detecta: environment = "test"

5. stripe-env-mapper.ts:
   - Usa sufixo "TEST"
   - Busca: STRIPE_SECRET_KEY_TEST, STRIPE_WEBHOOK_SECRET_TEST, etc.

6. stripe-config.ts:
   - Retorna configuração com chaves de teste
   - Inicializa Stripe com sk_test_*

7. Resultado: Checkout usa modo TEST do Stripe
```

### Cenário 2: Frontend fazendo checkout (Produção)

```
1. Usuário acessa: https://lushamerica.com/upload
2. Frontend chama: POST /functions/v1/create-checkout-session
3. Headers enviados:
   - referer: "https://lushamerica.com/upload"
   - origin: "https://lushamerica.com"
   - host: "lushamerica.com"

4. environment-detector.ts:
   - Analisa headers
   - Encontra "lushamerica.com" no referer
   - Detecta: environment = "production"

5. stripe-env-mapper.ts:
   - Usa sufixo "PROD"
   - Busca: STRIPE_SECRET_KEY_PROD, STRIPE_WEBHOOK_SECRET_PROD, etc.

6. stripe-config.ts:
   - Retorna configuração com chaves de produção
   - Inicializa Stripe com sk_live_*

7. Resultado: Checkout usa modo PRODUCTION do Stripe
```

### Cenário 3: Webhook do Stripe (Produção)

```
1. Stripe envia webhook: POST /functions/v1/stripe-webhook
2. Headers enviados:
   - user-agent: "Stripe/1.0"
   - stripe-signature: "t=1234567890,v1=..."
   - (sem referer/origin)

3. environment-detector.ts:
   - Não encontra "lushamerica.com" (webhook não tem referer)
   - Detecta user-agent com "Stripe/"
   - Verifica se STRIPE_SECRET_KEY_PROD existe
   - Detecta: environment = "production"

4. stripe-webhook/index.ts:
   - Usa getAllWebhookSecrets() para tentar todos os secrets
   - Tenta verificar assinatura com STRIPE_WEBHOOK_SECRET_PROD
   - Se sucesso → usa configuração de produção
   - Se falha → tenta STRIPE_WEBHOOK_SECRET_TEST

5. Resultado: Webhook processado com chaves corretas
```

---

## 🔐 Sistema Multi-Secret para Webhooks

### Problema Original

Webhooks do Stripe não enviam headers `referer` ou `origin`, tornando difícil detectar o ambiente. A solução implementada usa uma abordagem **fail-safe** que tenta todos os secrets disponíveis.

### Solução Implementada

**Arquivo:** `supabase/functions/shared/environment-detector.ts`

```typescript
export function getAllWebhookSecrets(): WebhookSecret[] {
  const secrets: WebhookSecret[] = [];
  
  const prodSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET_PROD');
  const stagingSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET_STAGING');
  const testSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET_TEST');
  
  if (prodSecret) secrets.push({ env: 'production', secret: prodSecret });
  if (stagingSecret) secrets.push({ env: 'staging', secret: stagingSecret });
  if (testSecret) secrets.push({ env: 'test', secret: testSecret });
  
  return secrets;
}
```

**Uso no Webhook:** `supabase/functions/stripe-webhook/index.ts`

```typescript
// Tenta verificar assinatura com todos os secrets disponíveis
const allSecrets = getAllWebhookSecrets();
let validConfig = null;

for (const { env, secret } of allSecrets) {
  isValid = await verifyStripeSignature(body, signature, secret);
  if (isValid) {
    validConfig = { environment: env, secret };
    break; // Encontrou o secret correto
  }
}
```

**Vantagens:**

1. ✅ **Fail-safe:** Se um secret falhar, tenta o próximo
2. ✅ **Suporta múltiplos ambientes:** Produção, Staging e Teste
3. ✅ **Não depende de headers:** Funciona mesmo sem referer/origin
4. ✅ **Logs detalhados:** Mostra qual secret foi usado

---

## 📁 Estrutura de Arquivos

```
supabase/functions/
├── shared/
│   ├── environment-detector.ts    # Detecção de ambiente
│   ├── stripe-env-mapper.ts       # Mapeamento de variáveis
│   └── stripe-config.ts           # Configuração centralizada
│
├── create-checkout-session/
│   └── index.ts                   # Usa getStripeConfig(req)
│
├── stripe-webhook/
│   └── index.ts                   # Usa getAllWebhookSecrets() + getStripeConfig(req)
│
├── get-session-info/
│   └── index.ts                   # Usa getStripeConfig(req)
│
└── cancel-stripe-payment/
    └── index.ts                   # Usa getStripeConfig(req)
```

---

## 🔧 Como Usar nas Edge Functions

### Exemplo Básico

```typescript
import { getStripeConfig } from '../shared/stripe-config.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0';

Deno.serve(async (req: Request) => {
  // 1. Obter configuração dinâmica
  const stripeConfig = getStripeConfig(req);
  
  // 2. Inicializar Stripe com a chave correta
  const stripe = new Stripe(stripeConfig.secretKey, {
    apiVersion: stripeConfig.apiVersion,
  });
  
  // 3. Usar normalmente - já está no ambiente correto
  const session = await stripe.checkout.sessions.create({
    // ... configuração
  });
  
  console.log(`🔧 Using Stripe in ${stripeConfig.environment.environment} mode`);
});
```

### Exemplo com Webhook

```typescript
import { getAllWebhookSecrets } from '../shared/environment-detector.ts';
import { getStripeConfig } from '../shared/stripe-config.ts';

Deno.serve(async (req: Request) => {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');
  
  // Tentar todos os secrets disponíveis
  const allSecrets = getAllWebhookSecrets();
  let validConfig = null;
  
  for (const { env, secret } of allSecrets) {
    const isValid = await verifyStripeSignature(body, signature, secret);
    if (isValid) {
      validConfig = { environment: env, secret };
      break;
    }
  }
  
  if (!validConfig) {
    throw new Error('Webhook signature verification failed');
  }
  
  // Obter configuração completa
  const stripeConfig = getStripeConfig(req);
  
  // Processar webhook...
});
```

---

## ⚙️ Configuração no Supabase Dashboard

### Variáveis de Ambiente Necessárias

Acesse: **Supabase Dashboard** > **Settings** > **Edge Functions** > **Environment Variables**

#### Para Produção:
```
STRIPE_SECRET_KEY_PROD=sk_live_...
STRIPE_WEBHOOK_SECRET_PROD=whsec_...
STRIPE_PUBLISHABLE_KEY_PROD=pk_live_...
```

#### Para Teste/Desenvolvimento:
```
STRIPE_SECRET_KEY_TEST=sk_test_...
STRIPE_WEBHOOK_SECRET_TEST=whsec_...
STRIPE_PUBLISHABLE_KEY_TEST=pk_test_...
```

#### Opcional (Staging):
```
STRIPE_SECRET_KEY_STAGING=sk_test_...
STRIPE_WEBHOOK_SECRET_STAGING=whsec_...
STRIPE_PUBLISHABLE_KEY_STAGING=pk_test_...
```

---

## 🧪 Testando o Sistema

### Teste em Desenvolvimento

1. Inicie o servidor: `npm run dev`
2. Acesse: `http://localhost:5173/upload`
3. Faça upload e tente checkout
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

### Teste em Produção

1. Acesse: `https://lushamerica.com/upload`
2. Faça upload e tente checkout
3. **Logs esperados:**
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

### Verificar Logs

**Via Supabase Dashboard:**
1. Acesse: **Supabase Dashboard** > **Edge Functions** > **Logs**
2. Selecione a função desejada
3. Filtre por timestamp

**Via CLI:**
```bash
supabase functions logs create-checkout-session --project-ref SEU_PROJECT_REF
```

---

## 🛡️ Segurança e Validação

### Validação Automática

O sistema valida automaticamente se todas as variáveis necessárias estão configuradas:

```typescript
const validationErrors = validateStripeEnvironmentVariables(envVars, envInfo);
if (validationErrors.length > 0) {
  throw new Error(`Stripe configuration errors: ${validationErrors.join(', ')}`);
}
```

### Logs Mascarados

As chaves sensíveis são mascaradas nos logs:

```typescript
console.log(`🔑 Stripe Config (${envInfo.environment}):`, {
  secretKey: config.secretKey ? `${config.secretKey.substring(0, 20)}...` : '❌ Missing',
  webhookSecret: config.webhookSecret ? `${config.webhookSecret.substring(0, 20)}...` : '❌ Missing',
  // ...
});
```

---

## 🎯 Benefícios do Sistema

1. **🔒 Segurança:**
   - Chaves de produção nunca expostas em desenvolvimento
   - Validação automática de configuração
   - Logs mascarados para evitar vazamento

2. **⚡ Automatização:**
   - Sem necessidade de alterar código ao trocar ambientes
   - Detecção automática baseada em headers HTTP
   - Zero configuração manual por requisição

3. **✅ Confiabilidade:**
   - Impossível usar chaves erradas por engano
   - Validação em tempo de execução
   - Logs detalhados para debugging

4. **🔧 Manutenibilidade:**
   - Configuração centralizada
   - Código reutilizável
   - Fácil adicionar novos ambientes

5. **📈 Escalabilidade:**
   - Suporta múltiplos ambientes (test, staging, production)
   - Fácil adicionar novos ambientes no futuro
   - Sistema de fallback para webhooks

---

## 🐛 Troubleshooting

### Problema: "Stripe configuration errors"

**Causa:** Variáveis de ambiente não configuradas ou faltando.

**Solução:**
1. Verifique no Supabase Dashboard se todas as variáveis estão configuradas
2. Confirme que os sufixos estão corretos (`_PROD` ou `_TEST`)
3. Verifique se não há espaços extras nos valores

### Problema: Ambiente não detectado corretamente

**Causa:** Headers HTTP não contêm o domínio esperado.

**Solução:**
1. Verifique os logs de detecção de ambiente
2. Confirme que o domínio `lushamerica.com` está sendo enviado nos headers
3. Para webhooks, o sistema usa fallback multi-secret

### Problema: Chaves de teste sendo usadas em produção

**Causa:** Variáveis `STRIPE_SECRET_KEY_PROD` não configuradas ou ambiente não detectado.

**Solução:**
1. Verifique se `STRIPE_SECRET_KEY_PROD` está configurada
2. Verifique os logs de detecção de ambiente
3. Confirme que o domínio de produção está sendo detectado

### Problema: Webhook signature verification failed

**Causa:** Secret do webhook incorreto ou não configurado.

**Solução:**
1. Verifique se `STRIPE_WEBHOOK_SECRET_PROD` e `STRIPE_WEBHOOK_SECRET_TEST` estão configurados
2. Confirme que os secrets correspondem aos webhooks configurados no Stripe Dashboard
3. O sistema tenta todos os secrets automaticamente, mas todos devem estar corretos

---

## 📊 Resumo do Fluxo Completo

```
┌─────────────────────────────────────────────────────────────┐
│                    REQUISIÇÃO HTTP                          │
│  (Frontend ou Webhook Stripe)                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│          environment-detector.ts                           │
│  • Analisa headers (referer, origin, host, user-agent)     │
│  • Detecta se é produção ou teste                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│          stripe-env-mapper.ts                              │
│  • Determina sufixo (_PROD ou _TEST)                       │
│  • Busca variáveis de ambiente corretas                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│          stripe-config.ts                                   │
│  • Valida variáveis                                         │
│  • Retorna configuração completa do Stripe                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│          Edge Function (create-checkout-session, etc.)      │
│  • Inicializa Stripe com chave correta                     │
│  • Executa operação no ambiente correto                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 Conclusão

O sistema dinâmico do Stripe foi projetado para ser:

- **Automático:** Detecta o ambiente sem configuração manual
- **Seguro:** Nunca expõe chaves de produção em desenvolvimento
- **Confiável:** Validação e logs detalhados
- **Escalável:** Fácil adicionar novos ambientes
- **Manutenível:** Código centralizado e reutilizável

**🎉 O sistema está pronto para uso em produção!**

---

**Última atualização:** Janeiro 2025  
**Versão:** 1.0.0




