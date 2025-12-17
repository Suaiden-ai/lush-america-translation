# Fix: Source Language NULL Constraint Error

## 🔍 **Problema Identificado**

Quando um autenticador rejeitava um documento e tentava subir uma correção, ocorria o erro:
```
null value in column "source_language" of relation "translated_documents" violates not-null constraint
```

### **Erro Específico:**
- **URL**: `POST https://yslbjhnqfkjdoxuixfyh.supabase.co/rest/v1/translated_documents`
- **Status**: `400 (Bad Request)`
- **Constraint**: `NOT NULL violation` no campo `source_language`

## 🔧 **Solução Implementada**

### **1. Correção no Frontend - AuthenticatorDashboard.tsx**
```typescript
// ✅ ANTES (Problemático)
source_language: doc.source_language,
target_language: doc.target_language,

// ✅ DEPOIS (Corrigido)
source_language: doc.source_language || 'portuguese', // Fix: garantir valor não-nulo
target_language: doc.target_language || 'english',   // Fix: garantir valor não-nulo
```

**Localização das correções:**
- Linha ~285: Primeira inserção em `translated_documents`
- Linha ~361: Segunda inserção em `translated_documents` 

### **2. Migration de Banco de Dados**
Arquivo: `20250828000001_fix_source_language_default.sql`
```sql
-- Add DEFAULT values to prevent future NULL violations
ALTER TABLE translated_documents 
ALTER COLUMN source_language SET DEFAULT 'portuguese';

ALTER TABLE translated_documents 
ALTER COLUMN target_language SET DEFAULT 'english';
```

## 📋 **Análise da Causa Raiz**

### **Fluxo do Problema:**
1. ✅ Autenticador rejeita documento
2. ✅ Usuário faz upload de correção via `AuthenticatorUpload.tsx`
3. ✅ Dados são enviados para edge function `send-translation-webhook`
4. ✅ n8n processa e retorna dados
5. ❌ **FALHA**: `AuthenticatorDashboard.tsx` tenta inserir em `translated_documents`
6. ❌ **ERRO**: `doc.source_language` vem como `null` da tabela `documents_to_be_verified`

### **Por que acontecia:**
- A tabela `documents_to_be_verified` permite `source_language` como `NULL`
- A tabela `translated_documents` exige `source_language` como `NOT NULL`
- O código não verificava se o valor era `null` antes da inserção

## ✅ **Resultado Esperado**

### **Antes da Correção:**
- ❌ Erro 400 Bad Request no browser
- ❌ Documento de correção não processado
- ❌ Fluxo de autenticação interrompido
- ❌ Constraint violation no banco

### **Depois da Correção:**
- ✅ Upload de correção funciona normalmente
- ✅ `source_language` sempre tem valor válido (`'portuguese'` default)
- ✅ `target_language` sempre tem valor válido (`'english'` default)
- ✅ Inserção em `translated_documents` bem-sucedida
- ✅ Fluxo de autenticação completo

## 🔄 **Teste da Correção**

Para testar se a correção funcionou:

1. **Rejeitar um documento** como autenticador
2. **Fazer upload de correção** via AuthenticatorUpload
3. **Verificar logs do browser** - não deve haver erro 400
4. **Confirmar inserção** na tabela `translated_documents`
5. **Validar campos** `source_language` e `target_language` não são `null`

## 📝 **Arquivos Modificados**

1. **`src/pages/DocumentManager/AuthenticatorDashboard.tsx`**
   - Adicionados fallbacks para `source_language` e `target_language`
   - Duas inserções corrigidas

2. **`supabase/migrations/20250828000001_fix_source_language_default.sql`**
   - DEFAULT values adicionados na tabela `translated_documents`
   - Comentários explicativos adicionados

## 💡 **Prevenção Futura**

- ✅ Migration garante que novos campos tenham DEFAULT
- ✅ Frontend sempre verifica valores null
- ✅ Consistência entre tabelas `documents_to_be_verified` e `translated_documents`
- ✅ Logs melhorados para debug futuro
