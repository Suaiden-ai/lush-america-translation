# Stripe Sessions Table Fix - Informações de Pagamento Não Salvadas

## 🚨 **Problema Identificado**

### **Erro Principal:**
- ❌ Informações de pagamento não sendo salvas na tabela `stripe_sessions`
- ❌ Tabela `stripe_sessions` não existia ou não estava sendo preenchida
- ❌ Falta de rastreamento das sessões de pagamento do Stripe

### **Impacto:**
- ❌ Impossível rastrear pagamentos processados
- ❌ Dificuldade para auditoria financeira
- ❌ Falta de histórico de transações

## 🔍 **Causa Raiz**

### **1. Tabela Não Existia:**
- ❌ Tabela `stripe_sessions` não estava criada no banco
- ❌ Nenhuma migração para criar a estrutura necessária

### **2. Lógica de Inserção Ausente:**
- ❌ Edge Function `create-checkout-session` não salvava dados da sessão
- ❌ Webhook do Stripe não atualizava status das sessões
- ❌ Falta de integração entre Stripe e banco de dados

## ✅ **Correções Implementadas**

### **1. Nova Migração para Tabela `stripe_sessions`:**
```sql
-- Migration: 20250812000001_create_stripe_sessions_table.sql
CREATE TABLE IF NOT EXISTS stripe_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text UNIQUE NOT NULL,
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  metadata jsonb,
  payment_status text DEFAULT 'pending',
  amount numeric(10,2),
  currency text DEFAULT 'USD',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### **2. Índices de Performance:**
```sql
CREATE INDEX IF NOT EXISTS idx_stripe_sessions_session_id ON stripe_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_stripe_sessions_document_id ON stripe_sessions(document_id);
CREATE INDEX IF NOT EXISTS idx_stripe_sessions_user_id ON stripe_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_sessions_payment_status ON stripe_sessions(payment_status);
```

### **3. Políticas de Segurança (RLS):**
```sql
-- Usuários podem ver suas próprias sessões
CREATE POLICY "Users can read own stripe sessions"
  ON stripe_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins podem ver todas as sessões
CREATE POLICY "Admins can read all stripe sessions"
  ON stripe_sessions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'lush-admin')));

-- Apenas admins podem gerenciar
CREATE POLICY "Only admins can manage stripe sessions"
  ON stripe_sessions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'lush-admin')));
```

### **4. Inserção Automática na Criação da Sessão:**
```typescript
// Edge Function: create-checkout-session
// Após criar a sessão do Stripe, inserir na tabela stripe_sessions
const { error: insertError } = await supabase
  .from('stripe_sessions')
  .insert({
    session_id: session.id,
    document_id: documentId || null,
    user_id: userId,
    metadata: {
      fileId: fileIdentifier,
      userId,
      userEmail,
      filename,
      pages,
      isCertified,
      isNotarized,
      isBankStatement,
      totalPrice,
      isMobile,
      fileSize,
      fileType,
      originalLanguage,
      documentId,
      clientName
    },
    payment_status: 'pending',
    amount: totalPrice,
    currency: 'USD'
  });
```

### **5. Atualização de Status no Webhook:**
```typescript
// Edge Function: stripe-webhook
// Quando pagamento for completado, atualizar status da sessão
const { error: sessionUpdateError } = await supabase
  .from('stripe_sessions')
  .update({
    payment_status: 'completed',
    updated_at: new Date().toISOString()
  })
  .eq('session_id', session.id);
```

## 📊 **Estrutura da Tabela**

### **Campos Principais:**
- **`id`**: UUID único da sessão no banco
- **`session_id`**: ID único da sessão do Stripe
- **`document_id`**: Referência ao documento sendo pago
- **`user_id`**: Referência ao usuário fazendo o pagamento
- **`metadata`**: JSON com todos os metadados da sessão
- **`payment_status`**: Status do pagamento (pending, completed, failed)
- **`amount`**: Valor do pagamento
- **`currency`**: Moeda do pagamento (padrão: USD)

### **Metadados Incluídos:**
```json
{
  "fileId": "identificador_do_arquivo",
  "userId": "id_do_usuario",
  "userEmail": "email@usuario.com",
  "filename": "nome_do_arquivo.pdf",
  "pages": 5,
  "isCertified": true,
  "isNotarized": false,
  "isBankStatement": false,
  "totalPrice": 75.00,
  "isMobile": false,
  "fileSize": "1024000",
  "fileType": "application/pdf",
  "originalLanguage": "Portuguese",
  "documentId": "uuid_do_documento",
  "clientName": "Nome do Cliente"
}
```

## 🔄 **Fluxo de Funcionamento**

### **1. Criação da Sessão:**
```
Frontend → create-checkout-session → Stripe → stripe_sessions (pending)
```

### **2. Processamento do Pagamento:**
```
Stripe Webhook → stripe-webhook → stripe_sessions (completed)
```

### **3. Rastreamento:**
```
stripe_sessions → Histórico completo de pagamentos
```

## 🚀 **Próximos Passos**

### **1. Aplicar Migrações:**
```bash
# Aplicar a nova migração
supabase db push
```

### **2. Deploy das Edge Functions:**
```bash
# Deploy das funções atualizadas
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
```

### **3. Testar Fluxo:**
1. Fazer upload de documento
2. Processar pagamento via Stripe
3. Verificar se dados foram salvos em `stripe_sessions`
4. Confirmar atualização de status após pagamento

## 📈 **Benefícios da Correção**

### **1. Rastreabilidade:**
- ✅ Histórico completo de pagamentos
- ✅ Metadados detalhados de cada transação
- ✅ Auditoria financeira facilitada

### **2. Gestão de Negócio:**
- ✅ Relatórios de receita
- ✅ Análise de conversão
- ✅ Monitoramento de pagamentos

### **3. Suporte ao Cliente:**
- ✅ Rastreamento de transações
- ✅ Resolução de problemas de pagamento
- ✅ Histórico de serviços

## 🔧 **Troubleshooting**

### **Problemas Comuns:**
1. **Erro de permissão**: Verificar se usuário tem role admin
2. **Tabela não encontrada**: Aplicar migração
3. **Dados não salvos**: Verificar logs da Edge Function

### **Logs Importantes:**
```bash
# Verificar logs da Edge Function
supabase functions logs create-checkout-session
supabase functions logs stripe-webhook
```

## 📝 **Notas de Implementação**

- ✅ Tabela criada com RLS ativo
- ✅ Políticas de segurança configuradas
- ✅ Índices para performance otimizada
- ✅ Integração automática com Stripe
- ✅ Tratamento de erros robusto
- ✅ Logs detalhados para debug
