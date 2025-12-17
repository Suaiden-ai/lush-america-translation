# Sistema de Diferenciação: Uso Interno vs. Tradução para Cliente

## 📋 Visão Geral

O sistema permite que **autenticadores** diferenciem entre documentos para **uso pessoal interno** e documentos para **clientes que pagaram pelo serviço**. Documentos marcados como uso interno **não aparecem** no Admin Dashboard e **não são contabilizados** em nenhuma estatística ou cálculo de receita.

---

## 🎯 Objetivo

Permitir que autenticadores usem o sistema para traduzir seus próprios documentos pessoais sem que esses documentos:
- Apareçam no Admin Dashboard
- Sejam contabilizados nas estatísticas
- Afetem os cálculos de Total Revenue
- Sejam incluídos em relatórios financeiros

---

## 🔧 Implementação no Dashboard do Autenticador

### Interface de Seleção

**Arquivo:** `src/pages/DocumentManager/AuthenticatorUpload.tsx`

O autenticador escolhe o tipo de upload através de um campo `select`:

```675:705:src/pages/DocumentManager/AuthenticatorUpload.tsx
                {/* Upload Type */}
                <section>
                  <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="upload-type">
                    3. Upload Type
                  </label>
                  <select
                    id="upload-type"
                    value={uploadType}
                    onChange={e => {
                      const newType = e.target.value as 'client' | 'personal';
                      setUploadType(newType);
                      // Limpar campos quando mudar para personal use
                      if (newType === 'personal') {
                        setClientName('');
                        setPaymentMethod('card');
                        setReceiptFile(null);
                        setReceiptFileUrl(null);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500 text-base"
                    aria-label="Upload type"
                  >
                    <option value="client">For Client</option>
                    <option value="personal">Personal Use</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {uploadType === 'client' 
                      ? 'This document is for a client who paid for translation services.'
                      : 'This document is for your personal use and will not be counted in statistics.'}
                  </p>
                </section>
```

**Opções:**
- **"For Client"** (`client`): Documento para um cliente que pagou pelo serviço
- **"Personal Use"** (`personal`): Documento para uso pessoal do autenticador

### Comportamento da Interface

Quando o autenticador seleciona **"Personal Use"**:
- ✅ Campo "Client Name" desaparece
- ✅ Campo "Payment Method" desaparece
- ✅ Campo "Receipt Upload" desaparece
- ✅ Campos relacionados a cliente são limpos automaticamente

Quando seleciona **"For Client"**:
- ✅ Campo "Client Name" aparece (obrigatório)
- ✅ Campo "Payment Method" aparece
- ✅ Campo "Receipt Upload" aparece

---

## 💾 Salvamento no Banco de Dados

### Campo `is_internal_use`

**Tabela:** `documents`  
**Tipo:** `BOOLEAN`  
**Default:** `FALSE`

O valor é definido durante a criação do documento:

```307:336:src/pages/DocumentManager/AuthenticatorUpload.tsx
        const { data: createdDoc, error: createError } = await supabase
          .from('documents')
          .insert({
            user_id: user?.id,
            filename: uniqueFileName, // Usar nome único com código aleatório
            pages: pages,
            status: 'pending',
            total_cost: valor,
            tipo_trad: tipoTrad,
            valor: valor,
            idioma_raiz: idiomaRaiz,
            // idioma_destino: idiomaDestino, // Temporariamente comentado até criar a coluna no banco
            is_bank_statement: isExtrato,
            file_url: publicUrl,
            verification_code: `AUTH${Math.random().toString(36).substr(2, 7).toUpperCase()}`,
            ...(uploadType === 'client' && {
              client_name: clientName.trim(),
              payment_method: paymentMethod,
              receipt_url: customPayload?.receiptPath ? supabase.storage.from('documents').getPublicUrl(customPayload.receiptPath).data.publicUrl : null,
            }),
            is_internal_use: uploadType === 'personal',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...(isExtrato && {
              source_currency: sourceCurrency,
              target_currency: targetCurrency
            })
          })
          .select()
          .single();
```

**Lógica:**
```typescript
is_internal_use: uploadType === 'personal'
```

- Se `uploadType === 'personal'` → `is_internal_use = true`
- Se `uploadType === 'client'` → `is_internal_use = false`

### Migration do Campo

**Arquivo:** `supabase/migrations/20250131000005_add_is_internal_use_to_documents.sql`

```sql
-- Add is_internal_use column to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS is_internal_use BOOLEAN DEFAULT FALSE;

-- Update existing records to have default value (false)
UPDATE documents 
SET is_internal_use = FALSE
WHERE is_internal_use IS NULL;

-- Create index for better performance on is_internal_use field
CREATE INDEX IF NOT EXISTS idx_documents_is_internal_use ON documents(is_internal_use);

-- Add comment to document the new field
COMMENT ON COLUMN documents.is_internal_use IS 'Indicates if document is for authenticator personal use (true) or for a client (false). Personal use documents should not be counted in financial/admin statistics.';
```

---

## 🚫 Filtragem nos Dashboards

### Admin Dashboard - DocumentsTable

**Arquivo:** `src/pages/AdminDashboard/DocumentsTable.tsx`

Documentos com `is_internal_use = true` **não aparecem** na tabela:

```74:84:src/pages/AdminDashboard/DocumentsTable.tsx
      // ✅ QUERY CORRIGIDA PARA INCLUIR DADOS DE DOCUMENTS_TO_BE_VERIFIED
      // Excluir documentos de uso pessoal (is_internal_use = true) das estatísticas
      let query = supabase
        .from('documents')
        .select(`
          *,
          profiles!documents_user_id_fkey(name, email, phone, role),
          payments!payments_document_id_fkey(payment_method, status, amount, currency)
        `)
        .or('is_internal_use.is.null,is_internal_use.eq.false')
        .order('created_at', { ascending: false });
```

**Filtro aplicado:**
```typescript
.or('is_internal_use.is.null,is_internal_use.eq.false')
```

Isso significa:
- ✅ Inclui documentos onde `is_internal_use IS NULL` (documentos antigos)
- ✅ Inclui documentos onde `is_internal_use = false` (para clientes)
- ❌ **Exclui** documentos onde `is_internal_use = true` (uso pessoal)

### Admin Dashboard - StatsCards

**Arquivo:** `src/pages/AdminDashboard/StatsCards.tsx`

Documentos de uso interno **não são contados** nas estatísticas:

```113:119:src/pages/AdminDashboard/StatsCards.tsx
        // 1) Buscar documentos da tabela documents (mesma query da DocumentsTable)
        // Excluir documentos de uso pessoal (is_internal_use = true) das estatísticas
        let query = supabase
          .from('documents')
          .select('id, status, is_internal_use, profiles!documents_user_id_fkey(role)')
          .or('is_internal_use.is.null,is_internal_use.eq.false')
          .order('created_at', { ascending: false });
```

**Mesmo filtro aplicado:** `.or('is_internal_use.is.null,is_internal_use.eq.false')`

### Finance Dashboard - StatsCards

**Arquivo:** `src/pages/FinanceDashboard/StatsCards.tsx`

Documentos de uso interno **não são incluídos** nos cálculos de revenue:

```133:161:src/pages/FinanceDashboard/StatsCards.tsx
      // Revenue de autenticadores não é incluída no Total Revenue
      // pois não é lucro (valores ficam pending e não são pagos)
      // Excluir documentos de uso pessoal (is_internal_use = true)
      const authenticatorRevenue = documentsData?.reduce((sum, doc) => {
        if (doc.profiles?.role === 'authenticator' && !doc.is_internal_use) {
          return sum + (doc.total_cost || 0);
        }
        return sum;
      }, 0) || 0;
      
      // Total Revenue: apenas pagamentos completed de usuários regulares
      const totalRevenue = regularRevenue;
      
      console.log('🔍 Debug - StatsCards total_revenue (only completed payments):', totalRevenue);
      console.log('🔍 Debug - User Uploads revenue (from payments table, status=completed):', regularRevenue);
      console.log('🔍 Debug - Authenticator Uploads revenue (excluded from total):', authenticatorRevenue);
      
      // Estatísticas de tradução calculadas mas não utilizadas no momento
      // const calculatedTranslationStats = {
      //   total_documents: allDocs.length,
      //   completed_translations: allDocs.filter(d => d.status === 'completed').length,
      //   pending_translations: allDocs.filter(d => d.status === 'pending').length,
      //   total_revenue: totalRevenue
      // };
      
      // Separar por tipo de usuário
      // Excluir documentos de uso pessoal (is_internal_use = true)
      const userDocs = allDocs.filter(d => d.profiles?.role === 'user' && !d.is_internal_use);
      const authenticatorDocs = allDocs.filter(d => d.profiles?.role === 'authenticator' && !d.is_internal_use);
```

**Filtros aplicados:**
- `!doc.is_internal_use` - Exclui documentos de uso pessoal do cálculo de revenue
- `.filter(d => !d.is_internal_use)` - Exclui documentos de uso pessoal das estatísticas

### Finance Dashboard - PaymentsTable

**Arquivo:** `src/pages/FinanceDashboard/PaymentsTable.tsx`

Documentos de uso interno **não aparecem** na tabela de pagamentos:

```134:140:src/pages/FinanceDashboard/PaymentsTable.tsx
      // Buscar todos os documentos da tabela principal (como no Admin Dashboard)
      // Excluir documentos de uso pessoal (is_internal_use = true) das estatísticas
      let mainDocumentsQuery = supabase
        .from('documents')
        .select('*, profiles:profiles!documents_user_id_fkey(name, email, phone, role)')
        .or('is_internal_use.is.null,is_internal_use.eq.false')
        .order('created_at', { ascending: false });
```

**Mesmo filtro:** `.or('is_internal_use.is.null,is_internal_use.eq.false')`

---

## 🗄️ Filtragem nas Funções SQL

### Funções Atualizadas

**Arquivo:** `supabase/migrations/20250131000006_filter_internal_use_from_stats_functions.sql`

Todas as funções SQL foram atualizadas para excluir documentos de uso interno:

#### 1. `get_translation_stats_filtered`

```18:29:supabase/migrations/20250131000006_filter_internal_use_from_stats_functions.sql
    RETURN QUERY
    SELECT 
        COUNT(*) as total_documents,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_documents,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_documents,
        COALESCE(SUM(total_cost), 0) as total_revenue,
        COALESCE(AVG(total_cost), 0) as avg_revenue_per_doc
    FROM documents
    WHERE (start_date IS NULL OR created_at >= start_date)
      AND (end_date IS NULL OR created_at <= end_date)
      AND (is_internal_use IS NULL OR is_internal_use = false);
```

**Filtro:** `AND (is_internal_use IS NULL OR is_internal_use = false)`

#### 2. `get_translation_stats`

```118:129:supabase/migrations/20250131000006_filter_internal_use_from_stats_functions.sql
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_documents,
    COUNT(*) FILTER (WHERE status = 'completed')::bigint as completed_translations,
    COUNT(*) FILTER (WHERE status = 'pending')::bigint as pending_translations,
    COALESCE(SUM(total_cost), 0) as total_revenue
  FROM documents
  WHERE 
    (start_date IS NULL OR created_at >= start_date::timestamptz)
    AND (end_date IS NULL OR created_at <= end_date::timestamptz)
    AND (is_internal_use IS NULL OR is_internal_use = false);
```

**Filtro:** `AND (is_internal_use IS NULL OR is_internal_use = false)`

#### 3. `get_enhanced_translation_stats`

```184:196:supabase/migrations/20250131000006_filter_internal_use_from_stats_functions.sql
  WITH user_stats AS (
    -- Statistics for regular user uploads (excluding internal use)
    SELECT 
      COUNT(*)::bigint as total,
      COUNT(*) FILTER (WHERE d.status = 'completed')::bigint as completed,
      COUNT(*) FILTER (WHERE d.status = 'pending')::bigint as pending,
      COALESCE(SUM(d.total_cost), 0) as revenue
    FROM documents d
    JOIN profiles p ON d.user_id = p.id
    WHERE p.role = 'user'
      AND (d.is_internal_use IS NULL OR d.is_internal_use = false)
      AND (start_date IS NULL OR d.created_at >= start_date::timestamptz)
      AND (end_date IS NULL OR d.created_at <= end_date::timestamptz)
```

**Filtro:** `AND (d.is_internal_use IS NULL OR d.is_internal_use = false)`

#### 4. `get_user_type_breakdown`

```276:294:supabase/migrations/20250131000006_filter_internal_use_from_stats_functions.sql
  RETURN QUERY
  SELECT 
    'Regular Users'::text as user_type,
    COUNT(*)::bigint as total_documents,
    COUNT(*) FILTER (WHERE d.status = 'completed')::bigint as completed_documents,
    COUNT(*) FILTER (WHERE d.status = 'pending')::bigint as pending_documents,
    COUNT(*) FILTER (WHERE d.status = 'processing')::bigint as processing_documents,
    COUNT(*) FILTER (WHERE d.status = 'rejected')::bigint as rejected_documents,
    COALESCE(SUM(d.total_cost), 0) as total_revenue,
    CASE 
      WHEN COUNT(*) > 0 THEN COALESCE(SUM(d.total_cost), 0) / COUNT(*)::numeric
      ELSE 0 
    END as avg_revenue_per_doc
  FROM documents d
  JOIN profiles p ON d.user_id = p.id
  WHERE p.role = 'user'
    AND (d.is_internal_use IS NULL OR d.is_internal_use = false)
    AND (start_date IS NULL OR d.created_at >= start_date::timestamptz)
    AND (end_date IS NULL OR d.created_at <= end_date::timestamptz)
```

**Filtro:** `AND (d.is_internal_use IS NULL OR d.is_internal_use = false)`

---

## 📊 Impacto nos Cálculos

### Total Revenue

Documentos de uso interno **NÃO afetam** o Total Revenue porque:

1. **Não têm pagamentos:** Autenticadores não pagam por documentos de uso pessoal
2. **São filtrados:** Todos os cálculos excluem `is_internal_use = true`
3. **Não aparecem nas queries:** Queries de pagamentos não retornam documentos de uso interno

### Estatísticas de Documentos

Documentos de uso interno **NÃO são contados** em:
- ✅ Total de documentos
- ✅ Documentos completados
- ✅ Documentos pendentes
- ✅ Revenue de autenticadores (apenas documentos para clientes)

### Authenticator Revenue

O cálculo de Authenticator Revenue **exclui explicitamente** documentos de uso interno:

```typescript
const authenticatorRevenue = documentsData?.reduce((sum, doc) => {
  if (doc.profiles?.role === 'authenticator' && !doc.is_internal_use) {
    return sum + (doc.total_cost || 0);
  }
  return sum;
}, 0) || 0;
```

**Condição:** `doc.profiles?.role === 'authenticator' && !doc.is_internal_use`

Isso significa:
- ✅ Inclui apenas documentos de autenticadores **para clientes**
- ❌ Exclui documentos de autenticadores **para uso pessoal**

---

## 🔄 Fluxo Completo

### 1. Autenticador Faz Upload

```
┌─────────────────────────────────────────┐
│  AuthenticatorUpload Component         │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ Upload Type Select:                │ │
│  │  ○ For Client                      │ │
│  │  ● Personal Use  ← Selecionado    │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Campos de cliente: OCULTOS            │
│  - Client Name: ❌                     │
│  - Payment Method: ❌                  │
│  - Receipt: ❌                         │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  handleDirectUpload()                   │
│                                         │
│  uploadType = 'personal'                │
│  is_internal_use = true                 │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  INSERT INTO documents                  │
│                                         │
│  {                                      │
│    user_id: 'auth_123',                 │
│    filename: 'doc.pdf',                 │
│    is_internal_use: true,  ← TRUE      │
│    client_name: NULL,                  │
│    payment_method: NULL,                │
│    ...                                  │
│  }                                      │
└─────────────────────────────────────────┘
```

### 2. Filtragem nas Queries

```
┌─────────────────────────────────────────┐
│  Admin Dashboard Query                  │
│                                         │
│  SELECT * FROM documents                │
│  WHERE ...                              │
│    AND (is_internal_use IS NULL         │
│         OR is_internal_use = false)    │
│                                         │
│  ❌ Documento com is_internal_use=true │
│     NÃO aparece no resultado            │
└─────────────────────────────────────────┘
```

### 3. Cálculo de Estatísticas

```
┌─────────────────────────────────────────┐
│  StatsCards Calculation                 │
│                                         │
│  const authenticatorDocs =              │
│    allDocs.filter(d =>                  │
│      d.profiles?.role === 'authenticator'│
│      && !d.is_internal_use  ← Filtro   │
│    );                                   │
│                                         │
│  ❌ Documentos de uso interno           │
│     NÃO são incluídos                   │
└─────────────────────────────────────────┘
```

---

## ✅ Resumo das Regras

### O que acontece com documentos de uso interno (`is_internal_use = true`):

| Aspecto | Comportamento |
|---------|--------------|
| **Admin Dashboard - Tabela** | ❌ Não aparece |
| **Admin Dashboard - Estatísticas** | ❌ Não é contado |
| **Finance Dashboard - Tabela** | ❌ Não aparece |
| **Finance Dashboard - Estatísticas** | ❌ Não é contado |
| **Total Revenue** | ❌ Não afeta (não tem pagamento) |
| **Authenticator Revenue** | ❌ Não é incluído |
| **Funções SQL** | ❌ Filtrado em todas as funções |
| **Relatórios** | ❌ Não aparece |

### O que acontece com documentos para clientes (`is_internal_use = false` ou `NULL`):

| Aspecto | Comportamento |
|---------|--------------|
| **Admin Dashboard - Tabela** | ✅ Aparece |
| **Admin Dashboard - Estatísticas** | ✅ É contado |
| **Finance Dashboard - Tabela** | ✅ Aparece |
| **Finance Dashboard - Estatísticas** | ✅ É contado |
| **Total Revenue** | ✅ Pode afetar (se tiver pagamento) |
| **Authenticator Revenue** | ✅ É incluído |
| **Funções SQL** | ✅ Incluído em todas as funções |
| **Relatórios** | ✅ Aparece |

---

## 🎯 Casos de Uso

### Caso 1: Autenticador traduz documento pessoal

1. Autenticador faz upload
2. Seleciona "Personal Use"
3. Sistema define `is_internal_use = true`
4. Documento **não aparece** no Admin Dashboard
5. Documento **não é contado** nas estatísticas
6. Documento **não afeta** Total Revenue

### Caso 2: Autenticador traduz documento para cliente

1. Autenticador faz upload
2. Seleciona "For Client"
3. Preenche "Client Name" (obrigatório)
4. Sistema define `is_internal_use = false`
5. Documento **aparece** no Admin Dashboard
6. Documento **é contado** nas estatísticas
7. Documento **pode afetar** Authenticator Revenue (mas não Total Revenue, pois autenticadores não pagam)

---

## 🔍 Validações e Regras de Negócio

### Validação no Frontend

```typescript
// Client Name é obrigatório apenas para uploads de cliente
if (uploadType === 'client' && !clientName.trim()) {
  throw new Error('Client name is required when uploading for a client.');
}
```

### Limpeza de Campos

Quando o autenticador muda de "For Client" para "Personal Use":
- ✅ `clientName` é limpo
- ✅ `paymentMethod` é resetado para 'card'
- ✅ `receiptFile` é limpo
- ✅ `receiptFileUrl` é limpo

---

## 📝 Notas Importantes

1. **Documentos antigos:** Documentos criados antes da implementação do campo têm `is_internal_use = NULL`, que é tratado como `false` (para cliente) nas queries.

2. **Índice de performance:** Foi criado um índice no campo `is_internal_use` para melhorar a performance das queries:
   ```sql
   CREATE INDEX idx_documents_is_internal_use ON documents(is_internal_use);
   ```

3. **Compatibilidade:** O filtro `(is_internal_use IS NULL OR is_internal_use = false)` garante compatibilidade com documentos antigos.

4. **Segurança:** A filtragem é feita tanto no frontend (queries) quanto no backend (funções SQL), garantindo que documentos de uso interno nunca apareçam em relatórios.

---

## ✅ Conclusão

O sistema de diferenciação entre uso interno e tradução para cliente está completamente implementado e funcional:

- ✅ Autenticadores podem escolher o tipo de upload
- ✅ Documentos de uso interno são marcados com `is_internal_use = true`
- ✅ Todos os dashboards filtram documentos de uso interno
- ✅ Todas as funções SQL excluem documentos de uso interno
- ✅ Estatísticas e cálculos de revenue não são afetados por documentos de uso interno
- ✅ Admin Dashboard não mostra documentos de uso interno

**Resultado:** Autenticadores podem usar o sistema para traduzir seus próprios documentos sem que isso afete as métricas e relatórios da empresa.







