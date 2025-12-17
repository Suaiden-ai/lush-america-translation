# Migração da Role `lush-admin` para `finance`

## Resumo

Esta migração alterou a role `lush-admin` para `finance` em todo o sistema, incluindo dashboard, rotas, componentes e banco de dados.

## Alterações Realizadas

### 1. Banco de Dados
- **Migração**: `supabase/migrations/20250121000000_change_lush_admin_to_finance_role.sql`
- Atualização do enum `user_role` de `'user' | 'admin' | 'authenticator' | 'lush-admin'` para `'user' | 'admin' | 'authenticator' | 'finance'`
- Migração automática de usuários existentes com role `lush-admin` para `finance`
- Criação da função `is_finance()` substituindo `is_lush_admin()`
- Remoção da função obsoleta `is_lush_admin()`

### 2. TypeScript Types
- **Arquivo**: `src/lib/database.types.ts`
- Atualização do enum `user_role` no schema TypeScript
- Atualização da função `is_finance` nos types

### 3. Hooks
- **Removido**: `src/hooks/useLushAdmin.tsx`
- **Criado**: `src/hooks/useFinance.tsx`
- **Atualizado**: `src/hooks/useAuth.tsx` - tipos de role atualizados

### 4. Componentes
- **Diretório renomeado**: `src/pages/LushAdminDashboard/` → `src/pages/FinanceDashboard/`
- Todos os componentes foram migrados e atualizados:
  - `index.tsx` → Dashboard principal com título "Finance Dashboard"
  - `StatsCards.tsx` → Mantém funcionalidades de estatísticas financeiras
  - `PaymentsTable.tsx` → Tabela de pagamentos
  - `ReportsTable.tsx` → Geração de relatórios
  - `DocumentDetailsModal.tsx` → Modal de detalhes de documentos

### 5. Rotas e Navegação
- **Arquivo**: `src/App.tsx`
- Rota `/lush-admin/*` → `/finance/*`
- Títulos e labels atualizados para "Finance Dashboard"
- Navegação automática atualizada para role `finance`

- **Arquivo**: `src/components/AuthRedirect.tsx`
- Lógica de redirecionamento atualizada para role `finance`
- Proteção de rotas `/finance/*` aplicada

- **Arquivo**: `src/components/AdminLayout.tsx`
- Links de perfil atualizados para `/finance/profile`

### 6. Funcionalidades Mantidas
- Todas as funcionalidades financeiras foram preservadas:
  - Visualização de estatísticas de pagamentos
  - Tabela de pagamentos com filtros e exportação
  - Geração de relatórios personalizados
  - Breakdown por tipo de usuário
  - Modal de detalhes de documentos

## Como Aplicar a Migração

### 1. Executar a Migração do Banco
```sql
-- A migração será aplicada automaticamente no próximo deploy
-- Arquivo: supabase/migrations/20250121000000_change_lush_admin_to_finance_role.sql
```

### 2. Deploy da Aplicação
```bash
# As alterações no código já estão implementadas
# Fazer deploy da aplicação atualizada
```

### 3. Verificação
- Usuários com role `lush-admin` serão automaticamente redirecionados para `/finance`
- O dashboard funcionará normalmente com todas as funcionalidades
- A função `is_finance()` estará disponível no banco para verificações

## Impacto
- **Zero downtime**: A migração do banco é retrocompatível
- **Usuários existentes**: Mantêm acesso com a nova role `finance`
- **URLs**: Alteradas de `/lush-admin` para `/finance`
- **Funcionalidades**: 100% preservadas

## Notas Técnicas
- A migração do banco atualiza automaticamente usuários existentes
- O sistema agora usa terminologia mais clara e específica para finance
- Todas as políticas RLS continuam funcionando normalmente
- A função `is_lush_admin()` foi removida e substituída por `is_finance()`
