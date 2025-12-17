# Correção do Problema de Salvamento de Pagamentos

## Problema Identificado

Quando o usuário clica em "Upload & Pay" e realiza o pagamento, as informações não estão sendo salvas corretamente no banco de dados nas tabelas:
- `payments` (não existia)
- `stripe_sessions` (existia mas não estava sendo preenchida corretamente)

## Soluções Implementadas

### 1. Criação da Tabela `payments`

Foi criada uma nova migração `20250813000000_create_payments_table.sql` que cria a tabela `payments` com:

```sql
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_session_id text,
  amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'USD',
  status text DEFAULT 'pending',
  payment_method text,
  payment_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### 2. Correção do Webhook do Stripe

O webhook `stripe-webhook/index.ts` foi corrigido para:

- ✅ Inserir corretamente na tabela `payments`
- ✅ Atualizar o status na tabela `stripe_sessions` para 'completed'
- ✅ Atualizar o documento para status 'processing'
- ✅ Melhorar logs de debug para facilitar troubleshooting

### 3. Correção da Função de Criação de Sessão

A função `create-checkout-session/index.ts` foi corrigida para:

- ✅ Inserir corretamente na tabela `stripe_sessions` com todos os campos necessários
- ✅ Incluir `user_id` na inserção
- ✅ Melhorar logs de debug

## Como Aplicar as Correções

### Passo 1: Aplicar as Migrações

Execute as migrações no seu banco Supabase:

```bash
# A migração da tabela payments será aplicada automaticamente
# quando você fizer deploy das funções
```

### Passo 2: Fazer Deploy das Funções Corrigidas

```bash
# Deploy da função stripe-webhook
supabase functions deploy stripe-webhook

# Deploy da função create-checkout-session
supabase functions deploy create-checkout-session
```

### Passo 3: Verificar as Tabelas

Use o arquivo `test-payment-flow.js` para verificar se as tabelas estão funcionando:

```bash
# Instalar dependências
npm install @supabase/supabase-js

# Configurar credenciais no arquivo
# Executar o teste
node test-payment-flow.js
```

## Estrutura do Fluxo de Pagamento

### 1. Usuário Clica em "Upload & Pay"
- Frontend chama `create-checkout-session`
- Função cria sessão do Stripe
- **INSERE na tabela `stripe_sessions`** ✅

### 2. Usuário Completa o Pagamento
- Stripe envia webhook `checkout.session.completed`
- Webhook processa o evento
- **ATUALIZA `stripe_sessions` para 'completed'** ✅
- **INSERE na tabela `payments`** ✅
- **ATUALIZA documento para 'processing'** ✅

## Verificação de Funcionamento

### Logs Esperados no Webhook

```
DEBUG: Processando checkout session completed: cs_test_...
DEBUG: Metadados da sessão: { fileId: ..., userId: ..., documentId: ... }
DEBUG: Atualizando documento existente para status processing
DEBUG: Documento atualizado com sucesso: {...}
DEBUG: Atualizando stripe_sessions para completed
DEBUG: stripe_sessions atualizado com sucesso para completed
DEBUG: Criando registro na tabela payments
DEBUG: Dados do pagamento a serem inseridos: {...}
DEBUG: Registro criado na tabela payments com sucesso: ...
SUCCESS: Pagamento processado com sucesso para documento: ...
```

### Verificar no Banco de Dados

```sql
-- Verificar sessões do Stripe
SELECT * FROM stripe_sessions ORDER BY created_at DESC LIMIT 5;

-- Verificar pagamentos
SELECT * FROM payments ORDER BY created_at DESC LIMIT 5;

-- Verificar documentos atualizados
SELECT id, status, updated_at FROM documents WHERE status = 'processing' ORDER BY updated_at DESC LIMIT 5;
```

## Troubleshooting

### Se as Tabelas Não Existem

1. Verifique se as migrações foram aplicadas
2. Execute manualmente as migrações no SQL Editor do Supabase

### Se o Webhook Não Está Funcionando

1. Verifique os logs da função no dashboard do Supabase
2. Confirme que o webhook está configurado no Stripe
3. Verifique se as variáveis de ambiente estão corretas

### Se os Dados Não Estão Sendo Inseridos

1. Verifique as políticas RLS das tabelas
2. Confirme que a função está usando a `SERVICE_ROLE_KEY`
3. Verifique se há erros de constraint (foreign keys)

## Campos Importantes

### Tabela `stripe_sessions`
- `session_id`: ID único da sessão do Stripe
- `document_id`: Referência ao documento
- `user_id`: Referência ao usuário
- `payment_status`: Status do pagamento (pending/completed/failed)
- `amount`: Valor do pagamento
- `metadata`: Dados adicionais da sessão

### Tabela `payments`
- `document_id`: Referência ao documento
- `user_id`: Referência ao usuário
- `stripe_session_id`: ID da sessão do Stripe
- `amount`: Valor do pagamento
- `status`: Status do pagamento
- `payment_date`: Data do pagamento

## Próximos Passos

1. ✅ Aplicar as migrações
2. ✅ Fazer deploy das funções corrigidas
3. ✅ Testar o fluxo de pagamento
4. ✅ Verificar logs e dados no banco
5. ✅ Monitorar funcionamento em produção

## Suporte

Se ainda houver problemas após aplicar estas correções:

1. Verifique os logs das funções no dashboard do Supabase
2. Execute o arquivo de teste para verificar as tabelas
3. Confirme que todas as variáveis de ambiente estão configuradas
4. Verifique se as políticas RLS estão permitindo as operações necessárias
