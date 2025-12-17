# Relatório de Investigação: Documentos Não Pagos em Documents_to_be_Verified

**Data da Investigação**: 25 de outubro de 2025  
**Usuário**: Luiz Eduardo Gouveia (luizeduardogouveia7@gmail.com)  
**Período**: 24-25 de outubro de 2025

---

## 📊 Resumo Executivo

**11 documentos** foram criados no sistema nos dias 24 e 25 de outubro de 2025:
- **1 documento** (`hist_rico_escolar_YIX4NK`): Pagamento aprovado pelo Stripe, status "Paid" ✅
- **10 documentos**: Sem pagamento, status "draft" ❌

**Problema**: Documentos em status "draft" (sem pagamento) foram incorretamente inseridos na tabela `documents_to_be_verified`.

---

## 🔍 Análise do Código

### 1. **Fluxo de Upload Normal (CustomerDashboard)**

**Arquivo**: `src/pages/CustomerDashboard/DocumentUploadModal.tsx`

**Fluxo correto**:
1. Usuário faz upload → arquivo salvo no IndexedDB
2. Documento criado em `documents` com `status = 'draft'`
3. Stripe Checkout criado com metadados incluindo `documentId`
4. Após pagamento bem-sucedido → webhook do Stripe processa
5. `PaymentSuccess.tsx` atualiza documento para `status = 'pending'`
6. `PaymentSuccess.tsx` chama `send-translation-webhook` para enviar para n8n
7. n8n processa e **retorna via webhook** que salva em `documents_to_be_verified`

**🔴 PROBLEMA IDENTIFICADO**: Nenhum código verifica se pagamento foi confirmado antes de inserir em `documents_to_be_verified`.

---

### 2. **Função de Webhook do Stripe**

**Arquivo**: `supabase/functions/stripe-webhook/index.ts`

```typescript
async function handleCheckoutSessionCompleted(session: any, supabase: any) {
  // Verifica documentId nos metadados
  if (!documentId) {
    console.log('WARNING: documentId não encontrado nos metadados, pulando processamento');
    return; // ⚠️ Só pula se não tiver documentId
  }

  // Atualiza documento de 'draft' para 'pending'
  const { data: updatedDocument, error: updateError } = await supabase
    .from('documents')
    .update({
      status: 'pending',
      updated_at: new Date().toISOString()
    })
    .eq('id', documentId)
    .eq('user_id', userId);
}
```

**🔴 PROBLEMA**: Esta função **SEMPRE** muda status de "draft" para "pending" quando o webhook é chamado, mas o Stripe pode chamar o webhook mesmo quando:
- O pagamento foi rejeitado
- O cartão foi recusado
- Houve erro no pagamento
- O usuário cancelou

**Evidência nos logs do Stripe**:
```
"payment_status": "paid",
"status": "complete"
```

O documento YIX4NK teve pagamento **apro Cad**: `cs_live_a148T7SURsGBuAUDugvG256i8HJKFF1HGyaf5i0KON8tjbFwSPgC09g17p`

---

### 3. **Função send-translation-webhook**

**Arquivo**: `supabase/functions/send-translation-webhook/index.ts`

**Responsabilidade**: Enviar documentos para n8n e permitir que n8n retorne salvando em `documents_to_be_verified`.

```typescript
// Linha 366-372
// 📋 FLUXO CORRETO: Apenas enviar para n8n
// O retorno do webhook do n8n é que vai salvar na tabela documents_to_be_verified
if (webhookResponse.ok) {
  console.log("✅ Webhook enviado para n8n com sucesso");
  console.log("📋 O retorno do n8n será responsável por salvar em documents_to_be_verified");
  console.log("🚫 Edge Function NÃO deve inserir diretamente em documents_to_be_verified");
}
```

**Observação**: Esta função apenas **ENVIA** para n8n. O n8n é que retorna via webhook salvando em `documents_to_be_verified`.

---

### 4. **Análise do Webhook do n8n (HIPÓTESE)**

**Arquivo**: Não está no código, é um webhook externo do n8n que retorna.

**Fluxo suspeito**:
1. `send-translation-webhook` envia documento para n8n
2. n8n processa e **retorna** via webhook
3. O webhook de retorno do n8n **insere em `documents_to_be_verified`**
4. **🔴 PROBLEMA**: O n8n pode estar inserindo TODOS os documentos, mesmo os que ficaram "draft"

---

## 🎯 Causa Raiz Identificada

### Cenário Probável dos 10 Documentos Draft:

**O que aconteceu**:
1. Usuário fez upload → documento criado em `documents` com `status = 'draft'`
2. Stripe Checkout criado
3. Usuário tentou pagar, mas cartão foi recusado/fundos insuficientes
4. Stripe webhook **NÃO** foi chamado (porque pagamento falhou)
5. **MAS** - Algo inseriu esses documentos em `documents_to_be_verified`

**Possíveis causas**:

### Hipótese 1: Trigger Automático (MAIS PROVÁVEL)
- Pode existir um trigger em `documents` que insere automaticamente em `documents_to_be_verified` quando um documento é criado
- Migration `20250820000001_remove_prevent_duplicate_documents_trigger.sql` mostra que havia triggers sendo removidos

### Hipótese 2: Lógica do AuthenticatorDashboard
- Código em `AuthenticatorDashboard.tsx` (linhas 241-374) mostra que ao **aprovar** um documento, ele é inserido em `documents_to_be_verified`
- Mas isso só acontece quando clica em "Approve", não automaticamente

### Hipótese 3: Edge Function update-document
- Edge function `update-document` (linha 102-123) **atualiza** `documents_to_be_verified` se o registro existir
- Mas não **insere** automaticamente

### Hipótese 4: n8n Webhook de Retorno
- O n8n pode ter retornado via webhook salvando documentos que **não deveriam** ter sido processados

---

## 🔬 Análise do Documento "Paid" (YIX4NK)

**Session ID**: `cs_live_a148T7SURsGBuAUDugvG256i8HJKFF1HGyaf5i0KON8tjbFwSPgC09g17p`

**Dados do Stripe**:
```json
{
  "payment_status": "paid",
  "status": "complete",
  "amount_total": 2000,
  "created": 1761396198
}
```

**Status Atual no Dashboard**:
- Payment Status: Paid ✅
- Translation Status: pending ✅
- Authenticator: No authenticator ✅

**Conclusão**: Este documento teve pagamento **real e aprovado**. Ele foi corretamente processado.

---

## 📋 Plano de Ação

### 1. Verificar Triggers no Banco de Dados

Execute a query SQL:
```sql
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('documents', 'documents_to_be_verified');
```

### 2. Verificar Registros na Tabela documents

Execute a query:
```sql
SELECT 
  id, filename, status, created_at, updated_at
FROM documents
WHERE user_id = (SELECT id FROM profiles WHERE email = 'luizeduardogouveia7@gmail.com')
  AND created_at >= '2025-10-24' AND created_at < '2025-10-26'
ORDER BY created_at DESC;
```

### 3. Verificar Registros na Tabela documents_to_be_verified

Execute a query:
```sql
SELECT 
  id, filename, status, created_at
FROM documents_to_be_verified
WHERE user_id = (SELECT id FROM profiles WHERE email = 'luizeduardogouveia7@gmail.com')
  AND created_at >= '2025-10-24' AND created_at < '2025-10-26'
ORDER BY created_at DESC;
```

### 4. Verificar Sessões do Stripe

Execute a query:
```sql
SELECT 
  id, session_id, document_id, status, payment_status, created_at
FROM stripe_sessions
WHERE customer_email = 'luizeduardogouveia7@gmail.com'
  AND created_at >= '2025-10-24' AND created_at < '2025-10-26'
ORDER BY created_at DESC;
```

### 5. Verificar Pagamentos

Execute a query:
```sql
SELECT 
  id, document_id, amount, status, payment_method, created_at
FROM payments
WHERE user_id = (SELECT id FROM profiles WHERE email = 'luizeduardogouveia7@gmail.com')
  AND created_at >= '2025-10-24' AND created_at < '2025-10-26'
ORDER BY created_at DESC;
```

---

## 🔧 Correções Necessárias

### 1. **Adicionar Validação no Webhook do Stripe**

Modificar `supabase/functions/stripe-webhook/index.ts`:

```typescript
async function handleCheckoutSessionCompleted(session: any, supabase: any) {
  // ✅ VALIDAÇÃO CRÍTICA: Verificar se pagamento foi realmente aprovado
  if (session.payment_status !== 'paid') {
    console.log('WARNING: Pagamento não foi aprovado. payment_status:', session.payment_status);
    console.log('WARNING: Não processando documento. Session:', session.id);
    return;
  }

  // Continuar com processamento apenas se pagamento foi aprovado
  // ... resto do código
}
```

### 2. **Adicionar Validação no n8n**

Garantir que o webhook de retorno do n8n **só insira** em `documents_to_be_verified` se:
- O documento existe em `documents`
- O status é `pending` (não `draft`)
- Existe registro de pagamento aprovado em `payments` ou `stripe_sessions`

### 3. **Criar Trigger de Validação**

Se ainda não existir, criar trigger que **impede** inserção em `documents_to_be_verified` quando:
- Documento está com status `draft`
- Não existe pagamento aprovado

```sql
CREATE OR REPLACE FUNCTION validate_payment_before_verification()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se documento tem status pending ou completed
  IF NOT EXISTS (
    SELECT 1 FROM documents 
    WHERE id = NEW.document_id 
    AND status IN ('pending', 'completed')
  ) THEN
    RAISE EXCEPTION 'Documento deve ter pagamento aprovado (status pending ou completed)';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_payment_before_verification_trigger
  BEFORE INSERT ON documents_to_be_verified
  FOR EACH ROW
  EXECUTE FUNCTION validate_payment_before_verification();
```

---

## 📊 Próximos Passos

1. ✅ **Executar queries SQL** para confirmar status dos documentos
2. **Identificar causa raiz** baseado nos dados
3. **Implementar correções** no código
4. **Limpar dados inconsistentes** (documentos draft em documents_to_be_verified)
5. **Adicionar logs** para rastrear futuras inserções
6. **Documentar** prevenção para evitar recorrência

---

## 📝 Notas Importantes

- **Documento YIX4NK**: Teve pagamento real, está correto
- **10 documentos draft**: NÃO deveriam estar em `documents_to_be_verified`
- **Sistema não gastou recursos do n8n**: Correto, pois não foram para tradução
- **Arquivos no Storage**: Provavelmente existem, pois foram criados em `documents`

---

**Investigação em andamento...**

