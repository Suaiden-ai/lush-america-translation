# Document Duplication Fix

## 🚨 **Problema Identificado**

### **Duplicação de Documentos no Banco de Dados:**
- ❌ Documentos sendo inseridos em múltiplas tabelas
- ❌ Race conditions entre inserções
- ❌ Falta de verificações adequadas de duplicatas
- ❌ Múltiplos pontos de inserção sem coordenação

### **Causas da Duplicação:**

1. **Inserção Dupla nas Tabelas:**
   - `documents` (tabela principal)
   - `documents_to_be_verified` (tabela de verificação)

2. **Múltiplos Pontos de Inserção:**
   - Frontend insere na tabela `documents`
   - Edge function insere na tabela `documents_to_be_verified`
   - AuthenticatorUpload insere em ambas as tabelas

3. **Verificações de Duplicata Insuficientes:**
   - Race conditions entre inserções
   - Verificações baseadas apenas em `user_id` e `filename`
   - Falta de constraints únicos adequados

## ✅ **Solução Implementada**

### **1. Constraints Únicos no Banco de Dados:**

```sql
-- Tabela documents
ALTER TABLE documents 
ADD CONSTRAINT unique_user_filename_status 
UNIQUE (user_id, filename, status);

-- Tabela documents_to_be_verified
ALTER TABLE documents_to_be_verified 
ADD CONSTRAINT unique_user_filename_status_verified 
UNIQUE (user_id, filename, status);

-- Nota: A unicidade do file_id é tratada pelos triggers, não por constraints
-- para evitar problemas de compatibilidade com constraints parciais
```

### **2. Triggers Anti-Duplicação:**

```sql
-- Trigger para documents
CREATE TRIGGER prevent_document_duplicates
  BEFORE INSERT ON documents
  FOR EACH ROW
  EXECUTE FUNCTION check_document_exists();

-- Trigger para documents_to_be_verified
CREATE TRIGGER prevent_verification_duplicates
  BEFORE INSERT ON documents_to_be_verified
  FOR EACH ROW
  EXECUTE FUNCTION check_verification_document_exists();
```

### **3. Função Centralizada de Inserção:**

```sql
CREATE OR REPLACE FUNCTION safe_insert_document(
  p_user_id UUID,
  p_filename TEXT,
  p_pages INTEGER DEFAULT 1,
  p_status TEXT DEFAULT 'pending',
  -- ... outros parâmetros
)
RETURNS TABLE(
  document_id UUID,
  verification_code TEXT,
  message TEXT
)
```

**Funcionalidades:**
- ✅ Verifica duplicatas antes da inserção
- ✅ Insere automaticamente em ambas as tabelas
- ✅ Retorna informações do documento existente se já existir
- ✅ Gera códigos de verificação únicos

### **4. Função de Limpeza de Duplicatas:**

```sql
CREATE OR REPLACE FUNCTION cleanup_duplicate_documents()
RETURNS TABLE(
  table_name TEXT,
  duplicates_removed INTEGER,
  message TEXT
)
```

**Funcionalidades:**
- ✅ Remove documentos duplicados existentes
- ✅ Mantém apenas o registro mais recente
- ✅ Limpa ambas as tabelas

## 🔧 **Implementação no Código**

### **1. Edge Function Atualizada:**

```typescript
// Antes: Inserção direta com risco de duplicata
const { data: verifyData, error: verifyError } = await supabase
  .from('documents_to_be_verified')
  .insert(insertData)
  .select();

// Depois: Uso da função anti-duplicação
const { data: insertResult, error: insertError } = await supabase
  .rpc('safe_insert_document', {
    p_user_id: user_id,
    p_filename: filename,
    // ... outros parâmetros
  });
```

### **2. Frontend Atualizado:**

```typescript
// Antes: Inserção direta
const { data: newDocument, error: createError } = await supabase
  .from('documents')
  .insert(documentData)
  .select()
  .single();

// Depois: Uso da função anti-duplicação
const { data: insertResult, error: createError } = await supabase
  .rpc('safe_insert_document', {
    p_user_id: user.id,
    p_filename: selectedFile.name,
    // ... outros parâmetros
  });
```

## 📊 **Benefícios da Solução**

### **1. Prevenção de Duplicatas:**
- ✅ Constraints únicos no banco de dados
- ✅ Triggers que bloqueiam inserções duplicadas
- ✅ Verificações automáticas antes da inserção

### **2. Consistência de Dados:**
- ✅ Inserção coordenada em ambas as tabelas
- ✅ Códigos de verificação únicos
- ✅ Relacionamentos consistentes entre tabelas

### **3. Facilidade de Manutenção:**
- ✅ Função centralizada para inserção
- ✅ Lógica anti-duplicação em um só lugar
- ✅ Fácil atualização e debugging

### **4. Performance:**
- ✅ Menos consultas ao banco
- ✅ Menos processamento de duplicatas
- ✅ Índices otimizados para verificações

## 🚀 **Como Aplicar a Correção**

### **1. Executar a Migration (Versão Corrigida):**

**⚠️ IMPORTANTE:** Use a versão corrigida da migration para evitar erros de sintaxe:

```bash
# Aplicar a migration corrigida no Supabase
supabase db push
```

**Arquivo da Migration:** `supabase/migrations/20250815000007_fix_document_duplication_v2.sql`

**Principais Correções:**
- ✅ Removido constraint único problemático com `WHERE file_id IS NOT NULL`
- ✅ Unicidade do `file_id` tratada pelos triggers
- ✅ Sintaxe compatível com diferentes versões do PostgreSQL
- ✅ Verificações de duplicata mantidas via triggers

```bash
# Aplicar a migration no Supabase
supabase db push
```

### **2. Verificar Constraints:**

```sql
-- Verificar se as constraints foram criadas
SELECT constraint_name, table_name 
FROM information_schema.table_constraints 
WHERE constraint_type = 'UNIQUE' 
  AND table_name IN ('documents', 'documents_to_be_verified');
```

### **3. Testar a Função:**

```sql
-- Testar inserção segura
SELECT * FROM safe_insert_document(
  'user-uuid-here',
  'test-document.pdf',
  1,
  'pending',
  25.00,
  false,
  'portuguese',
  'english',
  'pending',
  NULL,
  'Test Client',
  'Certificado',
  'Portuguese',
  25.00
);
```

### **4. Limpar Duplicatas Existentes:**

```sql
-- Executar limpeza de duplicatas existentes
SELECT * FROM cleanup_duplicate_documents();
```

## 🔍 **Monitoramento e Debugging**

### **1. Logs da Edge Function:**
- ✅ Verificação de duplicatas antes da inserção
- ✅ Uso da função `safe_insert_document`
- ✅ Tratamento de documentos existentes

### **2. Logs do Frontend:**
- ✅ Uso da função `safe_insert_document`
- ✅ Tratamento de resultados da inserção
- ✅ Verificação de documentos existentes

### **3. Verificações no Banco:**
- ✅ Constraints únicos ativos
- ✅ Triggers funcionando
- ✅ Funções executando corretamente

## 📝 **Arquivos Modificados**

### **1. Banco de Dados:**
- `supabase/migrations/20250815000007_fix_document_duplication_v2.sql` (versão corrigida)
- `supabase/migrations/20250815000007_fix_document_duplication.sql` (versão original com erro)

### **2. Edge Function:**
- `supabase/functions/send-translation-webhook/index.ts`

### **3. Frontend:**
- `src/pages/DocumentManager/AuthenticatorUpload.tsx`
- `src/pages/CustomerDashboard/UploadDocument.tsx`
- `src/pages/CustomerDashboard/DocumentUploadModal.tsx`

## 🎯 **Resultado Esperado**

### **Antes da Correção:**
- ❌ Documentos duplicados em ambas as tabelas
- ❌ Inconsistências de dados
- ❌ Códigos de verificação duplicados
- ❌ Problemas de relacionamento

### **Depois da Correção:**
- ✅ Apenas um documento por combinação única
- ✅ Dados consistentes entre tabelas
- ✅ Códigos de verificação únicos
- ✅ Relacionamentos corretos
- ✅ Prevenção automática de duplicatas futuras

## 🔒 **Segurança e Permissões**

### **1. RLS (Row Level Security):**
- ✅ Funções executam com `SECURITY DEFINER`
- ✅ Usuários autenticados podem executar funções
- ✅ Políticas de acesso mantidas

### **2. Validação de Dados:**
- ✅ Verificação de parâmetros de entrada
- ✅ Sanitização de dados antes da inserção
- ✅ Tratamento de erros adequado

## 📞 **Suporte e Manutenção**

### **1. Em Caso de Problemas:**
- ✅ Verificar logs da edge function
- ✅ Verificar constraints no banco de dados
- ✅ Testar função `safe_insert_document` diretamente
- ✅ Executar `cleanup_duplicate_documents` se necessário

### **2. Atualizações Futuras:**
- ✅ Modificar apenas a função `safe_insert_document`
- ✅ Manter constraints e triggers ativos
- ✅ Testar inserções antes de deploy

---

**Status:** ✅ **IMPLEMENTADO E TESTADO**

**Data:** 15 de Janeiro de 2025

**Responsável:** Equipe de Desenvolvimento

**Próximos Passos:** Monitorar logs e verificar se duplicatas ainda ocorrem
