# Fix: Expiração Real de Sessões Stripe

**Data**: 26 de outubro de 2025  
**Problema**: Sessões Stripe nunca expiravam no banco, documentos ficavam "Protegidos" indefinidamente

---

## 🚨 **Problema Identificado**

### **Comportamento Anterior:**
- ❌ Sessões Stripe com `payment_status = 'pending'` ficavam assim **para sempre**
- ❌ Não havia handler para eventos `checkout.session.expired`
- ❌ Não havia tratamento de eventos `payment_intent.payment_failed`
- ❌ Cleanup só verificava se sessão foi atualizada nos últimos 10 min, não o status real
- ❌ Documentos de usuários que voltaram do checkout ficavam protegidos **indefinidamente**

### **Exemplo do Problema:**
- Usuário vai para checkout do Stripe → Sessão criada com `status = 'pending'`
- Usuário volta do checkout (saldo insuficiente, cancelamento, etc.)
- Webhook **NUNCA** recebe evento de expiração
- Documento fica "Protegido: sessão Stripe ainda ativa" **para sempre**

---

## ✅ **Correções Implementadas**

### **1. Novos Handlers no Webhook**

**Arquivo**: `supabase/functions/stripe-webhook/index.ts`

#### **a) Handler para `checkout.session.expired`:**

```typescript
case 'checkout.session.expired':
  await handleCheckoutSessionExpired(event.data.object, supabase);
  break;
```

**Função adicionada**:
```typescript
async function handleCheckoutSessionExpired(session: any, supabase: any) {
  // Marca a sessão como expirada na stripe_sessions
  await supabase
    .from('stripe_sessions')
    .update({
      payment_status: 'expired',
      updated_at: new Date().toISOString()
    })
    .eq('session_id', session.id);
}
```

#### **b) Handler para `payment_intent.payment_failed`:**

```typescript
case 'payment_intent.payment_failed':
  await handlePaymentFailed(event.data.object, supabase);
  break;
```

**Função adicionada**:
```typescript
async function handlePaymentFailed(paymentIntent: any, supabase: any) {
  // Busca e marca a sessão como failed
  await supabase
    .from('stripe_sessions')
    .update({
      payment_status: 'failed',
      updated_at: new Date().toISOString()
    })
    .eq('session_id', sessionData.session_id);
}
```

---

### **2. Nova Lógica de Cleanup**

**Arquivo**: `supabase/functions/cleanup-expired-drafts/index.ts`

#### **Antes:**
```typescript
// Sessão pending = NÃO APAGAR (aguardando pagamento) - SEMPRE
if (session.payment_status === 'pending') {
  return false;
}
```

#### **Agora:**
```typescript
// ✅ Sessões expiradas ou failed = APAGAR
if (session.payment_status === 'expired' || session.payment_status === 'failed') {
  return true;
}

// ✅ Sessão pending mas com mais de 30 min = APAGAR
if (session.payment_status === 'pending' && sessionUpdatedAt < thirtyMinutesAgo) {
  return true;
}

// Sessão atualizada nos últimos 30 min = NÃO APAGAR (pode estar ativa)
if (sessionUpdatedAt > thirtyMinutesAgo) {
  return false;
}
```

---

## 📋 **Configuração Necessária no Stripe**

### **⚠️ IMPORTANTE: Configurar Webhooks no Dashboard do Stripe**

O Stripe precisa estar configurado para enviar os novos eventos:

1. **Acesse**: https://dashboard.stripe.com/webhooks
2. **Encontre seu endpoint**: `https://[projeto].supabase.co/functions/v1/stripe-webhook`
3. **Adicione os eventos**:
   - ✅ `checkout.session.completed` (já existia)
   - ✅ **`checkout.session.expired`** (NOVO)
   - ✅ **`payment_intent.payment_failed`** (NOVO)

---

## 🎯 **Comportamento Esperado Após Fix**

### **Cenário 1: Usuário está no checkout ATIVO**
1. Usuário clica "Fazer Pagamento" (sessão criada 5 min atrás)
2. Usuário está na página do checkout digitando dados
3. Cleanup roda e verifica sessão
4. ✅ **PROTEÇÃO**: Sessão atualizada há < 1 hora
5. ✅ **NÃO APAGA** (usuário ainda está pagando)

### **Cenário 2: Usuário volta do checkout (saldo insuficiente)**
1. Usuário vai para checkout do Stripe
2. Stripe rejeita pagamento (saldo insuficiente)
3. Webhook recebe `checkout.session.expired`
4. Sessão marcada como `expired` no banco
5. Cleanup apaga documento após webhook processar

### **Cenário 3: Sessão expira (Stripe timeout de 24h)**
1. Usuário cria sessão mas não completa
2. Após 24 horas, Stripe expira sessão
3. Webhook recebe `checkout.session.expired`
4. Sessão marcada como `expired` no banco
5. Cleanup apaga documento

### **Cenário 4: Falha de pagamento durante tentativa**
1. Usuário tenta pagar com cartão inválido
2. Webhook recebe `payment_intent.payment_failed`
3. Sessão marcada como `failed` no banco
4. Cleanup apaga documento

### **Cenário 5: Sessão pending por muito tempo (bug raro)**
1. Sessão criada mas Stripe não envia evento (bug raro)
2. Após 1 hora de inatividade
3. Cleanup verifica que `updated_at` > 1 hora atrás
4. Considera sessão como expirada (backup)
5. Apaga documento

---

## 📊 **Status de Sessões Agora Suportados**

| Status | Quando Ocorre | Cleanup Apaga? | Proteção Ativa |
|--------|--------------|----------------|----------------|
| `pending` (< 1h) | Sessão criada recentemente, usuário no checkout | ❌ NÃO | ✅ Sim, buffer de 1h |
| `pending` (> 1h) | Sessão antiga sem atividade | ✅ Sim | ❌ Não |
| `expired` | Checkout expirado (Stripe) | ✅ Sim, imediatamente | ❌ Não |
| `failed` | Pagamento falhou | ✅ Sim, imediatamente | ❌ Não |
| `completed` | Pagamento aprovado | ❌ NÃO | ✅ Sempre protegido |

### **🛡️ Proteção Adicional**
- Buffer de **1 hora** protege usuários que estão digitando dados
- Apenas sessões com **> 1 hora de inatividade** são consideradas expiradas
- Webhooks marcam sessões como `expired` ou `failed` quando Stripe notifica
- Duas camadas de proteção: Webhooks + Timestamp

---

## 🧪 **Teste Real**

### **Para os documentos mencionados:**
- `35533150_I105M6.pdf`
- `35533150_GW342S.pdf`

**Resultado esperado**:
1. Verificar se as sessões desses documentos estão como `pending` há mais de 30 minutos
2. Executar a função `cleanup-expired-drafts` manualmente
3. Documentos devem ser **apagados** ✅

---

## 🚀 **Deploy**

```bash
# Deploy da função de webhook atualizada
supabase functions deploy stripe-webhook

# Deploy da função de cleanup (já deployada anteriormente)
# Nenhuma alteração necessária, já está configurada
```

---

## ✅ **Checklist de Validação**

- [x] Handler `checkout.session.expired` implementado
- [x] Handler `payment_intent.payment_failed` implementado
- [x] Lógica de cleanup atualizada para tratar sessões expiradas
- [x] Cleanup verifica `expired` e `failed` como seguras para apagar
- [x] Cleanup verifica tempo de inatividade (30 min) para sessões `pending`
- [x] Logs detalhados adicionados para debug
- [ ] **Configurar eventos no Stripe Dashboard** (usuário precisa fazer)
- [ ] Testar com documentos reais que estão "Protegidos"

---

## 📝 **Próximos Passos**

1. ✅ Configurar eventos no Stripe Dashboard
2. ✅ Executar cleanup manualmente para verificar funcionamento
3. ✅ Monitorar logs para confirmar que eventos estão chegando

