# Como Calculamos o Total Revenue na Lush America

## 📊 Resumo Executivo

Na **Lush America**, o **Total Revenue** é calculado usando **apenas pagamentos com status `completed`** da tabela `payments`. 

**Fórmula:**
```
Total Revenue = Soma de todos os pagamentos com status = 'completed'
```

---

## 🔍 Implementação Detalhada

### 1. Finance Dashboard (`StatsCards.tsx`)

**Arquivo:** `src/pages/FinanceDashboard/StatsCards.tsx`

```116:144:src/pages/FinanceDashboard/StatsCards.tsx
      const regularRevenue = paymentsData?.reduce((sum, payment) => {
        // Considerar apenas pagamentos com status 'completed' (pagamentos realmente pagos)
        // NÃO filtrar por role, igual ao Admin Dashboard
        if (payment.status === 'completed') {
          return sum + (payment.amount || 0);
        }
        return sum;
      }, 0) || 0;
      
      // 🔍 LOG COMPARATIVO (agora regularRevenue = allCompletedAmount, pois não filtramos por role)
      const allCompletedPayments = paymentsData?.filter(p => p.status === 'completed') || [];
      const allCompletedAmount = allCompletedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      
      console.log('🔍 FINANCE DASHBOARD - All completed payments:', allCompletedPayments.length);
      console.log('🔍 FINANCE DASHBOARD - All completed amount:', allCompletedAmount.toFixed(2));
      console.log('🔍 FINANCE DASHBOARD - Regular revenue (all completed, no role filter):', regularRevenue.toFixed(2));
      
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
```

**Passo a passo:**
1. Busca todos os pagamentos da tabela `payments`
2. Filtra apenas os com `status === 'completed'`
3. Soma todos os valores (`amount`) desses pagamentos
4. O resultado é o `totalRevenue`

**Observações importantes:**
- ✅ **NÃO filtra por role** (pode incluir roles como 'user', 'finance', etc.)
- ✅ **Exclui automaticamente autenticadores** (eles não têm pagamentos na tabela `payments`)
- ✅ **Exclui pagamentos pending, failed, cancelled** (apenas `completed`)

---

### 2. Admin Dashboard (`StatsCards.tsx`)

**Arquivo:** `src/pages/AdminDashboard/StatsCards.tsx`

```54:91:src/pages/AdminDashboard/StatsCards.tsx
  // Buscar dados exatos para receita (apenas pagamentos com status 'completed')
  // Não incluir receita de autenticador pois não é lucro (valores ficam pending e não são pagos)
  useEffect(() => {
    const fetchRevenueData = async () => {
      try {
        const { data: paysRes } = await supabase
          .from('payments')
          .select('id, document_id, amount, status, user_id');
        
        let userRev = 0;
        const completedPayments: any[] = [];
        
        (paysRes || []).forEach((p: any) => {
          // Considerar apenas pagamentos com status 'completed' (pagamentos realmente pagos)
          if (p?.status === 'completed') {
            userRev += Number(p?.amount || 0);
            completedPayments.push({
              id: p.id,
              document_id: p.document_id,
              user_id: p.user_id,
              amount: p.amount,
              status: p.status
            });
          }
        });
        
        console.log('🔍 ADMIN DASHBOARD - Total completed payments:', completedPayments.length);
        console.log('🔍 ADMIN DASHBOARD - Total revenue (sum of all completed):', userRev.toFixed(2));
        console.log('🔍 ADMIN DASHBOARD - Completed payments details:', completedPayments);
        
        setOverrideRevenue(userRev);
      } catch (e) {
        console.warn('Revenue fetch failed, fallback to doc-based', e);
        setOverrideRevenue(null);
      }
    };
    fetchRevenueData();
  }, []);
```

**Passo a passo:**
1. Faz uma query direta na tabela `payments` via Supabase
2. Seleciona: `id, document_id, amount, status, user_id`
3. Itera sobre todos os pagamentos
4. Para cada pagamento com `status === 'completed'`:
   - Adiciona o `amount` ao total (`userRev`)
   - Armazena em um array para logs
5. O resultado é armazenado em `overrideRevenue` e usado no cálculo final

**Diferença do Finance Dashboard:**
- Faz query direta no Supabase (não usa dados já carregados)
- Armazena detalhes dos pagamentos para logs
- Usa `useEffect` para buscar dados quando o componente monta

---

### 3. Overview Context (Contexto Global)

**Arquivo:** `src/contexts/OverviewContext.tsx`

```117:130:src/contexts/OverviewContext.tsx
        // Receita de autenticador NÃO é incluída no Total Revenue
        // pois não é lucro (valores ficam pending e não são pagos)
        
        // Receita de usuários regulares: considerar apenas pagamentos com status 'completed'
        const regularPaymentsRevenue = (payments || []).reduce((sum, p) => {
          if (!p) return sum;
          // Considerar apenas pagamentos com status 'completed' (pagamentos realmente pagos)
          if (p.status === 'completed') {
            return sum + (p.amount || 0);
          }
          return sum;
        }, 0);

        totalValue = regularPaymentsRevenue;
```

**Passo a passo:**
1. Recebe array de `payments` já carregado
2. Usa `reduce` para somar apenas pagamentos com `status === 'completed'`
3. Atribui o resultado a `totalValue` (que é usado como Total Revenue)

**Uso:**
- Usado em componentes que não são dashboards específicos
- Fornece dados de overview para toda a aplicação
- Mesma lógica dos dashboards, mas em um contexto global

---

## 🔑 Regras de Negócio

### ✅ O que É incluído no Total Revenue:

1. **Pagamentos com `status = 'completed'`**
   - Pagamentos realmente processados e pagos
   - Qualquer role (user, finance, etc.) - desde que tenha pagamento completed

2. **Todos os valores da coluna `amount`** dos pagamentos completed

### ❌ O que NÃO é incluído:

1. **Pagamentos com outros status:**
   - ❌ `pending` - não foi pago ainda
   - ❌ `failed` - falhou no processamento
   - ❌ `cancelled` - foi cancelado
   - ❌ `refunded` - foi reembolsado

2. **Receita de autenticadores:**
   - Autenticadores não têm pagamentos na tabela `payments`
   - Ou têm apenas pagamentos com status `pending`
   - São excluídos automaticamente

3. **Documentos sem pagamento:**
   - Documentos criados mas não pagos
   - Trabalho realizado mas não pago

4. **Documentos de uso pessoal:**
   - Documentos com `is_internal_use = true`
   - São excluídos em alguns cálculos complementares

---

## 📊 Exemplo Prático

### Cenário:

**Tabela `payments`:**
```
| id  | document_id | amount | status    | user_id |
|-----|-------------|--------|-----------|---------|
| 1   | doc_001     | 100.00 | completed | user_1  | ✅ Incluído
| 2   | doc_002     | 50.00  | pending   | user_2  | ❌ Excluído
| 3   | doc_003     | 75.00  | completed | user_3  | ✅ Incluído
| 4   | doc_004     | 200.00 | failed    | user_4  | ❌ Excluído
| 5   | doc_005     | 30.00  | completed | user_5  | ✅ Incluído
```

**Cálculo:**
```typescript
Total Revenue = 100.00 + 75.00 + 30.00 = $205.00
```

**Pagamentos excluídos:**
- `doc_002`: status `pending` ($50.00) - não foi pago ainda
- `doc_004`: status `failed` ($200.00) - falhou no processamento

---

## 🔄 Fluxo de Dados

```
┌─────────────────────────────────────────┐
│     TABELA: payments                    │
│                                         │
│  ┌─────────────┬──────────┬──────────┐ │
│  │ document_id │  amount  │  status  │ │
│  ├─────────────┼──────────┼──────────┤ │
│  │   doc_001   │  100.00  │completed │ │ ✅
│  │   doc_002   │   50.00  │ pending  │ │ ❌
│  │   doc_003   │   75.00  │completed │ │ ✅
│  │   doc_004   │  200.00  │  failed  │ │ ❌
│  └─────────────┴──────────┴──────────┘ │
└─────────────────────────────────────────┘
              │
              ▼
    ┌─────────────────────┐
    │ FILTRO:             │
    │ status ===          │
    │ 'completed'         │
    └─────────────────────┘
              │
              ▼
    ┌─────────────────────┐
    │ SOMA:               │
    │ amount de todos     │
    │ os pagamentos       │
    │ completados         │
    └─────────────────────┘
              │
              ▼
    ┌─────────────────────┐
    │ TOTAL REVENUE       │
    │ $205.00             │
    └─────────────────────┘
```

---

## 📈 Métricas Complementares (Não são Total Revenue)

### 1. Authenticator Revenue

Calculado separadamente para relatórios, mas **não incluído no Total Revenue**:

```typescript
const authenticatorRevenue = documentsData?.reduce((sum, doc) => {
  if (doc.profiles?.role === 'authenticator' && !doc.is_internal_use) {
    return sum + (doc.total_cost || 0);
  }
  return sum;
}, 0) || 0;
```

**Uso:** Apenas para análise e breakdowns, não para Total Revenue.

### 2. Work Volume (Total Cost Documents)

Soma de `total_cost` de todos os documentos (não é Total Revenue):

```typescript
const workVolume = documents.reduce((sum, doc) => sum + (doc.total_cost || 0), 0);
```

**Uso:** Análise operacional, não receita.

---

## 🎯 Resumo da Implementação

| Dashboard/Contexto | Fonte de Dados | Filtro | Resultado |
|-------------------|----------------|--------|-----------|
| **Finance Dashboard** | `paymentsData` (array) | `status === 'completed'` | `totalRevenue` |
| **Admin Dashboard** | Query direta `payments` | `status === 'completed'` | `overrideRevenue` |
| **Overview Context** | `payments` (array) | `status === 'completed'` | `totalValue` |

**Todos usam a mesma lógica:**
1. ✅ Buscar pagamentos
2. ✅ Filtrar apenas `status === 'completed'`
3. ✅ Somar valores (`amount`)
4. ✅ Excluir autenticadores automaticamente (não têm pagamentos)

---

## ✅ Conclusão

Na **Lush America**, o **Total Revenue** é sempre calculado como:

```typescript
Total Revenue = SUM(payments.amount) WHERE payments.status = 'completed'
```

**Por quê?**
- ✅ Reflete receita real recebida
- ✅ Alinhado com princípios contábeis
- ✅ Exclui automaticamente valores não realizados
- ✅ Exclui autenticadores (não têm pagamentos)
- ✅ Padrão consistente em todos os dashboards

**Não usamos:**
- ❌ Soma de `total_cost` de documentos (inclui não pagos)
- ❌ Pagamentos com status diferente de `completed`
- ❌ Receita de autenticadores







