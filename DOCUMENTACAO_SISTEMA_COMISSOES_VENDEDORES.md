# Documentação Técnica: Sistema de Comissões e Vendedores (Affiliates)

## Visão Geral

Este documento descreve tecnicamente a implementação do sistema de comissões e vendedores (affiliates), com foco especial na funcionalidade de **Payment Request** (Solicitação de Pagamento), onde o vendedor só pode solicitar saques a partir do mês em que realizou a primeira venda.

---

## 1. Arquitetura do Sistema

### 1.1 Estrutura de Tabelas

O sistema utiliza as seguintes tabelas principais:

#### `affiliates`
Armazena informações dos vendedores/afiliados:
- `id` (uuid): Identificador único
- `user_id` (uuid): Referência ao perfil do usuário
- `referral_code` (text): Código único de referência
- `current_level` (integer): Nível atual (1 ou 2)
- `total_pages_referred` (integer): Total de páginas referenciadas
- `total_commission_earned` (numeric): Total de comissões ganhas
- `available_balance` (numeric): Saldo disponível para saque

#### `affiliate_commissions`
Armazena cada comissão individual:
- `id` (uuid): Identificador único
- `affiliate_id` (uuid): Referência ao afiliado
- `client_id` (uuid): Cliente que gerou a comissão
- `document_id` (uuid): Documento relacionado
- `payment_id` (uuid): Pagamento relacionado
- `pages_count` (integer): Número de páginas
- `commission_rate` (numeric): Taxa de comissão por página
- `commission_amount` (numeric): Valor da comissão
- `status` (text): Status ('pending', 'confirmed', 'reversed', 'withdrawn')
- `available_for_withdrawal_at` (timestamptz): Data quando a comissão fica disponível para saque
- `withdrawn_amount` (numeric): Valor já sacado desta comissão
- `created_at` (timestamptz): Data de criação da comissão

#### `affiliate_withdrawal_requests`
Armazena solicitações de saque:
- `id` (uuid): Identificador único
- `affiliate_id` (uuid): Referência ao afiliado
- `amount` (numeric): Valor solicitado
- `payment_method` (text): Método de pagamento ('zelle', 'bank_transfer', 'stripe', 'other')
- `payment_details` (jsonb): Detalhes do método de pagamento
- `status` (text): Status ('pending', 'approved', 'rejected', 'completed')
- `requested_at` (timestamptz): Data da solicitação

---

## 2. Sistema de Comissões

### 2.1 Cálculo de Comissões

A comissão é calculada automaticamente quando um pagamento é confirmado através da função `calculate_affiliate_commission`:

```sql
CREATE OR REPLACE FUNCTION calculate_affiliate_commission(
    p_payment_id uuid,
    p_document_id uuid,
    p_client_id uuid,
    p_pages_count integer
)
```

**Fluxo de Cálculo:**

1. **Identificação do Afiliado**: Busca o código de referência (`referred_by_code`) no perfil do cliente
2. **Busca do Afiliado**: Localiza o afiliado pelo código de referência
3. **Cálculo da Taxa**: Determina a taxa baseada no nível:
   - Nível 1: $0.50 por página
   - Nível 2: $1.00 por página
4. **Cálculo do Valor**: `commission_amount = pages_count * commission_rate`
5. **Criação do Registro**: Insere em `affiliate_commissions` com:
   - `status = 'confirmed'`
   - `available_for_withdrawal_at = now() + interval '30 days'` (período de maturação)

### 2.2 Período de Maturação

Cada comissão possui um **período de maturação de 30 dias**. Isso significa que:
- A comissão é criada com status `confirmed` imediatamente
- Mas só fica disponível para saque após 30 dias (`available_for_withdrawal_at`)
- Durante esse período, a comissão aparece como "pending balance"

### 2.3 Trigger de Cálculo Automático

O cálculo é disparado automaticamente através de um trigger no PostgreSQL:

```sql
CREATE TRIGGER trigger_payments_calculate_commission
    AFTER INSERT OR UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_calculate_affiliate_commission();
```

O trigger verifica se o status do pagamento mudou para `'completed'` e então chama a função de cálculo.

---

## 3. Sistema de Payment Request (Solicitação de Pagamento)

### 3.1 Validação da Primeira Venda

O sistema implementa uma validação crítica: **o vendedor só pode solicitar saques a partir do mês em que realizou a primeira venda**.

#### 3.1.1 Identificação da Primeira Venda

A primeira venda é identificada através do campo `first_page_translated_at`, que é calculado como:

```sql
MIN(ac.created_at) 
FROM affiliate_commissions ac
WHERE ac.affiliate_id = p_affiliate_id
  AND ac.status = 'confirmed'
```

Este campo representa a data da primeira comissão confirmada (primeira venda efetivada).

#### 3.1.2 Validação no Frontend

A validação é implementada no componente `WithdrawalTimer` (`src/components/WithdrawalTimer.tsx`):

```typescript
const firstPageDate = new Date(firstPageTranslatedAt);
const now = new Date();
const diffInMs = now.getTime() - firstPageDate.getTime();
const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

if (diffInDays >= 30) {
  setIsAvailable(true);
  setTimeLeft(t('affiliate.withdrawalAvailableNow'));
} else {
  setIsAvailable(false);
  // Mostra contador regressivo
}
```

**Lógica de Validação:**
1. Se `firstPageTranslatedAt` é `null`: O vendedor ainda não fez nenhuma venda → **não pode solicitar**
2. Se passaram menos de 30 dias desde a primeira venda: Mostra contador regressivo → **não pode solicitar**
3. Se passaram 30 ou mais dias: Permite solicitação → **pode solicitar**

#### 3.1.3 Validação no Backend

A função `create_withdrawal_request` valida:

```sql
CREATE OR REPLACE FUNCTION create_withdrawal_request(
    p_affiliate_id uuid,
    p_amount numeric,
    p_payment_method text,
    p_payment_details jsonb
)
```

**Validações Realizadas:**

1. **Existência do Afiliado**:
   ```sql
   SELECT id INTO v_affiliate_id
   FROM affiliates
   WHERE id = p_affiliate_id;
   ```

2. **Saldo Disponível**:
   ```sql
   SELECT available_balance INTO v_available_balance
   FROM get_affiliate_available_balance(v_affiliate_id);
   
   IF p_amount > v_available_balance THEN
       RAISE EXCEPTION 'Valor solicitado excede o saldo disponível';
   END IF;
   ```
   
   **Nota Importante sobre Valores de Saque:**
   - O afiliado pode solicitar **qualquer valor** entre $0.01 e o saldo disponível
   - **Não é obrigatório** solicitar todo o saldo disponível de uma vez
   - O sistema permite **saques parciais múltiplos** - o afiliado pode fazer várias solicitações menores
   - **Não há limite de frequência**: O afiliado pode fazer **quantas solicitações quiser**, não há restrição de "uma por mês" ou similar
   - A única restrição é que o valor não pode exceder o saldo disponível no momento da solicitação
   - **Importante**: O campo `last_withdrawal_request_date` foi removido do sistema, indicando que não há controle de frequência de solicitações

**Nota Importante**: A validação do mês da primeira venda é feita indiretamente através do cálculo do `available_balance`, que só considera comissões onde `available_for_withdrawal_at <= now()`. Como cada comissão tem um período de maturação de 30 dias a partir da data da primeira comissão, isso garante que o vendedor só pode sacar após 30 dias da primeira venda.

### 3.2 Cálculo do Saldo Disponível

A função `get_affiliate_available_balance` calcula o saldo disponível:

```sql
CREATE OR REPLACE FUNCTION get_affiliate_available_balance(p_affiliate_id uuid)
RETURNS TABLE (
    available_balance numeric,
    pending_balance numeric,
    next_withdrawal_date timestamptz
)
```

**Lógica de Cálculo:**

1. **Saldo Disponível** (`available_balance`):
   ```sql
   SUM(
       CASE 
           WHEN ac.status = 'confirmed' 
           AND ac.available_for_withdrawal_at <= now() 
           THEN ac.commission_amount - COALESCE(ac.withdrawn_amount, 0)
           ELSE 0
       END
   )
   ```
   - Soma apenas comissões confirmadas
   - Que já passaram do período de maturação (30 dias)
   - Desconta valores já sacados

2. **Saldo Pendente** (`pending_balance`):
   ```sql
   SUM(
       CASE 
           WHEN ac.status = 'confirmed' 
           AND ac.available_for_withdrawal_at > now() 
           THEN ac.commission_amount - COALESCE(ac.withdrawn_amount, 0)
           ELSE 0
       END
   )
   ```
   - Soma comissões que ainda estão no período de maturação

3. **Próxima Data de Liberação** (`next_withdrawal_date`):
   ```sql
   MIN(
       CASE 
           WHEN ac.status = 'confirmed' 
           AND ac.available_for_withdrawal_at > now() 
           THEN ac.available_for_withdrawal_at
           ELSE NULL
       END
   )
   ```
   - Retorna a data da próxima comissão que ficará disponível

### 3.3 Processo de Solicitação

**Fluxo Completo:**

1. **Frontend** (`src/hooks/useAffiliate.ts`):
   ```typescript
   const createWithdrawalRequest = async (requestData: CreateWithdrawalRequestData) => {
     // 1. Busca affiliate_id do usuário
     const { data: affiliateData } = await supabase
       .from('affiliates')
       .select('id')
       .eq('user_id', userId)
       .single();
     
     // 2. Chama função RPC
     const { data, error } = await supabase
       .rpc('create_withdrawal_request', {
         p_affiliate_id: affiliateData.id,
         p_amount: requestData.amount,
         p_payment_method: requestData.payment_method,
         p_payment_details: requestData.payment_details
       });
   }
   ```

2. **Backend** (`create_withdrawal_request`):
   - Valida existência do afiliado
   - Calcula saldo disponível
   - Valida se o valor solicitado não excede o saldo (mas permite qualquer valor >= $0.01)
   - **Não verifica** se já existe uma solicitação pendente ou aprovada no mesmo mês/período
   - Cria registro em `affiliate_withdrawal_requests` com status `'pending'`
   - **Importante:** O sistema permite saques parciais múltiplos - o afiliado não precisa solicitar todo o saldo de uma vez e pode fazer quantas solicitações quiser, desde que tenha saldo disponível

3. **Aprovação (Admin)**:
   - Admin aprova/rejeita através de `updateWithdrawalRequest`
   - Se aprovado, chama `process_withdrawal_approval` que:
     - Processa saques em ordem FIFO (First In, First Out)
     - Marca comissões como `'withdrawn'` ou atualiza `withdrawn_amount`
     - Atualiza o `available_balance` do afiliado

---

## 4. Sistema de Níveis

### 4.1 Níveis de Afiliado

- **Nível 1**: Taxa de $0.50 por página
- **Nível 2**: Taxa de $1.00 por página (requer 200+ páginas referenciadas)

### 4.2 Atualização Automática de Nível

A função `update_affiliate_level` é chamada automaticamente após cada comissão:

```sql
CREATE OR REPLACE FUNCTION update_affiliate_level(p_affiliate_id uuid)
```

**Lógica:**
- Se `total_pages_referred >= 200` e `current_level = 1`: Atualiza para nível 2
- Caso contrário: Mantém nível atual

---

## 5. Reversão de Comissões

### 5.1 Trigger de Reversão

Quando um pagamento é estornado ou cancelado, um trigger reverte automaticamente a comissão:

```sql
CREATE TRIGGER trigger_payments_reverse_commission
    AFTER UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_reverse_affiliate_commission();
```

### 5.2 Função de Reversão

```sql
CREATE OR REPLACE FUNCTION reverse_affiliate_commission(
    p_payment_id uuid,
    p_reversal_reason text DEFAULT 'Pagamento estornado/cancelado'
)
```

**Ações Realizadas:**
1. Busca a comissão relacionada ao pagamento
2. Atualiza status para `'reversed'`
3. Registra motivo da reversão
4. Atualiza o saldo disponível do afiliado (subtrai o valor)

---

## 6. Componentes Frontend

### 6.1 `WithdrawalTimer`

Componente que exibe o status de disponibilidade para saque:

- **Props:**
  - `firstPageTranslatedAt`: Data da primeira venda
  - `canRequestWithdrawal`: Se pode solicitar (baseado em saldo disponível)
  - `daysUntilWithdrawalAvailable`: Dias até próxima liberação

- **Comportamento:**
  - Se não há primeira venda: Mostra mensagem informativa
  - Se passaram menos de 30 dias: Mostra contador regressivo
  - Se passaram 30+ dias e há saldo: Mostra como disponível

### 6.2 `AffiliateEarnings`

Página principal de gerenciamento de ganhos:

- **Tabs:**
  - Commissions: Histórico de comissões
  - Withdrawals: Histórico de solicitações de saque

- **Funcionalidades:**
  - Visualização de estatísticas (saldo disponível, pendente, total ganho)
  - Filtros e ordenação de comissões
  - Criação de nova solicitação de saque
  - Visualização de detalhes de solicitações

---

## 7. Segurança e Permissões

### 7.1 Row Level Security (RLS)

As políticas RLS garantem que:
- Afiliados só veem seus próprios dados
- Admins podem ver todos os dados
- Funções RPC usam `SECURITY DEFINER` para executar com privilégios elevados

### 7.2 Validações de Segurança

1. **Validação de Saldo**: Impede saques acima do disponível
2. **Validação de Período**: Impede saques antes do período de maturação (30 dias desde a primeira venda)
3. **Validação de Existência**: Verifica se o afiliado existe antes de processar
4. **Sem Limite de Frequência**: Não há validação que limite o número de solicitações por mês/período. O afiliado pode fazer múltiplas solicitações desde que tenha saldo disponível

---

## 8. Fluxo de Dados Completo

### 8.1 Criação de Comissão

```
Cliente faz pagamento
    ↓
Payment status = 'completed'
    ↓
Trigger: trigger_payments_calculate_commission
    ↓
calculate_affiliate_commission()
    ↓
INSERT INTO affiliate_commissions
    - status = 'confirmed'
    - available_for_withdrawal_at = now() + 30 days
    ↓
UPDATE affiliates
    - total_pages_referred += pages_count
    - total_commission_earned += commission_amount
    ↓
update_affiliate_level()
    - Verifica se deve subir de nível
```

### 8.2 Solicitação de Saque

```
Vendedor solicita saque
    ↓
Frontend: createWithdrawalRequest()
    ↓
RPC: create_withdrawal_request()
    ↓
Validações:
    - Afiliado existe?
    - Saldo disponível >= valor solicitado?
    ↓
INSERT INTO affiliate_withdrawal_requests
    - status = 'pending'
    ↓
Admin aprova
    ↓
process_withdrawal_approval()
    ↓
Processa em ordem FIFO:
    - Atualiza withdrawn_amount nas comissões
    - Marca como 'withdrawn' se totalmente sacado
    ↓
UPDATE affiliates.available_balance
```

---

## 9. Considerações Técnicas Importantes

### 9.1 Período de Maturação

- **30 dias** é o período padrão de maturação
- Cada comissão tem seu próprio `available_for_withdrawal_at`
- Comissões são processadas em ordem FIFO durante saques

### 9.2 Cálculo de Saldo

- O saldo disponível é calculado dinamicamente
- Não é armazenado diretamente, mas calculado através de `get_affiliate_available_balance`
- O campo `available_balance` na tabela `affiliates` é atualizado periodicamente

### 9.3 Validação do Mês da Primeira Venda

A validação é implementada através de:
1. **Período de maturação de 30 dias** em cada comissão
2. **Cálculo do saldo disponível** que só considera comissões maduras
3. **Frontend** que verifica `first_page_translated_at` e bloqueia UI se necessário

**Resultado**: O vendedor só pode solicitar saques quando:
- Passaram pelo menos 30 dias desde a primeira venda
- Há comissões com `available_for_withdrawal_at <= now()`
- O saldo disponível é maior que zero

---

## 10. Melhorias Futuras Sugeridas

1. **Validação no Backend**: Adicionar validação explícita do mês da primeira venda na função `create_withdrawal_request`
2. **Histórico de Saques**: Implementar tabela de histórico de saques processados
3. **Notificações**: Notificar vendedores quando comissões ficam disponíveis
4. **Dashboard Admin**: Melhorar visualização de solicitações pendentes
5. **Relatórios**: Adicionar relatórios de comissões por período

---

## 11. Referências de Código

### Arquivos Principais

- **Migrations:**
  - `supabase/migrations/20250130000002_create_affiliates_tables.sql`
  - `supabase/migrations/20250130000003_create_affiliate_functions.sql`
  - `supabase/migrations/20250130000007_add_commission_maturation.sql`
  - `supabase/migrations/20250130000008_create_balance_calculation_functions.sql`

- **Frontend:**
  - `src/hooks/useAffiliate.ts`
  - `src/pages/AffiliateDashboard/AffiliateEarnings.tsx`
  - `src/components/WithdrawalTimer.tsx`

- **Backend:**
  - Funções SQL em `supabase/migrations/20250130000003_create_affiliate_functions.sql`

---

## Conclusão

O sistema de comissões e payment request foi implementado com foco em segurança, rastreabilidade e controle financeiro. A validação do período de maturação de 30 dias garante que os vendedores só possam solicitar saques após um período adequado desde a primeira venda, protegendo tanto a empresa quanto os vendedores de problemas financeiros.
