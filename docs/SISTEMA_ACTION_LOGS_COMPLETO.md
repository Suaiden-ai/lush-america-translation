# Sistema de Action Logs - Documentação Completa

## 📋 Visão Geral

O sistema de **Action Logs** é um sistema completo de auditoria e rastreamento que registra todas as ações dos usuários na plataforma. Ele foi projetado para ser:

- ✅ **Imutável**: Logs não podem ser editados ou deletados
- ✅ **Performático**: Campos cacheados para evitar JOINs
- ✅ **Seguro**: RLS (Row Level Security) com políticas restritivas
- ✅ **Extensível**: Metadata JSONB para informações adicionais
- ✅ **Não-bloqueante**: Falhas no logging não quebram a aplicação

---

## 🎯 Objetivos

1. **Auditoria**: Rastrear todas as ações dos usuários
2. **Debugging**: Identificar problemas e comportamentos
3. **Análise**: Entender padrões de uso da plataforma
4. **Compliance**: Manter histórico completo de ações
5. **Segurança**: Detectar atividades suspeitas

---

## 🗄️ Estrutura do Banco de Dados

### Tabela: `action_logs`

**Arquivo:** `supabase/migrations/20250125000000_create_action_logs_table.sql`

```sql
CREATE TABLE IF NOT EXISTS public.action_logs (
    -- Primary identification
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Who performed the action (with cached name/email for performance)
    performed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    performed_by_type TEXT NOT NULL CHECK (performed_by_type IN ('user', 'admin', 'authenticator', 'finance', 'affiliate', 'system')),
    performed_by_name TEXT,
    performed_by_email TEXT,
    
    -- What action was performed
    action_type TEXT NOT NULL,
    action_description TEXT NOT NULL,
    
    -- What entity was affected
    entity_type TEXT,
    entity_id UUID,
    
    -- Flexible metadata (JSONB for extensibility)
    metadata JSONB,
    
    -- Affected user (if different from performer)
    affected_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
```

### Campos Explicados

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único do log |
| `created_at` | TIMESTAMP | Data/hora da ação (automático) |
| `performed_by` | UUID | ID do usuário que executou a ação |
| `performed_by_type` | TEXT | Tipo do usuário (user, admin, authenticator, etc.) |
| `performed_by_name` | TEXT | Nome do usuário (cacheado para performance) |
| `performed_by_email` | TEXT | Email do usuário (cacheado para performance) |
| `action_type` | TEXT | Tipo da ação (ex: 'document_upload', 'payment_completed') |
| `action_description` | TEXT | Descrição legível da ação |
| `entity_type` | TEXT | Tipo da entidade afetada (ex: 'document', 'payment') |
| `entity_id` | UUID | ID da entidade afetada |
| `metadata` | JSONB | Dados adicionais flexíveis (filename, amount, etc.) |
| `affected_user_id` | UUID | ID do usuário afetado (se diferente do performer) |

### Índices para Performance

```sql
-- Índices criados para otimizar queries
CREATE INDEX IF NOT EXISTS idx_action_logs_performed_by ON public.action_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_action_logs_created_at ON public.action_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_logs_action_type ON public.action_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_action_logs_entity ON public.action_logs(entity_type, entity_id) WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_action_logs_affected_user ON public.action_logs(affected_user_id) WHERE affected_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_action_logs_performed_by_type ON public.action_logs(performed_by_type);
```

**Por quê?**
- Buscar logs por usuário (`performed_by`)
- Ordenar por data (`created_at DESC`)
- Filtrar por tipo de ação (`action_type`)
- Buscar logs de uma entidade específica (`entity_type`, `entity_id`)
- Filtrar por usuário afetado (`affected_user_id`)
- Filtrar por tipo de performer (`performed_by_type`)

---

## 🔐 Row Level Security (RLS)

### Políticas Implementadas

#### 1. Usuários podem ver seus próprios logs

```sql
CREATE POLICY "Users view their own logs"
ON public.action_logs
FOR SELECT
USING (
    affected_user_id = auth.uid() OR performed_by = auth.uid()
);
```

**Permite:** Usuários veem logs onde são o performer OU o usuário afetado.

#### 2. Admins e Finance podem ver todos os logs

```sql
CREATE POLICY "Admins and Finance view all logs"
ON public.action_logs
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'finance')
    )
);
```

**Permite:** Apenas admins e finance veem todos os logs.

#### 3. Usuários autenticados podem inserir logs

```sql
CREATE POLICY "Authenticated users can insert logs"
ON public.action_logs
FOR INSERT
WITH CHECK (performed_by = auth.uid());
```

**Permite:** Qualquer usuário autenticado pode inserir logs, mas apenas com `performed_by = auth.uid()`.

#### 4. Ninguém pode atualizar logs

```sql
CREATE POLICY "Nobody can update logs"
ON public.action_logs
FOR UPDATE
USING (false);
```

**Bloqueia:** Ninguém pode atualizar logs (imutabilidade).

#### 5. Ninguém pode deletar logs

```sql
CREATE POLICY "Nobody can delete logs"
ON public.action_logs
FOR DELETE
USING (false);
```

**Bloqueia:** Ninguém pode deletar logs (proteção de auditoria).

---

## 🔧 Função SQL: `log_action`

### Assinatura

```sql
CREATE OR REPLACE FUNCTION public.log_action(
    p_action_type TEXT,
    p_action_description TEXT,
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL,
    p_affected_user_id UUID DEFAULT NULL,
    p_performed_by_type TEXT DEFAULT 'user'
)
RETURNS UUID
```

### Parâmetros

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `p_action_type` | TEXT | ✅ Sim | Tipo da ação (ex: 'document_upload') |
| `p_action_description` | TEXT | ✅ Sim | Descrição legível da ação |
| `p_entity_type` | TEXT | ❌ Não | Tipo da entidade (ex: 'document') |
| `p_entity_id` | UUID | ❌ Não | ID da entidade afetada |
| `p_metadata` | JSONB | ❌ Não | Dados adicionais (filename, amount, etc.) |
| `p_affected_user_id` | UUID | ❌ Não | ID do usuário afetado |
| `p_performed_by_type` | TEXT | ❌ Não | Tipo do performer (default: 'user') |

### Lógica Interna

```sql
DECLARE
    v_log_id UUID;
    v_current_user_id UUID;
    v_performer_name TEXT;
    v_performer_email TEXT;
BEGIN
    -- 1. Obter usuário autenticado
    v_current_user_id := auth.uid();
    
    IF v_current_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to log actions';
    END IF;
    
    -- 2. Validar performed_by_type
    IF p_performed_by_type NOT IN ('user', 'admin', 'authenticator', 'finance', 'affiliate', 'system') THEN
        RAISE EXCEPTION 'Invalid performed_by_type: %', p_performed_by_type;
    END IF;
    
    -- 3. Buscar informações do performer (cache para performance)
    SELECT 
        COALESCE(name, 'Unknown'),
        COALESCE(email, '')
    INTO 
        v_performer_name,
        v_performer_email
    FROM public.profiles 
    WHERE id = v_current_user_id;
    
    -- 4. Fallback para auth.users se profile não encontrado
    IF v_performer_name IS NULL OR v_performer_name = 'Unknown' THEN
        SELECT 
            COALESCE(raw_user_meta_data->>'name', raw_user_meta_data->>'full_name', 'Unknown'),
            COALESCE(email, '')
        INTO 
            v_performer_name,
            v_performer_email
        FROM auth.users 
        WHERE id = v_current_user_id;
    END IF;
    
    -- 5. Fallback final
    v_performer_name := COALESCE(v_performer_name, 'Unknown User');
    v_performer_email := COALESCE(v_performer_email, 'unknown@example.com');
    
    -- 6. Inserir o log
    INSERT INTO public.action_logs (
        performed_by,
        performed_by_type,
        performed_by_name,
        performed_by_email,
        action_type,
        action_description,
        entity_type,
        entity_id,
        metadata,
        affected_user_id
    ) VALUES (
        v_current_user_id,
        p_performed_by_type,
        v_performer_name,
        v_performer_email,
        p_action_type,
        p_action_description,
        p_entity_type,
        p_entity_id,
        p_metadata,
        COALESCE(p_affected_user_id, v_current_user_id)
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
EXCEPTION WHEN OTHERS THEN
    -- Não falhar se logging falhar (não-bloqueante)
    RAISE WARNING 'Error logging action: %', SQLERRM;
    RETURN NULL;
END;
```

### Características Importantes

1. **SECURITY DEFINER**: Executa com permissões do criador da função
2. **Cache de informações**: Busca nome/email uma vez e armazena (evita JOINs)
3. **Fallbacks**: Tenta `profiles`, depois `auth.users`, depois valores padrão
4. **Não-bloqueante**: Se falhar, retorna NULL mas não quebra a aplicação
5. **Validação**: Valida `performed_by_type` antes de inserir

---

## 💻 Helper TypeScript: `Logger`

### Arquivo: `src/lib/loggingHelpers.ts`

### Classe Logger

```typescript
export class Logger {
  // Métodos principais
  static async logAuth(...)
  static async logDocument(...)
  static async logPayment(...)
  static async logAdminAction(...)
  static async logSystem(...)
  static async log(...) // Método genérico
  
  // Método interno
  private static async _log(...)
  private static async _enrichMetadata(...)
}
```

### Métodos Disponíveis

#### 1. `Logger.logAuth()` - Log de Autenticação

```typescript
static async logAuth(
  actionType: string,
  description: string,
  metadata?: Record<string, any>
)
```

**Exemplo:**
```typescript
await Logger.logAuth(
  ActionTypes.AUTH.USER_LOGIN,
  'User logged in successfully',
  { ip: '192.168.1.1', user_agent: 'Chrome' }
);
```

#### 2. `Logger.logDocument()` - Log de Documento

```typescript
static async logDocument(
  actionType: string,
  docId: string,
  description: string,
  metadata?: Record<string, any>
)
```

**Exemplo:**
```typescript
await Logger.logDocument(
  ActionTypes.DOCUMENT.UPLOADED,
  documentId,
  'Document uploaded successfully',
  {
    filename: 'document.pdf',
    pages: 5,
    total_cost: 100.00
  }
);
```

#### 3. `Logger.logPayment()` - Log de Pagamento

```typescript
static async logPayment(
  actionType: string,
  paymentId: string,
  description: string,
  metadata?: Record<string, any>
)
```

**Exemplo:**
```typescript
await Logger.logPayment(
  ActionTypes.PAYMENT.COMPLETED,
  paymentId,
  'Payment completed successfully',
  {
    amount: 100.00,
    currency: 'USD',
    payment_method: 'stripe'
  }
);
```

#### 4. `Logger.logAdminAction()` - Log de Ação Admin

```typescript
static async logAdminAction(
  actionType: string,
  targetUserId: string,
  description: string,
  metadata?: Record<string, any>
)
```

**Exemplo:**
```typescript
await Logger.logAdminAction(
  ActionTypes.ADMIN.USER_ROLE_CHANGED,
  targetUserId,
  'User role changed from user to admin',
  {
    old_role: 'user',
    new_role: 'admin'
  }
);
```

#### 5. `Logger.logSystem()` - Log de Sistema

```typescript
static async logSystem(
  actionType: string,
  description: string,
  metadata?: Record<string, any>
)
```

**Exemplo:**
```typescript
await Logger.logSystem(
  ActionTypes.SYSTEM.EMAIL_SENT,
  'Email sent to user',
  {
    recipient: 'user@example.com',
    subject: 'Welcome',
    template: 'welcome_email'
  }
);
```

#### 6. `Logger.log()` - Método Genérico

```typescript
static async log(
  actionType: string,
  description: string,
  options?: {
    entityType?: string;
    entityId?: string;
    affectedUserId?: string;
    performerType?: 'user' | 'admin' | 'authenticator' | 'finance' | 'affiliate' | 'system';
    metadata?: Record<string, any>;
  }
)
```

**Exemplo:**
```typescript
await Logger.log(
  ActionTypes.DOCUMENT.APPROVED,
  'Document approved by authenticator',
  {
    entityType: 'document',
    entityId: documentId,
    metadata: {
      filename: 'document.pdf',
      authenticated_by: authenticatorId
    },
    affectedUserId: userId,
    performerType: 'authenticator'
  }
);
```

### Enriquecimento de Metadata

O Logger automaticamente enriquece metadata com IP quando disponível:

```typescript
private static async _enrichMetadata(
  metadata?: Record<string, any>
): Promise<Record<string, any>> {
  const base = metadata || {};
  
  try {
    const response = await fetch('https://api.ipify.org?format=json', {
      signal: AbortSignal.timeout(2000), // 2 second timeout
    });
    
    if (response.ok) {
      const data = await response.json();
      return { ...base, ip: data?.ip };
    }
  } catch (err) {
    // Silent fail - IP enrichment is optional
  }
  
  return base;
}
```

**Características:**
- Timeout de 2 segundos (não bloqueia)
- Falha silenciosa (não quebra se API não responder)
- Adiciona IP quando disponível

---

## 📝 Tipos de Ações Padronizados

### Arquivo: `src/types/actionTypes.ts`

### Estrutura

```typescript
export const ActionTypes = {
  AUTH: { ... },
  DOCUMENT: { ... },
  PAYMENT: { ... },
  ADMIN: { ... },
  SYSTEM: { ... },
  ERROR: { ... },
} as const;
```

### Categorias de Ações

#### 1. Autenticação (`AUTH`)

```typescript
AUTH: {
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_REGISTER: 'user_register',
  PASSWORD_RESET: 'password_reset',
  PASSWORD_RESET_REQUEST: 'password_reset_request',
  LOGIN_FAILED: 'login_failed',
}
```

#### 2. Documentos (`DOCUMENT`)

```typescript
DOCUMENT: {
  UPLOAD: 'document_upload',
  UPLOADED: 'DOCUMENT_UPLOADED',
  UPLOAD_FAILED: 'DOCUMENT_UPLOAD_FAILED',
  APPROVE: 'document_approve',
  APPROVED: 'DOCUMENT_APPROVED',
  REJECT: 'document_reject',
  REJECTED: 'DOCUMENT_REJECTED',
  DELETE: 'document_delete',
  UPDATE: 'document_update',
  DOWNLOAD: 'document_download',
  VIEW: 'document_view',
  // ... mais tipos
}
```

#### 3. Pagamentos (`PAYMENT`)

```typescript
PAYMENT: {
  CREATED: 'payment_created',
  COMPLETED: 'payment_completed',
  CANCELLED: 'payment_cancelled',
  REFUNDED: 'payment_refunded',
  FAILED: 'payment_failed',
  STRIPE_COMPLETED: 'stripe_payment_completed',
  ZELLE_CREATED: 'zelle_payment_created',
  // ... mais tipos
}
```

#### 4. Admin (`ADMIN`)

```typescript
ADMIN: {
  USER_ROLE_CHANGED: 'user_role_changed',
  USER_PROFILE_UPDATED: 'user_profile_updated',
  USER_DELETED: 'user_deleted',
  DOCUMENT_INFO_EDITED: 'document_info_edited',
  // ... mais tipos
}
```

#### 5. Sistema (`SYSTEM`)

```typescript
SYSTEM: {
  EMAIL_SENT: 'email_sent',
  NOTIFICATION_SENT: 'notification_sent',
  REPORT_GENERATED: 'report_generated',
  // ... mais tipos
}
```

#### 6. Erros (`ERROR`)

```typescript
ERROR: {
  AUTHENTICATION_ERROR: 'authentication_error',
  DOWNLOAD_ERROR: 'download_error',
  VIEW_ERROR: 'view_error',
  UPLOAD_ERROR: 'upload_error',
  // ... mais tipos
}
```

### Labels Legíveis

```typescript
export const ActionTypeLabels: Record<string, string> = {
  [ActionTypes.AUTH.USER_LOGIN]: 'User Login',
  [ActionTypes.DOCUMENT.UPLOAD]: 'Document Upload',
  [ActionTypes.PAYMENT.COMPLETED]: 'Payment Completed',
  // ... mais labels
};
```

---

## 🎣 Hook React: `useActionLogs`

### Arquivo: `src/hooks/useActionLogs.ts`

### Interface

```typescript
export interface ActionLog {
  id: string;
  performed_by: string;
  performed_by_type: 'user' | 'admin' | 'authenticator' | 'finance' | 'affiliate' | 'system';
  performed_by_name: string | null;
  performed_by_email: string | null;
  action_type: string;
  action_description: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, any> | null;
  affected_user_id: string | null;
  created_at: string;
}

interface UseActionLogsReturn {
  logs: ActionLog[];
  loading: boolean;
  error: string | null;
  filters: LogFilters;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  fetchLogs: (page?: number, reset?: boolean) => Promise<void>;
  updateFilters: (newFilters: Partial<LogFilters>) => void;
  clearFilters: () => void;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
}
```

### Uso

```typescript
const { logs, loading, pagination, updateFilters, goToPage } = useActionLogs(userId);

// Filtrar por data
updateFilters({ 
  date_from: '2025-01-01T00:00:00',
  date_to: '2025-01-31T23:59:59'
});

// Filtrar por tipo de ação
updateFilters({ action_type: 'document_upload' });

// Filtrar por documento
updateFilters({ document_id: documentId });

// Navegar páginas
goToPage(2);
```

### Filtros Disponíveis

```typescript
interface LogFilters {
  action_type?: string;
  performed_by_type?: string;
  entity_type?: string;
  entity_id?: string;
  filename?: string;
  document_id?: string;
  date_from?: string;
  date_to?: string;
  search_term?: string;
}
```

---

## 🖥️ Componente de Visualização: `ActionLogs`

### Arquivo: `src/pages/AdminDashboard/ActionLogs.tsx`

### Funcionalidades

1. **Lista de Clientes**: Mostra todos os clientes com estatísticas
2. **Logs por Cliente**: Visualização detalhada dos logs de um cliente
3. **Filtros Avançados**:
   - Busca por texto
   - Filtro por data/hora
   - Filtro por documento
   - Filtros rápidos (Today, Yesterday, Last 7 days, etc.)
4. **Paginação**: Navegação entre páginas de logs
5. **Estatísticas**: Total de logs, documentos, última atividade

### Estrutura do Componente

```typescript
export const ActionLogs: React.FC = () => {
  // Estados
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Hooks
  const { clients, loading, refreshClients } = useClientsCache();
  const { logs, loading: logsLoading, pagination, updateFilters } = useActionLogs(selectedClient?.id);
  
  // Renderização condicional
  if (selectedClient) {
    return <ClientLogsView />;
  }
  
  return <ClientsListView />;
};
```

### Visualizações

#### 1. Lista de Clientes

- Grid responsivo
- Busca por nome/email
- Estatísticas por cliente (total logs, documentos, última atividade)
- Clique para ver logs do cliente

#### 2. Logs do Cliente

- Header com informações do cliente
- Estatísticas resumidas
- Barra de busca em tempo real
- Filtros avançados (colapsáveis)
- Lista de logs com paginação
- Componente `LogItem` para cada log

---

## 📚 Exemplos de Uso

### Exemplo 1: Log de Upload de Documento

```typescript
// Após upload bem-sucedido
await Logger.logDocument(
  ActionTypes.DOCUMENT.UPLOADED,
  documentId,
  'Document uploaded successfully',
  {
    filename: fileName,
    original_filename: selectedFile.name,
    file_url: publicUrl,
    pages: pages,
    is_bank_statement: isExtrato,
    target_language: idiomaDestino,
    original_language: idiomaRaiz,
    timestamp: new Date().toISOString()
  }
);
```

### Exemplo 2: Log de Aprovação de Documento

```typescript
// Quando autenticador aprova documento
await Logger.log(
  ActionTypes.DOCUMENT.APPROVED,
  `Document approved by authenticator: ${doc.filename}`,
  {
    entityType: 'document',
    entityId: verificationId,
    metadata: {
      document_id: verificationId,
      original_document_id: document.id,
      filename: doc.filename,
      verification_code: doc.verification_code,
      user_id: doc.user_id,
      pages: doc.pages,
      total_cost: doc.total_cost,
      authenticated_by: authData.authenticated_by,
      authenticated_by_name: authData.authenticated_by_name,
      authentication_date: authData.authentication_date,
      timestamp: new Date().toISOString()
    },
    affectedUserId: doc.user_id,
    performerType: 'authenticator'
  }
);
```

### Exemplo 3: Log de Pagamento

```typescript
// Quando pagamento é completado
await Logger.logPayment(
  ActionTypes.PAYMENT.COMPLETED,
  paymentId,
  'Payment completed successfully',
  {
    amount: 100.00,
    currency: 'USD',
    payment_method: 'stripe',
    stripe_session_id: sessionId,
    document_id: documentId,
    timestamp: new Date().toISOString()
  }
);
```

### Exemplo 4: Log de Erro

```typescript
// Quando ocorre um erro
await Logger.log(
  ActionTypes.ERROR.UPLOAD_ERROR,
  'Document upload failed',
  {
    entityType: 'document',
    entityId: documentId,
    metadata: {
      error_message: error.message,
      error_stack: error.stack,
      filename: fileName,
      file_size: file.size,
      timestamp: new Date().toISOString()
    },
    affectedUserId: userId
  }
);
```

### Exemplo 5: Log de Ação Admin

```typescript
// Quando admin muda role de usuário
await Logger.logAdminAction(
  ActionTypes.ADMIN.USER_ROLE_CHANGED,
  targetUserId,
  'User role changed from user to admin',
  {
    old_role: 'user',
    new_role: 'admin',
    changed_by: adminId,
    timestamp: new Date().toISOString()
  }
);
```

---

## 🎨 Design Decisions

### 1. Por que campos cacheados?

**Problema:** JOINs são lentos em queries frequentes.

**Solução:** Cachear `performed_by_name` e `performed_by_email` na tabela.

**Trade-off:** 
- ✅ Queries mais rápidas
- ✅ Menos JOINs
- ⚠️ Dados podem ficar desatualizados se usuário mudar nome/email

**Mitigação:** Dados são atualizados na próxima ação do usuário.

### 2. Por que JSONB para metadata?

**Problema:** Diferentes ações precisam de diferentes campos.

**Solução:** Usar JSONB para flexibilidade.

**Vantagens:**
- ✅ Extensível sem alterar schema
- ✅ Suporta queries JSONB no PostgreSQL
- ✅ Estrutura flexível

**Desvantagens:**
- ⚠️ Sem validação de schema
- ⚠️ Queries JSONB podem ser mais lentas

### 3. Por que logs são imutáveis?

**Razão:** Auditoria e compliance.

**Benefícios:**
- ✅ Histórico completo e confiável
- ✅ Não pode ser alterado por erros ou má-fé
- ✅ Compliance com regulamentações

**Implementação:** RLS policies bloqueiam UPDATE e DELETE.

### 4. Por que logging não-bloqueante?

**Problema:** Se logging falhar, não deve quebrar a aplicação.

**Solução:** Try-catch em todos os métodos de logging.

**Benefícios:**
- ✅ Aplicação continua funcionando mesmo se logging falhar
- ✅ Logs são importantes mas não críticos

### 5. Por que função SQL em vez de INSERT direto?

**Razões:**
- ✅ Validação centralizada
- ✅ Cache automático de informações
- ✅ Fallbacks para buscar dados do usuário
- ✅ Segurança (SECURITY DEFINER)
- ✅ Consistência

---

## ✅ Boas Práticas

### 1. Sempre use ActionTypes constantes

❌ **Ruim:**
```typescript
await Logger.log('document_upload', 'Document uploaded');
```

✅ **Bom:**
```typescript
await Logger.log(ActionTypes.DOCUMENT.UPLOADED, 'Document uploaded');
```

### 2. Inclua metadata relevante

❌ **Ruim:**
```typescript
await Logger.logDocument(ActionTypes.DOCUMENT.UPLOADED, docId, 'Uploaded');
```

✅ **Bom:**
```typescript
await Logger.logDocument(
  ActionTypes.DOCUMENT.UPLOADED,
  docId,
  'Document uploaded successfully',
  {
    filename: fileName,
    pages: pages,
    total_cost: cost,
    file_url: publicUrl
  }
);
```

### 3. Use métodos específicos quando possível

❌ **Ruim:**
```typescript
await Logger.log(ActionTypes.DOCUMENT.UPLOADED, 'Uploaded', {
  entityType: 'document',
  entityId: docId
});
```

✅ **Bom:**
```typescript
await Logger.logDocument(
  ActionTypes.DOCUMENT.UPLOADED,
  docId,
  'Document uploaded successfully'
);
```

### 4. Sempre trate erros de logging

✅ **Bom:**
```typescript
try {
  await Logger.logDocument(...);
} catch (logError) {
  console.error('Failed to log action:', logError);
  // Não quebra a aplicação
}
```

### 5. Use performerType correto

✅ **Bom:**
```typescript
await Logger.log(
  ActionTypes.DOCUMENT.APPROVED,
  'Document approved',
  {
    performerType: 'authenticator', // Correto!
    affectedUserId: userId
  }
);
```

---

## 🚀 Guia de Implementação Passo a Passo

### Passo 1: Criar Migration

1. Criar arquivo: `supabase/migrations/YYYYMMDDHHMMSS_create_action_logs_table.sql`
2. Copiar SQL da migration original
3. Executar migration

### Passo 2: Criar Helper Logger

1. Criar arquivo: `src/lib/loggingHelpers.ts`
2. Implementar classe `Logger` com todos os métodos
3. Testar métodos básicos

### Passo 3: Criar Tipos de Ações

1. Criar arquivo: `src/types/actionTypes.ts`
2. Definir `ActionTypes` constantes
3. Definir `ActionTypeLabels` para UI

### Passo 4: Criar Hook useActionLogs

1. Criar arquivo: `src/hooks/useActionLogs.ts`
2. Implementar hook com filtros e paginação
3. Testar queries

### Passo 5: Criar Componente de Visualização

1. Criar arquivo: `src/pages/AdminDashboard/ActionLogs.tsx`
2. Implementar lista de clientes
3. Implementar visualização de logs
4. Adicionar filtros

### Passo 6: Integrar Logging na Aplicação

1. Identificar pontos críticos (upload, aprovação, pagamento, etc.)
2. Adicionar `Logger.log()` em cada ponto
3. Testar que logs são criados corretamente

### Passo 7: Testar RLS

1. Testar que usuários veem apenas seus logs
2. Testar que admins veem todos os logs
3. Testar que ninguém pode atualizar/deletar logs

---

## 📊 Queries Úteis

### Buscar logs de um usuário

```sql
SELECT * FROM action_logs
WHERE affected_user_id = 'user-id'
   OR performed_by = 'user-id'
ORDER BY created_at DESC
LIMIT 20;
```

### Buscar logs de um documento

```sql
SELECT * FROM action_logs
WHERE entity_type = 'document'
  AND entity_id = 'document-id'
ORDER BY created_at DESC;
```

### Buscar logs por tipo de ação

```sql
SELECT * FROM action_logs
WHERE action_type = 'document_upload'
ORDER BY created_at DESC
LIMIT 50;
```

### Buscar logs em um período

```sql
SELECT * FROM action_logs
WHERE created_at >= '2025-01-01'
  AND created_at <= '2025-01-31'
ORDER BY created_at DESC;
```

### Buscar logs com metadata específica

```sql
SELECT * FROM action_logs
WHERE metadata->>'filename' ILIKE '%document.pdf%'
ORDER BY created_at DESC;
```

### Estatísticas de ações por tipo

```sql
SELECT 
  action_type,
  COUNT(*) as total,
  COUNT(DISTINCT performed_by) as unique_users
FROM action_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY action_type
ORDER BY total DESC;
```

---

## 🔍 Troubleshooting

### Logs não aparecem

1. Verificar RLS policies
2. Verificar se usuário está autenticado
3. Verificar se `log_action` está sendo chamada
4. Verificar logs do console para erros

### Performance lenta

1. Verificar índices estão criados
2. Verificar queries não estão fazendo JOINs desnecessários
3. Considerar paginação menor
4. Considerar arquivar logs antigos

### Metadata não salva

1. Verificar formato JSON válido
2. Verificar tamanho do JSONB (limite do PostgreSQL)
3. Verificar encoding correto

---

## ✅ Checklist de Implementação

- [ ] Migration criada e executada
- [ ] Tabela `action_logs` criada
- [ ] Índices criados
- [ ] RLS policies configuradas
- [ ] Função `log_action` criada
- [ ] Helper `Logger` implementado
- [ ] Tipos de ações definidos
- [ ] Hook `useActionLogs` implementado
- [ ] Componente de visualização criado
- [ ] Logging integrado em pontos críticos
- [ ] Testes de RLS realizados
- [ ] Performance testada
- [ ] Documentação atualizada

---

## 📝 Conclusão

O sistema de Action Logs é uma solução completa e robusta para auditoria e rastreamento. Ele foi projetado para ser:

- ✅ **Escalável**: Índices e cache para performance
- ✅ **Seguro**: RLS policies restritivas
- ✅ **Extensível**: JSONB para metadata flexível
- ✅ **Confiável**: Imutável e não-bloqueante
- ✅ **Fácil de usar**: Helpers e hooks simplificam o uso

Siga este guia para implementar um sistema idêntico em seu projeto!








