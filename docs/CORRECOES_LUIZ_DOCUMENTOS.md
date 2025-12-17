# Correções Aplicadas: Documentos Não Pagos

**Data**: 25 de outubro de 2025  
**Usuário Afetado**: Luiz Eduardo Gouveia (luizeduardogouveia7@gmail.com)  
**Problema**: Documentos em status "draft" foram inseridos em `documents_to_be_verified` sem pagamento

---

## ✅ Correções Implementadas

### 1. **Validação de Pagamento no Webhook do Stripe**

**Arquivo**: `supabase/functions/stripe-webhook/index.ts`

**Mudança aplicada**:
```typescript
async function handleCheckoutSessionCompleted(session: any, supabase: any) {
  // ✅ VALIDAÇÃO CRÍTICA: Verificar se pagamento foi realmente aprovado
  if (session.payment_status !== 'paid' || session.status !== 'complete') {
    console.log('⚠️ [WEBHOOK WARNING] Pagamento não foi aprovado.');
    console.log('⚠️ payment_status:', session.payment_status);
    console.log('⚠️ status:', session.status);
    console.log('⚠️ Session ID:', session.id);
    console.log('⚠️ NÃO processando documento.');
    return;
  }

  console.log('✅ [WEBHOOK DEBUG] Pagamento confirmado. Processando documento...');
  // ... resto do código continua
}
```

**O que isso previne**:
- Webhook processa documentos sem pagamento
- Muda status de "draft" para "pending" quando pagamento falhou
- Insere documentos em `documents_to_be_verified` sem pagamento confirmado

---

## 🔧 Próximos Passos Recomendados

### 1. Executar Queries de Verificação

Execute as seguintes queries no SQL Editor do Supabase para confirmar o estado atual:

```sql
-- 1. Verificar documentos do Luiz
SELECT 
  id, 
  filename, 
  status, 
  created_at, 
  updated_at
FROM documents
WHERE user_id = (SELECT id FROM profiles WHERE email = 'luizeduardogouveia7@gmail.com')
  AND created_at >= '2025-10-24' AND created_at < '2025-10-26'
ORDER BY created_at DESC;

-- 2. Verificar documentos em documents_to_be_verified
SELECT 
  id, 
  filename, 
  status, 
  created_at
FROM documents_to_be_verified
WHERE user_id = (SELECT id FROM profiles WHERE email = 'luizeduardogouveia7@gmail.com')
  AND created_at >= '2025-10-24' AND created_at < '2025-10-26'
ORDER BY created_at DESC;

-- 3. Verificar pagamentos
SELECT 
  id, 
  document_id, 
  amount, 
  status, 
  payment_method, 
  created_at
FROM payments
WHERE user_id = (SELECT id FROM profiles WHERE email = 'luizeduardogouveia7@gmail.com')
  AND created_at >= '2025-10-24' AND created_at < '2025-10-26'
ORDER BY created_at DESC;
```

### 2. Limpar Dados Inconsistentes

**ATENÇÃO**: Execute apenas se confirmar que os documentos estão incorretamente em `documents_to_be_verified`:

```sql
-- Remover documentos draft de documents_to_be_verified
-- APENAS EXECUTE SE TIVER CERTEZA DE QUE SÃO DRAFT SEM PAGAMENTO

DELETE FROM documents_to_be_verified
WHERE user_id = (SELECT id FROM profiles WHERE email = 'luizeduardogouveia7@gmail.com')
  AND created_at >= '2025-10-24' AND created_at < '2025-10-26'
  AND NOT EXISTS (
    SELECT 1 FROM documents d 
    WHERE d.verification_code = documents_to_be_verified.verification_code
    AND d.status = 'pending'
  );
```

### 3. Verificar Storage

Verifique no painel do Supabase Storage quais arquivos existem:
- Vá para Storage → `documents` bucket
- Procure por arquivos do usuário Luiz (user_id: 4aba4aff-47fa-458f-bd17-1b34666c370c)
- Confirme quais arquivos realmente foram salvos

---

## 📊 Status dos Documentos

### Documento YIX4NK (Paid) ✅
- **Status**: Pagamento aprovado
- **Session**: `cs_live_a148T7SURsGBuAUDugvG256i8HJKFF1HGyaf5i0KON8tjbFwSPgC09g17p`
- **Payment Status**: `paid`
- **Status**: `complete`
- **Ação**: CORRETO - este documento deve estar em `documents_to_be_verified`

### 10 Documentos Draft ❌
- **Status**: Draft (sem pagamento)
- **Problema**: Provavelmente foram inseridos incorretamente em `documents_to_be_verified`
- **Ação**: Verificar e remover se não têm pagamento confirmado

---

## 🎯 Prevenção Futura

### O que a correção garante:
1. ✅ Webhook do Stripe só processa documentos com pagamento confirmado
2. ✅ Documentos "draft" não serão movidos para "pending" sem pagamento
3. ✅ Documentos sem pagamento não serão inseridos em `documents_to_be_verified`

### Logs adicionais:
- Mensagens de warning quando pagamento não foi aprovado
- Confirmação quando pagamento é processado com sucesso
- Session ID logado para rastreabilidade

---

## 📝 Arquivos Modificados

1. ✅ `supabase/functions/stripe-webhook/index.ts` - Adicionada validação de pagamento
2. ✅ `investigation_luiz_documents.sql` - Queries de investigação
3. ✅ `INVESTIGACAO_LUIZ_RELATORIO.md` - Relatório completo
4. ✅ `CORRECOES_LUIZ_DOCUMENTOS.md` - Este documento

---

## 🚀 Deploy da Correção

Para aplicar a correção em produção:

```bash
# 1. Deploy da edge function corrigida
supabase functions deploy stripe-webhook

# 2. Verificar logs após deploy
supabase functions logs stripe-webhook --tail

# 3. Monitorar eventos do Stripe
# Verificar no painel do Stripe que novos eventos estão sendo processados corretamente
```

---

## 📞 Contato

Se houver dúvidas ou problemas:
1. Verificar logs da edge function `stripe-webhook`
2. Verificar logs do n8n para confirmar que não recebe documentos não pagos
3. Consultar relatório completo em `INVESTIGACAO_LUIZ_RELATORIO.md`

---

**Correção implementada em**: 25 de outubro de 2025  
**Status**: ✅ Pronto para deploy

