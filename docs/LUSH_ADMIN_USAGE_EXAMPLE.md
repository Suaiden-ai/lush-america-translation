# Guia de Uso do Painel Lush Admin

## Visão Geral

O painel Lush Admin é uma interface específica para usuários com role `lush-admin` que permite:
- Visualizar estatísticas de pagamentos
- Acompanhar documentos traduzidos
- Gerar relatórios de pagamentos
- Download de relatórios em CSV

## Como Usar

### 1. Configurar um usuário como Lush Admin

```sql
-- Atualizar um usuário existente para role lush-admin
UPDATE profiles 
SET role = 'lush-admin' 
WHERE email = 'seu-email@domain.com';
```

### 2. Importar o componente no seu app

```tsx
import { LushAdminDashboard } from './components/LushAdminDashboard';
import { useLushAdmin } from './hooks/useLushAdmin';

function App() {
  const { isLushAdmin, loading } = useLushAdmin();

  if (loading) {
    return <div>Carregando...</div>;
  }

  if (isLushAdmin) {
    return <LushAdminDashboard />;
  }

  return <div>Acesso negado</div>;
}
```

### 3. Proteger rotas

```tsx
import { useLushAdmin } from './hooks/useLushAdmin';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLushAdmin, loading } = useLushAdmin();

  if (loading) {
    return <div>Verificando permissões...</div>;
  }

  if (!isLushAdmin) {
    return <div>Acesso negado. Apenas Lush Admins podem acessar esta página.</div>;
  }

  return <>{children}</>;
}
```

## Funcionalidades Disponíveis

### Estatísticas de Pagamentos
- Total de pagamentos
- Valor total recebido
- Pagamentos concluídos
- Pagamentos pendentes
- Pagamentos falharam

### Estatísticas de Traduções
- Total de documentos
- Traduções concluídas
- Traduções pendentes
- Receita total

### Relatórios
- **Mensal**: Últimos 30 dias
- **Trimestral**: Último trimestre
- **Anual**: Último ano
- **Customizado**: Período específico

### Download de Relatórios
- Formato CSV
- Nome automático com data
- Dados completos de pagamentos

## Estrutura de Dados

### Tabela Payments
```sql
CREATE TABLE payments (
  id uuid PRIMARY KEY,
  document_id uuid REFERENCES documents_to_be_verified(id),
  user_id uuid REFERENCES profiles(id),
  stripe_session_id text,
  amount numeric(10,2),
  currency text DEFAULT 'USD',
  status text DEFAULT 'pending',
  payment_method text,
  payment_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Tabela Reports
```sql
CREATE TABLE reports (
  id uuid PRIMARY KEY,
  report_type text CHECK (report_type IN ('monthly', 'quarterly', 'annual', 'custom')),
  title text NOT NULL,
  description text,
  file_url text,
  generated_by uuid REFERENCES profiles(id),
  parameters jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

## Funções Disponíveis

### Verificar Role
```sql
SELECT is_lush_admin(); -- Retorna true/false
```

### Estatísticas de Pagamentos
```sql
SELECT * FROM get_payment_stats();
SELECT * FROM get_payment_stats('2025-01-01', '2025-12-31');
```

### Estatísticas de Traduções
```sql
SELECT * FROM get_translation_stats();
SELECT * FROM get_translation_stats('2025-01-01', '2025-12-31');
```

### Gerar Relatório
```sql
SELECT * FROM generate_payment_report('monthly');
SELECT * FROM generate_payment_report('custom', '2025-01-01', '2025-12-31');
```

## Segurança

- Apenas usuários com role `lush-admin` podem acessar
- Todas as funções verificam permissões
- RLS (Row Level Security) ativo em todas as tabelas
- Políticas específicas para cada operação

## Personalização

### Adicionar Novas Estatísticas
```sql
-- Exemplo: estatísticas por idioma
CREATE OR REPLACE FUNCTION get_language_stats()
RETURNS TABLE(
  language text,
  total_documents numeric,
  total_revenue numeric
) AS $$
BEGIN
  IF NOT is_lush_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  RETURN QUERY
  SELECT 
    source_language as language,
    COUNT(*)::numeric as total_documents,
    COALESCE(SUM(total_cost), 0) as total_revenue
  FROM documents_to_be_verified
  GROUP BY source_language
  ORDER BY total_revenue DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Adicionar Novos Relatórios
```sql
-- Exemplo: relatório de documentos por status
CREATE OR REPLACE FUNCTION generate_document_status_report()
RETURNS TABLE(
  status text,
  count numeric,
  total_cost numeric
) AS $$
BEGIN
  IF NOT is_lush_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  RETURN QUERY
  SELECT 
    status,
    COUNT(*)::numeric as count,
    COALESCE(SUM(total_cost), 0) as total_cost
  FROM documents_to_be_verified
  GROUP BY status
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Troubleshooting

### Erro: "Access denied. Only lush-admin users can access..."
- Verificar se o usuário tem role `lush-admin`
- Verificar se a função `is_lush_admin()` está funcionando
- Verificar se as políticas RLS estão corretas

### Relatórios não carregam
- Verificar se há dados na tabela `payments`
- Verificar se as funções estão sendo chamadas corretamente
- Verificar logs do console para erros

### Estatísticas não atualizam
- Verificar se as tabelas têm dados
- Verificar se as funções estão retornando dados
- Verificar se há erros de permissão
