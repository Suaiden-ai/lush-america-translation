# Sistema de Reupload de Documentos - Documentação Técnica Completa

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Estrutura do Banco de Dados](#estrutura-do-banco-de-dados)
4. [Componentes Frontend](#componentes-frontend)
5. [Lógica de Negócio](#lógica-de-negócio)
6. [Fluxo de Dados](#fluxo-de-dados)
7. [Validações e Segurança](#validações-e-segurança)
8. [Guia de Implementação](#guia-de-implementação)
9. [Exemplos de Uso](#exemplos-de-uso)
10. [Ferramentas de Teste](#-ferramentas-de-teste)

---

## 🎯 Visão Geral

### Problema Resolvido

O sistema de reupload foi desenvolvido para resolver o seguinte cenário:

**Situação**: Um usuário realiza o pagamento para traduzir um documento, mas por algum motivo técnico (falha de rede, timeout, erro no upload, etc.), o arquivo não é enviado para o Storage. O pagamento é confirmado, mas o documento fica sem arquivo associado.

**Solução**: O sistema detecta automaticamente esses casos e permite que o usuário reenvie o arquivo sem precisar pagar novamente.

### Funcionalidades Principais

1. **Detecção Automática**: Identifica documentos com pagamento confirmado mas sem arquivo no Storage
2. **Validação de Páginas**: Garante que o arquivo reenviado tenha o mesmo número de páginas pelo qual foi pago
3. **Validação de Pagamento**: Verifica se o pagamento está confirmado antes de permitir reupload
4. **Retry Automático**: Sistema de retry com exponential backoff para uploads
5. **Rastreamento**: Campos para rastrear falhas e tentativas de reenvio
6. **Interface Amigável**: UI/UX clara para o usuário identificar e reenviar documentos

---

## 🏗️ Arquitetura do Sistema

### Componentes Principais

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React/TypeScript)                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │ RetryUploadModal │  │ DocumentsRetryList│                 │
│  │   (Component)    │  │    (Page)        │                 │
│  └────────┬─────────┘  └────────┬─────────┘                 │
│           │                      │                            │
│           └──────────┬───────────┘                            │
│                      │                                         │
│           ┌──────────▼──────────┐                             │
│           │  retryUpload.ts     │                             │
│           │  (Utility Functions)│                             │
│           └──────────┬──────────┘                             │
│                      │                                         │
│           ┌──────────▼──────────┐                             │
│           │useDocumentsWith     │                             │
│           │MissingFiles (Hook)  │                             │
│           └──────────┬──────────┘                             │
│                      │                                         │
└──────────────────────┼─────────────────────────────────────────┘
                       │
                       │ HTTP/REST
                       │
┌──────────────────────▼─────────────────────────────────────────┐
│              BACKEND (Supabase)                                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────┐                    │
│  │  get_documents_with_missing_files()  │                    │
│  │  (Database Function)                 │                    │
│  └──────────────┬───────────────────────┘                    │
│                 │                                              │
│  ┌──────────────▼───────────────────────┐                    │
│  │  update-document (Edge Function)    │                    │
│  │  - Atualiza documento                │                    │
│  │  - Limpa upload_failed_at           │                    │
│  │  - Incrementa upload_retry_count     │                    │
│  └──────────────┬───────────────────────┘                    │
│                 │                                              │
│  ┌──────────────▼───────────────────────┐                    │
│  │  Supabase Storage                    │                    │
│  │  - Armazena arquivos PDF             │                    │
│  └───────────────────────────────────────┘                    │
│                                                               │
│  ┌──────────────────────────────────────┐                    │
│  │  Tabelas:                            │                    │
│  │  - documents                         │                    │
│  │  - payments                          │                    │
│  │  - profiles                          │                    │
│  └──────────────────────────────────────┘                    │
└───────────────────────────────────────────────────────────────┘
```

---

## 💾 Estrutura do Banco de Dados

### 1. Campos Adicionados na Tabela `documents`

```sql
-- Campo para marcar quando o upload falhou
upload_failed_at TIMESTAMPTZ NULL

-- Campo para contar tentativas de reenvio
upload_retry_count INTEGER DEFAULT 0
```

**Propósito**:
- `upload_failed_at`: Timestamp de quando o upload falhou após o pagamento
- `upload_retry_count`: Contador de quantas vezes o usuário tentou reenviar

### 2. Índices Criados

```sql
-- Índice para busca eficiente de documentos com upload falhado
CREATE INDEX idx_documents_upload_failed 
ON documents(upload_failed_at) 
WHERE upload_failed_at IS NOT NULL;

-- Índice composto para busca de documentos problemáticos
CREATE INDEX idx_documents_missing_file 
ON documents(user_id, status, upload_failed_at) 
WHERE (file_url IS NULL OR file_url = '') 
AND upload_failed_at IS NOT NULL;
```

### 3. Função de Detecção: `get_documents_with_missing_files`

```sql
CREATE OR REPLACE FUNCTION get_documents_with_missing_files(
  user_id_param UUID DEFAULT NULL
)
RETURNS TABLE (
  document_id UUID,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  payment_id UUID,
  payment_status TEXT,
  payment_amount DECIMAL,
  payment_gross_amount DECIMAL,
  payment_fee_amount DECIMAL,
  payment_date TIMESTAMPTZ,
  filename TEXT,
  original_filename TEXT,
  status TEXT,
  total_cost DECIMAL,
  verification_code TEXT,
  created_at TIMESTAMPTZ,
  upload_failed_at TIMESTAMPTZ,
  upload_retry_count INTEGER,
  pages INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id AS document_id,
    d.user_id,
    p.name AS user_name,
    p.email AS user_email,
    pay.id AS payment_id,
    pay.status::TEXT AS payment_status,
    pay.amount AS payment_amount,
    pay.gross_amount AS payment_gross_amount,
    pay.fee_amount AS payment_fee_amount,
    pay.payment_date,
    d.filename,
    d.original_filename,
    d.status::TEXT,
    d.total_cost,
    d.verification_code,
    d.created_at,
    d.upload_failed_at,
    d.upload_retry_count,
    d.pages
  FROM documents d
  INNER JOIN payments pay ON pay.document_id = d.id
  INNER JOIN profiles p ON p.id = d.user_id
  WHERE 
    pay.status = 'completed'
    AND (d.file_url IS NULL OR d.file_url = '')
    AND d.status IN ('pending', 'draft', 'processing')
    AND (user_id_param IS NULL OR d.user_id = user_id_param)
  ORDER BY d.created_at DESC;
END;
$$;
```

**Critérios de Detecção**:
- ✅ Pagamento com status `completed`
- ✅ Documento sem `file_url` (NULL ou vazio)
- ✅ Status do documento em `pending`, `draft` ou `processing`
- ✅ Opcionalmente filtrado por `user_id`

**Permissões**:
```sql
GRANT EXECUTE ON FUNCTION get_documents_with_missing_files(UUID) TO authenticated;
```

---

## 🎨 Componentes Frontend

### 1. Hook: `useDocumentsWithMissingFiles`

**Localização**: `src/hooks/useDocumentsWithMissingFiles.ts`

**Funcionalidade**: 
- Busca documentos que precisam de reupload
- Mantém subscription em tempo real para atualizações
- Retorna lista, loading state, error e função de refetch

**Interface**:
```typescript
export interface DocumentWithMissingFile {
  document_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  payment_id: string;
  payment_status: string;
  payment_amount: number;
  payment_gross_amount: number;
  payment_fee_amount?: number | null;
  payment_date: string;
  filename: string;
  original_filename: string | null;
  status: string;
  total_cost: number;
  verification_code: string;
  created_at: string;
  upload_failed_at: string | null;
  upload_retry_count: number;
  pages: number;
}

export function useDocumentsWithMissingFiles(userId?: string) {
  // Retorna: { documents, loading, error, refetch, count }
}
```

**Features**:
- Subscription em tempo real via Supabase Realtime
- Auto-refresh quando documentos ou pagamentos mudam
- Filtro opcional por `userId`

### 2. Utility: `retryUpload.ts`

**Localização**: `src/utils/retryUpload.ts`

**Função Principal**: `retryDocumentUpload(documentId: string, file: File)`

**Fluxo de Execução**:

```typescript
1. Validar arquivo
   ├─ Tipo: Apenas PDF
   ├─ Tamanho: Máximo 10MB
   └─ Não vazio

2. Verificar pagamento
   ├─ Buscar pagamento com status 'completed'
   └─ Validar que pagamento existe

3. Buscar informações do documento
   ├─ Obter user_id, filename, pages
   └─ Validar que documento existe

4. Validar número de páginas
   ├─ Contar páginas do PDF usando pdfjs-dist
   └─ Comparar com número de páginas pago

5. Gerar nome único para arquivo
   └─ Usar generateUniqueFileName()

6. Verificar se arquivo já existe no Storage
   ├─ Evitar duplicatas
   └─ Se existir, usar URL existente

7. Fazer upload com retry automático
   ├─ Até 3 tentativas
   ├─ Exponential backoff
   └─ Tratamento de erros de rede

8. Obter URL pública do arquivo

9. Atualizar documento via Edge Function
   ├─ Atualizar file_url
   ├─ Limpar upload_failed_at
   ├─ Incrementar upload_retry_count
   └─ Atualizar status para 'pending'

10. Chamar webhook para processamento
    └─ Enviar para n8n (opcional)

11. Log de sucesso
    └─ Registrar ação no sistema de logs
```

**Funções Auxiliares**:

- `validateFile(file: File)`: Valida tipo, tamanho e se não está vazio
- `verifyPayment(documentId: string)`: Verifica se pagamento está confirmado
- `validatePageCount(file: File, expectedPages: number)`: Valida número de páginas
- `countPdfPages(file: File)`: Conta páginas usando pdfjs-dist
- `uploadFileWithRetry(file: File, filePath: string)`: Upload com retry automático
- `updateDocumentAfterUpload(documentId, fileUrl, userId)`: Atualiza documento via Edge Function

**Retry Logic**:
```typescript
const MAX_RETRY_ATTEMPTS = 3;

// Exponential backoff: 1s, 2s, 3s
await new Promise(resolve => setTimeout(resolve, 1000 * attempt));

// Apenas retry em erros de rede/timeout
if (!error.message.includes('network') && !error.message.includes('timeout')) {
  return { success: false, error: error.message };
}
```

### 3. Componente: `RetryUploadModal`

**Localização**: `src/components/DocumentUploadRetry/RetryUploadModal.tsx`

**Props**:
```typescript
interface RetryUploadModalProps {
  document: DocumentWithMissingFile;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}
```

**Funcionalidades**:
- Exibe informações do documento (nome, valor pago, data, páginas)
- Área de drag & drop para upload
- Validação de páginas em tempo real
- Barra de progresso durante upload
- Mensagens de sucesso/erro
- Prevenção de upload com número de páginas incorreto

**Validações no Frontend**:
1. Tipo de arquivo: Apenas PDF
2. Tamanho: Máximo 10MB
3. Número de páginas: Deve corresponder ao número pago
4. Arquivo não vazio

### 4. Página: `DocumentsRetryList`

**Localização**: `src/pages/CustomerDashboard/DocumentsRetryList.tsx`

**Funcionalidade**: Lista todos os documentos que precisam de reupload

**Features**:
- Lista paginada de documentos
- Card para cada documento com informações relevantes
- Botão para abrir modal de reupload
- Indicador visual de documentos já enviados
- Mensagem quando não há documentos pendentes

### 5. Página: `DocumentRetryUpload`

**Localização**: `src/pages/CustomerDashboard/DocumentRetryUpload.tsx`

**Funcionalidade**: Página dedicada para reupload de um documento específico

**Acesso**: 
- Via URL: `/dashboard/retry-upload/single/:documentId`
- Via query param: `/dashboard/retry-upload?documentId=xxx&from=payment`

**Uso**: Quando usuário é redirecionado após falha de upload no fluxo de pagamento

### 6. Componente: `DocumentUploadRetry`

**Localização**: `src/components/DocumentUploadRetry/DocumentUploadRetry.tsx`

**Funcionalidade**: Componente compacto que exibe alerta quando há documentos pendentes

**Uso**: Integrado no dashboard do cliente para notificar sobre documentos pendentes

---

## ⚙️ Lógica de Negócio

### 1. Detecção de Documentos com Falha

**Quando ocorre**:
- Após confirmação de pagamento
- Quando `file_url` está NULL ou vazio
- Status do documento em `pending`, `draft` ou `processing`

**Como detectar**:
```typescript
// Via hook
const { documents, count } = useDocumentsWithMissingFiles(userId);

// Via RPC direto
const { data } = await supabase.rpc('get_documents_with_missing_files', {
  user_id_param: userId || null
});
```

### 2. Marcação de Upload Falhado

**Quando marcar**:
- Erro durante upload no `PaymentSuccess`
- Timeout no upload
- Falha de rede durante upload
- Qualquer erro que impeça o arquivo de chegar ao Storage

**Como marcar**:
```typescript
async function markDocumentUploadFailed(documentId: string) {
  const response = await fetch(`${supabaseUrl}/functions/v1/update-document`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || ''}`
    },
    body: JSON.stringify({
      documentId,
      userId: document.user_id,
      markUploadFailed: true
    })
  });
}
```

**O que acontece**:
- `upload_failed_at` é preenchido com timestamp atual
- `upload_retry_count` é mantido (não incrementado ainda)

### 3. Processo de Reupload

**Validações Obrigatórias**:

1. **Arquivo**:
   - ✅ Tipo: PDF
   - ✅ Tamanho: ≤ 10MB
   - ✅ Não vazio

2. **Pagamento**:
   - ✅ Status: `completed`
   - ✅ Pagamento existe para o documento

3. **Páginas**:
   - ✅ Número de páginas do PDF = número de páginas pago
   - ✅ Validação usando pdfjs-dist

4. **Documento**:
   - ✅ Documento existe no banco
   - ✅ `file_url` está NULL ou vazio

**Processo**:

```typescript
1. Usuário seleciona arquivo
   └─ Validação imediata de tipo e tamanho

2. Contagem de páginas (assíncrono)
   └─ Usando pdfjs-dist

3. Validação de páginas
   └─ Comparar com pages do documento

4. Upload com retry
   └─ Até 3 tentativas com exponential backoff

5. Atualização do documento
   ├─ file_url = URL do arquivo no Storage
   ├─ upload_failed_at = NULL
   ├─ upload_retry_count += 1
   └─ status = 'pending'

6. Chamada de webhook (opcional)
   └─ Notificar sistema externo (n8n)

7. Log de sucesso
   └─ Registrar ação no sistema de logs
```

### 4. Limpeza de Estado Após Sucesso

**Campos atualizados**:
- `upload_failed_at`: `NULL` (limpo)
- `upload_retry_count`: Incrementado em 1
- `file_url`: Preenchido com URL do Storage
- `status`: Atualizado para `'pending'`

**Via Edge Function**:
```typescript
{
  documentId,
  fileUrl,
  userId,
  clearUploadFailed: true, // Flag para limpar upload_failed_at
  // ... outros campos opcionais
}
```

---

## 🔄 Fluxo de Dados

### Fluxo Completo: Do Pagamento ao Reupload

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USUÁRIO FAZ PAGAMENTO                                    │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. PAGAMENTO CONFIRMADO (Stripe Webhook)                    │
│    - payment.status = 'completed'                           │
│    - document.status = 'pending'                            │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. TENTATIVA DE UPLOAD (PaymentSuccess.tsx)                 │
│    - Buscar arquivo do IndexedDB/Storage                     │
│    - Fazer upload para Supabase Storage                     │
└──────────────────┬──────────────────────────────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
         ▼                   ▼
    ┌─────────┐        ┌──────────┐
    │ SUCESSO │        │  FALHA   │
    └────┬────┘        └────┬─────┘
         │                  │
         │                  ▼
         │    ┌─────────────────────────────┐
         │    │ markDocumentUploadFailed()   │
         │    │ - upload_failed_at = NOW()  │
         │    └─────────────┬───────────────┘
         │                  │
         │                  ▼
         │    ┌─────────────────────────────┐
         │    │ Redirecionar para           │
         │    │ /retry-upload?documentId=xxx│
         │    └─────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. DOCUMENTO PROCESSADO                                     │
│    - file_url preenchido                                    │
│    - Enviado para n8n                                       │
└─────────────────────────────────────────────────────────────┘
```

### Fluxo de Reupload

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USUÁRIO ACESSA /retry-upload                             │
│    - Hook busca documentos via RPC                          │
│    - get_documents_with_missing_files()                      │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. LISTA DE DOCUMENTOS EXIBIDA                               │
│    - DocumentsRetryList renderiza cards                     │
│    - Cada card tem botão "Resend File"                      │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. USUÁRIO CLICA EM "RESEND FILE"                           │
│    - RetryUploadModal abre                                  │
│    - Exibe informações do documento                          │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. USUÁRIO SELECIONA ARQUIVO                                │
│    - Drag & drop ou file input                             │
│    - Validação imediata:                                    │
│      • Tipo: PDF                                            │
│      • Tamanho: ≤ 10MB                                      │
│      • Contagem de páginas                                  │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. VALIDAÇÃO DE PÁGINAS                                     │
│    - countPdfPages(file)                                    │
│    - Comparar com document.pages                           │
│    - Se diferente: mostrar erro                             │
│    - Se igual: habilitar botão "Resend"                     │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. USUÁRIO CLICA EM "RESEND DOCUMENT"                      │
│    - retryDocumentUpload(documentId, file)                  │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. VALIDAÇÕES NO BACKEND                                    │
│    - Verificar pagamento                                    │
│    - Validar arquivo                                        │
│    - Validar páginas                                        │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. UPLOAD PARA STORAGE                                      │
│    - uploadFileWithRetry()                                  │
│    - Até 3 tentativas                                       │
│    - Exponential backoff                                    │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. ATUALIZAÇÃO DO DOCUMENTO                                 │
│    - Edge Function: update-document                         │
│    - file_url = URL do arquivo                              │
│    - upload_failed_at = NULL                                │
│    - upload_retry_count += 1                                │
│    - status = 'pending'                                     │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 10. WEBHOOK (OPCIONAL)                                      │
│     - Enviar para n8n                                       │
│     - Notificar sistema externo                             │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 11. LOG DE SUCESSO                                          │
│     - Logger.log()                                          │
│     - Registrar ação                                        │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 12. FEEDBACK AO USUÁRIO                                     │
│     - Mensagem de sucesso                                   │
│     - Modal fecha automaticamente                           │
│     - Lista atualizada                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔒 Validações e Segurança

### Validações no Frontend

1. **Tipo de Arquivo**:
   ```typescript
   if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
     return { valid: false, error: 'Apenas arquivos PDF são permitidos' };
   }
   ```

2. **Tamanho**:
   ```typescript
   const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
   if (file.size > MAX_FILE_SIZE) {
     return { valid: false, error: 'Arquivo muito grande' };
   }
   ```

3. **Número de Páginas**:
   ```typescript
   const actualPages = await countPdfPages(file);
   if (actualPages !== expectedPages) {
     return { valid: false, error: 'Número de páginas não corresponde' };
   }
   ```

### Validações no Backend

1. **Pagamento Confirmado**:
   ```sql
   WHERE pay.status = 'completed'
   ```

2. **Documento Sem Arquivo**:
   ```sql
   AND (d.file_url IS NULL OR d.file_url = '')
   ```

3. **Status Válido**:
   ```sql
   AND d.status IN ('pending', 'draft', 'processing')
   ```

4. **Permissões**:
   - Função RPC com `SECURITY DEFINER` para acesso controlado
   - Edge Function valida `userId` antes de atualizar
   - RLS (Row Level Security) nas tabelas

### Segurança

1. **Autenticação**: Todas as requisições requerem token JWT válido
2. **Autorização**: Edge Function verifica `user_id` antes de atualizar
3. **Validação de Propriedade**: Usuário só pode reenviar seus próprios documentos
4. **Sanitização**: Nomes de arquivo são sanitizados antes do upload
5. **Rate Limiting**: Sistema de retry previne loops infinitos

---

## 📚 Guia de Implementação

### Passo 1: Banco de Dados

#### 1.1. Adicionar Campos na Tabela `documents`

```sql
-- Migration: add_upload_failed_field.sql
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS upload_failed_at TIMESTAMPTZ;

ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS upload_retry_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_documents_upload_failed 
ON documents(upload_failed_at) 
WHERE upload_failed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_missing_file 
ON documents(user_id, status, upload_failed_at) 
WHERE (file_url IS NULL OR file_url = '') 
AND upload_failed_at IS NOT NULL;
```

#### 1.2. Criar Função de Detecção

```sql
-- Migration: add_missing_file_detection.sql
CREATE OR REPLACE FUNCTION get_documents_with_missing_files(
  user_id_param UUID DEFAULT NULL
)
RETURNS TABLE (
  document_id UUID,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  payment_id UUID,
  payment_status TEXT,
  payment_amount DECIMAL,
  payment_gross_amount DECIMAL,
  payment_fee_amount DECIMAL,
  payment_date TIMESTAMPTZ,
  filename TEXT,
  original_filename TEXT,
  status TEXT,
  total_cost DECIMAL,
  verification_code TEXT,
  created_at TIMESTAMPTZ,
  upload_failed_at TIMESTAMPTZ,
  upload_retry_count INTEGER,
  pages INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id AS document_id,
    d.user_id,
    p.name AS user_name,
    p.email AS user_email,
    pay.id AS payment_id,
    pay.status::TEXT AS payment_status,
    pay.amount AS payment_amount,
    pay.gross_amount AS payment_gross_amount,
    pay.fee_amount AS payment_fee_amount,
    pay.payment_date,
    d.filename,
    d.original_filename,
    d.status::TEXT,
    d.total_cost,
    d.verification_code,
    d.created_at,
    d.upload_failed_at,
    d.upload_retry_count,
    d.pages
  FROM documents d
  INNER JOIN payments pay ON pay.document_id = d.id
  INNER JOIN profiles p ON p.id = d.user_id
  WHERE 
    pay.status = 'completed'
    AND (d.file_url IS NULL OR d.file_url = '')
    AND d.status IN ('pending', 'draft', 'processing')
    AND (user_id_param IS NULL OR d.user_id = user_id_param)
  ORDER BY d.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_documents_with_missing_files(UUID) TO authenticated;
```

### Passo 2: Edge Function

#### 2.1. Criar/Atualizar Edge Function `update-document`

**Localização**: `supabase/functions/update-document/index.ts`

**Funcionalidades**:
- Atualizar `file_url` do documento
- Marcar upload como falhado (`markUploadFailed: true`)
- Limpar upload falhado (`clearUploadFailed: true`)
- Incrementar `upload_retry_count`

**Exemplo de Payload**:
```typescript
// Marcar como falhado
{
  documentId: "uuid",
  userId: "uuid",
  markUploadFailed: true
}

// Limpar falha e atualizar
{
  documentId: "uuid",
  userId: "uuid",
  fileUrl: "https://...",
  clearUploadFailed: true,
  pages: 5,
  totalCost: 20.00
}
```

### Passo 3: Frontend - Utilities

#### 3.1. Criar `retryUpload.ts`

**Localização**: `src/utils/retryUpload.ts`

**Dependências**:
- `pdfjs-dist`: Para contar páginas do PDF
- `@supabase/supabase-js`: Cliente Supabase
- Sistema de logging (opcional)

**Estrutura**:
```typescript
// Interfaces
export interface RetryUploadResult {
  success: boolean;
  fileUrl?: string;
  error?: string;
  documentId?: string;
}

// Função principal
export async function retryDocumentUpload(
  documentId: string,
  file: File
): Promise<RetryUploadResult>

// Funções auxiliares
- validateFile(file: File)
- verifyPayment(documentId: string)
- validatePageCount(file: File, expectedPages: number)
- countPdfPages(file: File)
- uploadFileWithRetry(file: File, filePath: string)
- updateDocumentAfterUpload(documentId, fileUrl, userId)
```

### Passo 4: Frontend - Hook

#### 4.1. Criar `useDocumentsWithMissingFiles.ts`

**Localização**: `src/hooks/useDocumentsWithMissingFiles.ts`

**Interface de Retorno**:
```typescript
{
  documents: DocumentWithMissingFile[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  count: number;
}
```

**Features**:
- Subscription em tempo real
- Auto-refresh quando dados mudam
- Filtro opcional por `userId`

### Passo 5: Frontend - Componentes

#### 5.1. Criar `RetryUploadModal.tsx`

**Props**:
```typescript
interface RetryUploadModalProps {
  document: DocumentWithMissingFile;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}
```

**Features**:
- Drag & drop
- Validação de páginas em tempo real
- Barra de progresso
- Mensagens de feedback

#### 5.2. Criar `DocumentsRetryList.tsx`

**Funcionalidade**: Lista todos os documentos pendentes

#### 5.3. Criar `DocumentRetryUpload.tsx`

**Funcionalidade**: Página para reupload de documento específico

### Passo 6: Integração no Fluxo de Pagamento

#### 6.1. Marcar Upload Falhado

**No `PaymentSuccess.tsx`**:
```typescript
async function markDocumentUploadFailed(documentId: string) {
  const response = await fetch(`${supabaseUrl}/functions/v1/update-document`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || ''}`
    },
    body: JSON.stringify({
      documentId,
      userId: document.user_id,
      markUploadFailed: true
    })
  });
}

// Usar quando upload falhar
if (uploadError) {
  await markDocumentUploadFailed(documentId);
  navigate(`/dashboard/retry-upload?documentId=${documentId}&from=payment`);
}
```

### Passo 7: Rotas

**Adicionar rotas no router**:
```typescript
<Route path="/dashboard/retry-upload" element={<DocumentsRetryList />} />
<Route path="/dashboard/retry-upload/single/:documentId" element={<DocumentRetryUpload />} />
```

### Passo 8: Integração no Dashboard

**Adicionar componente de alerta**:
```typescript
import { DocumentUploadRetry } from '../../components/DocumentUploadRetry/DocumentUploadRetry';

// No dashboard do cliente
<DocumentUploadRetry userId={user?.id} />
```

---

## 💡 Exemplos de Uso

### Exemplo 1: Buscar Documentos Pendentes

```typescript
import { useDocumentsWithMissingFiles } from '../hooks/useDocumentsWithMissingFiles';

function MyComponent() {
  const { documents, loading, count } = useDocumentsWithMissingFiles(userId);

  if (loading) return <div>Carregando...</div>;
  if (count === 0) return <div>Nenhum documento pendente</div>;

  return (
    <div>
      <h2>Documentos Pendentes: {count}</h2>
      {documents.map(doc => (
        <div key={doc.document_id}>
          <p>{doc.original_filename}</p>
          <p>Páginas: {doc.pages}</p>
          <p>Valor pago: ${doc.payment_gross_amount}</p>
        </div>
      ))}
    </div>
  );
}
```

### Exemplo 2: Reenviar Documento

```typescript
import { retryDocumentUpload } from '../utils/retryUpload';

async function handleRetryUpload(documentId: string, file: File) {
  const result = await retryDocumentUpload(documentId, file);
  
  if (result.success) {
    console.log('Documento reenviado com sucesso!', result.fileUrl);
    // Atualizar UI, mostrar mensagem de sucesso, etc.
  } else {
    console.error('Erro ao reenviar:', result.error);
    // Mostrar mensagem de erro ao usuário
  }
}
```

### Exemplo 3: Marcar Upload como Falhado

```typescript
async function markDocumentUploadFailed(documentId: string) {
  const { data: document } = await supabase
    .from('documents')
    .select('user_id')
    .eq('id', documentId)
    .single();

  const response = await fetch(`${supabaseUrl}/functions/v1/update-document`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || ''}`
    },
    body: JSON.stringify({
      documentId,
      userId: document.user_id,
      markUploadFailed: true
    })
  });

  if (!response.ok) {
    throw new Error('Failed to mark document as upload failed');
  }
}
```

### Exemplo 4: Buscar Documentos via RPC Direto

```typescript
const { data, error } = await supabase.rpc('get_documents_with_missing_files', {
  user_id_param: userId || null // null para buscar todos
});

if (error) {
  console.error('Erro ao buscar documentos:', error);
} else {
  console.log('Documentos encontrados:', data);
}
```

---

## 🔍 Considerações Técnicas

### 1. Contagem de Páginas PDF

**Biblioteca**: `pdfjs-dist`

**Implementação**:
```typescript
async function countPdfPages(file: File): Promise<number> {
  const pdfjsLib = await import('pdfjs-dist/build/pdf');
  const pdfjsWorkerSrc = (await import('pdfjs-dist/build/pdf.worker?url')).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  return pdf.numPages;
}
```

**Nota**: Carregar o worker do PDF.js é necessário para funcionar corretamente.

### 2. Retry Logic

**Estratégia**: Exponential Backoff

```typescript
const MAX_RETRY_ATTEMPTS = 3;

for (let attempt = 1; attempt <= retries; attempt++) {
  try {
    // Tentar upload
    const { data, error } = await supabase.storage
      .from('documents')
      .upload(filePath, file, { upsert: true });

    if (error) {
      // Apenas retry em erros de rede/timeout
      if (!error.message.includes('network') && !error.message.includes('timeout')) {
        return { success: false, error: error.message };
      }

      // Aguardar antes de tentar novamente
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
      continue;
    }

    return { success: true, data };
  } catch (err) {
    // Tratamento de exceções
  }
}
```

### 3. Geração de Nome Único

**Função**: `generateUniqueFileName(originalName: string)`

**Propósito**: Evitar conflitos de nomes no Storage

**Exemplo**:
```typescript
// Entrada: "documento.pdf"
// Saída: "documento_1234567890_abc123.pdf"
```

### 4. Subscription em Tempo Real

**Implementação**:
```typescript
const channel = supabase
  .channel('documents_with_missing_files_changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'documents',
    filter: userId ? `user_id=eq.${userId}` : undefined
  }, () => {
    fetchDocuments(); // Recarregar quando houver mudanças
  })
  .subscribe();
```

**Cleanup**:
```typescript
return () => {
  supabase.removeChannel(channel);
};
```

---

## 📊 Métricas e Monitoramento

### Campos para Análise

1. **`upload_failed_at`**: Timestamp de quando falhou
   - Útil para identificar padrões de falha
   - Pode indicar problemas de infraestrutura

2. **`upload_retry_count`**: Número de tentativas
   - Monitorar quantos usuários precisam reenviar
   - Identificar problemas recorrentes

### Queries Úteis

```sql
-- Documentos que falharam nas últimas 24h
SELECT COUNT(*) 
FROM documents 
WHERE upload_failed_at > NOW() - INTERVAL '24 hours';

-- Taxa de sucesso de reupload
SELECT 
  COUNT(*) FILTER (WHERE upload_retry_count > 0 AND file_url IS NOT NULL) as sucesso,
  COUNT(*) FILTER (WHERE upload_retry_count > 0 AND file_url IS NULL) as falha
FROM documents
WHERE upload_retry_count > 0;

-- Documentos com múltiplas tentativas
SELECT document_id, upload_retry_count, upload_failed_at
FROM documents
WHERE upload_retry_count > 3
ORDER BY upload_retry_count DESC;
```

---

## 🧪 Ferramentas de Teste

O sistema inclui ferramentas robustas para simular falhas de upload durante testes e desenvolvimento. Isso permite testar o fluxo completo de reupload sem depender de falhas reais.

### 1. Painel Admin de Simulação (Recomendado para Produção)

**Localização**: `/admin` → Aba "Test Tools"

**Componente**: `UploadSimulationPanel.tsx`

**Funcionalidade**: Interface administrativa completa para simular falhas de upload em documentos reais.

#### Como Usar:

1. **Acessar o Painel**:
   - Faça login como administrador
   - Navegue para `/admin`
   - Clique na aba **"Test Tools"**

2. **Visualizar Documentos**:
   - O painel exibe os 20 documentos mais recentes
   - Mostra informações: nome, cliente, status, presença de arquivo
   - Indica visualmente se o arquivo está presente (✅) ou ausente (❌)

3. **Simular Falha**:
   - Encontre um documento com arquivo presente
   - Clique no botão **"Simular Falha"**
   - Confirme a ação no diálogo

#### O que a Simulação Faz:

```typescript
1. Remove arquivo do Storage
   ├─ Tenta múltiplas variações do caminho
   ├─ Verifica existência antes de remover
   └─ Confirma remoção após operação

2. Limpa registros relacionados
   ├─ Remove de documents_to_be_verified
   ├─ Remove de translated_documents (se existir)
   └─ Remove de documents_to_verify (se existir)

3. Limpa campos no banco
   ├─ file_url = NULL
   ├─ file_id = NULL
   └─ Mantém outros dados do documento

4. Marca como falhado
   ├─ Chama Edge Function update-document
   ├─ Define upload_failed_at = NOW()
   └─ Mantém upload_retry_count atual

5. Verificação final
   ├─ Confirma que file_url está NULL
   └─ Confirma que upload_failed_at está preenchido
```

#### Código de Implementação:

```typescript
// src/pages/AdminDashboard/UploadSimulationPanel.tsx

const handleSimulateError = async (documentId: string) => {
  // 1. Buscar documento
  const { data: documentData } = await supabase
    .from('documents')
    .select('id, file_url, user_id, filename, original_filename')
    .eq('id', documentId)
    .single();

  // 2. Remover arquivo do Storage
  if (documentData.file_url) {
    await removeFileFromStorage(
      documentData.file_url,
      documentData.user_id,
      documentData.original_filename || documentData.filename
    );
  }

  // 3. Limpar registros relacionados
  // ... (código completo no arquivo)

  // 4. Limpar file_url no banco
  await supabase
    .from('documents')
    .update({ file_url: null, file_id: null })
    .eq('id', documentId);

  // 5. Marcar como falhado via Edge Function
  await fetch(`${supabaseUrl}/functions/v1/update-document`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || ''}`
    },
    body: JSON.stringify({
      documentId,
      userId: documentData.user_id,
      markUploadFailed: true
    })
  });
};
```

#### Remoção Robusta de Arquivos:

O sistema tenta múltiplas variações do caminho do arquivo para garantir remoção:

```typescript
const pathsToTry: string[] = [
  filePath, // Caminho original extraído da URL
  `${userId}/${filename}`, // Formato padrão userId/filename
  filePath.split('/').slice(-2).join('/'), // Últimos 2 segmentos
  filePath.split('/').pop() || '', // Apenas o nome do arquivo
];
```

**Vantagens**:
- ✅ Funciona em produção (não requer ambiente de desenvolvimento)
- ✅ Interface visual clara
- ✅ Limpeza completa de todos os vestígios
- ✅ Confirmação antes de executar
- ✅ Feedback visual de sucesso/erro

### 2. Simulação via URL (Apenas Desenvolvimento)

**Localização**: `src/utils/uploadSimulation.ts`

**Funcionalidade**: Permite simular erro de upload adicionando parâmetro na URL.

#### Como Usar:

1. **Adicionar Parâmetro na URL**:
   ```
   http://localhost:5173/payment-success?session_id=xxx&simulate_upload_error=true
   ```

2. **Fluxo de Teste**:
   - Faça upload de um documento normalmente
   - Complete o pagamento
   - Quando chegar na página `PaymentSuccess`, o erro será simulado automaticamente
   - Você será redirecionado para `/dashboard/retry-upload`

#### Implementação:

```typescript
// src/utils/uploadSimulation.ts

export function shouldSimulateUploadError(): boolean {
  // Apenas em desenvolvimento
  if (!import.meta.env.DEV) {
    return false;
  }

  // Verificar parâmetro na URL
  const urlParams = new URLSearchParams(window.location.search);
  const simulateError = urlParams.get('simulate_upload_error');
  
  return simulateError === 'true';
}
```

**Uso no PaymentSuccess**:

```typescript
// src/pages/PaymentSuccess.tsx

const shouldSimulate = isUploadErrorSimulationActive();
if (shouldSimulate && documentId) {
  console.log('DEBUG: Simulação de erro de upload ativada');
  clearInterval(progressInterval);
  setUploadProgress(0);
  // Marcar documento como falhado
  await markDocumentUploadFailed(documentId);
  setError('Upload failed: Simulated error for testing');
  navigate(`/dashboard/retry-upload?documentId=${documentId}&from=payment`);
  return;
}
```

**Limitações**:
- ⚠️ Funciona apenas em ambiente de desenvolvimento (`import.meta.env.DEV`)
- ⚠️ Requer adicionar parâmetro manualmente na URL
- ⚠️ Não persiste entre recarregamentos

### 3. Simulação via localStorage (Apenas Desenvolvimento)

**Funcionalidade**: Permite ativar simulação de forma persistente durante desenvolvimento.

#### Como Usar:

1. **Ativar no Console do Navegador**:
   ```javascript
   localStorage.setItem('simulate_upload_error', 'true');
   ```

2. **Fazer Upload Normal**:
   - Faça upload e pagamento normalmente
   - O erro será simulado automaticamente em todos os uploads
   - Persiste mesmo após recarregar a página

3. **Desativar**:
   ```javascript
   localStorage.removeItem('simulate_upload_error');
   ```

#### Implementação:

```typescript
// src/utils/uploadSimulation.ts

export function shouldSimulateUploadErrorFromStorage(): boolean {
  // Apenas em desenvolvimento
  if (!import.meta.env.DEV) {
    return false;
  }

  const stored = localStorage.getItem('simulate_upload_error');
  return stored === 'true';
}

export function enableUploadErrorSimulation(): void {
  if (import.meta.env.DEV) {
    localStorage.setItem('simulate_upload_error', 'true');
  }
}

export function disableUploadErrorSimulation(): void {
  localStorage.removeItem('simulate_upload_error');
}
```

**Função Unificada**:

```typescript
export function isUploadErrorSimulationActive(): boolean {
  return shouldSimulateUploadError() || shouldSimulateUploadErrorFromStorage();
}
```

**Vantagens**:
- ✅ Persiste entre recarregamentos
- ✅ Não precisa adicionar parâmetro na URL toda vez
- ✅ Útil para testes repetitivos

**Limitações**:
- ⚠️ Funciona apenas em desenvolvimento
- ⚠️ Requer acesso ao console do navegador

### 4. Comparação das Ferramentas

| Ferramenta | Ambiente | Persistência | Limpeza Completa | Interface |
|------------|----------|--------------|------------------|-----------|
| **Painel Admin** | Produção + Dev | Não necessária | ✅ Sim | ✅ Visual |
| **URL Parameter** | Apenas Dev | ❌ Não | ❌ Não | ❌ Manual |
| **localStorage** | Apenas Dev | ✅ Sim | ❌ Não | ❌ Console |

### 5. Fluxo de Teste Recomendado

#### Para Desenvolvimento:

1. **Usar localStorage** para testes repetitivos:
   ```javascript
   localStorage.setItem('simulate_upload_error', 'true');
   ```

2. **Fazer upload** normalmente

3. **Verificar redirecionamento** para `/dashboard/retry-upload`

4. **Testar reupload** completo

5. **Desativar** quando terminar:
   ```javascript
   localStorage.removeItem('simulate_upload_error');
   ```

#### Para Produção/Staging:

1. **Usar Painel Admin** (`/admin` → Test Tools)

2. **Selecionar documento** com arquivo presente

3. **Simular falha** e confirmar

4. **Verificar** que documento aparece na lista de reupload

5. **Testar reupload** como cliente

### 6. Verificações Após Simulação

#### Via SQL:

```sql
-- Verificar que file_url foi limpo
SELECT id, filename, file_url, upload_failed_at, upload_retry_count
FROM documents
WHERE id = 'DOCUMENT_ID';

-- Verificar que aparece na função de detecção
SELECT * FROM get_documents_with_missing_files();
```

#### Via Interface:

1. **Dashboard do Cliente**:
   - Deve aparecer banner de alerta
   - Contador deve mostrar número correto

2. **Página de Reupload**:
   - Documento deve aparecer na lista
   - Informações devem estar corretas

3. **Painel Admin**:
   - Status do arquivo deve mudar de "Presente" para "Ausente"

### 7. Cuidados e Boas Práticas

#### ⚠️ Atenção:

1. **Backup**: Considere fazer backup antes de simular em produção
2. **Dados Reais**: Cuidado ao simular em documentos de clientes reais
3. **Notificação**: Cliente receberá alerta se tiver documentos pendentes
4. **Limpeza**: Painel admin faz limpeza completa, outros métodos não

#### ✅ Boas Práticas:

1. **Testar em Ambiente de Desenvolvimento Primeiro**
2. **Usar Painel Admin em Produção** (mais seguro)
3. **Verificar Logs** após simulação
4. **Testar Reupload Completo** após simular
5. **Limpar localStorage** após testes

### 8. Exemplo de Teste Completo

```typescript
// 1. Ativar simulação (desenvolvimento)
localStorage.setItem('simulate_upload_error', 'true');

// 2. Fazer upload de documento
// ... fluxo normal de upload e pagamento

// 3. Verificar redirecionamento
// Deve ir para: /dashboard/retry-upload?documentId=xxx&from=payment

// 4. Verificar no banco
// SELECT * FROM documents WHERE id = 'xxx';
// file_url deve ser NULL
// upload_failed_at deve estar preenchido

// 5. Fazer reupload
// ... usar RetryUploadModal

// 6. Verificar sucesso
// SELECT * FROM documents WHERE id = 'xxx';
// file_url deve estar preenchido
// upload_failed_at deve ser NULL
// upload_retry_count deve ser incrementado

// 7. Desativar simulação
localStorage.removeItem('simulate_upload_error');
```

---

## 🚨 Troubleshooting

### Problema: Documentos não aparecem na lista

**Possíveis causas**:
1. Pagamento não está com status `completed`
2. `file_url` não está NULL (já foi enviado)
3. Status do documento não está em `pending`, `draft` ou `processing`
4. Permissões RLS bloqueando acesso

**Solução**:
```sql
-- Verificar documento específico
SELECT 
  d.id,
  d.file_url,
  d.status,
  d.upload_failed_at,
  pay.status as payment_status
FROM documents d
LEFT JOIN payments pay ON pay.document_id = d.id
WHERE d.id = 'uuid-do-documento';
```

### Problema: Validação de páginas falha

**Possíveis causas**:
1. PDF corrompido
2. pdfjs-dist não carregado corretamente
3. Worker do PDF.js não configurado

**Solução**:
- Verificar console do navegador para erros
- Garantir que worker está sendo carregado
- Testar com PDF válido

### Problema: Upload falha mesmo com retry

**Possíveis causas**:
1. Problemas de rede persistentes
2. Storage bucket sem permissões
3. Arquivo muito grande
4. Timeout do servidor

**Solução**:
- Verificar logs do Supabase Storage
- Aumentar timeout se necessário
- Verificar permissões do bucket
- Considerar aumentar limite de tamanho

---

## 📝 Checklist de Implementação

### Banco de Dados
- [ ] Campos `upload_failed_at` e `upload_retry_count` adicionados
- [ ] Índices criados
- [ ] Função `get_documents_with_missing_files` criada
- [ ] Permissões configuradas

### Backend
- [ ] Edge Function `update-document` implementada
- [ ] Suporte a `markUploadFailed` e `clearUploadFailed`
- [ ] Validações de segurança implementadas

### Frontend - Utilities
- [ ] `retryUpload.ts` implementado
- [ ] Validações de arquivo implementadas
- [ ] Contagem de páginas PDF funcionando
- [ ] Retry logic implementado

### Frontend - Hooks
- [ ] `useDocumentsWithMissingFiles` implementado
- [ ] Subscription em tempo real funcionando

### Frontend - Componentes
- [ ] `RetryUploadModal` implementado
- [ ] `DocumentsRetryList` implementado
- [ ] `DocumentRetryUpload` implementado
- [ ] `DocumentUploadRetry` (alerta) implementado

### Integração
- [ ] Rotas configuradas
- [ ] Integração no fluxo de pagamento
- [ ] Marcação de falha implementada
- [ ] Redirecionamento após falha

### Testes
- [ ] Teste de detecção de documentos
- [ ] Teste de validação de páginas
- [ ] Teste de upload com retry
- [ ] Teste de atualização de documento
- [ ] Teste de UI/UX
- [ ] Painel Admin de simulação implementado
- [ ] Ferramentas de simulação via URL/localStorage funcionando
- [ ] Teste completo de simulação e reupload

---

## 🎓 Conclusão

Este sistema de reupload de documentos fornece uma solução robusta para casos onde o pagamento é confirmado mas o upload falha. A implementação é modular, escalável e fácil de manter.

**Principais Benefícios**:
- ✅ Detecção automática de problemas
- ✅ Validações rigorosas para garantir integridade
- ✅ Experiência do usuário clara e intuitiva
- ✅ Rastreamento completo de tentativas
- ✅ Sistema de retry resiliente

**Próximos Passos** (Opcional):
- Notificações por email quando documento precisa de reupload
- Dashboard administrativo para monitorar falhas
- Análise de padrões de falha
- Melhorias na UI baseadas em feedback

---

**Versão**: 1.0  
**Última Atualização**: Janeiro 2025  
**Autor**: Sistema Lush America Translation
