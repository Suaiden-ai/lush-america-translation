# Documentação: Exclusão de Valores do Autenticador do Total Revenue

## 📋 Visão Geral

Esta documentação explica como foi implementada a exclusão dos valores de uploads realizados por autenticadores do cálculo do **Total Revenue** nos dashboards Admin e Financeiro.

### 🎯 Objetivo

Os valores de documentos enviados por autenticadores **não são contabilizados no Total Revenue** porque:
- Não representam lucro real para a empresa
- Os valores ficam com status `pending` e não são pagos
- São documentos internos de trabalho dos autenticadores

---

## 🔍 Implementação no Admin Dashboard

### 1. Cálculo do Total Revenue (StatsCards)

**Arquivo:** `src/pages/AdminDashboard/StatsCards.tsx`

O cálculo do Total Revenue no Admin Dashboard utiliza a tabela `payments` e considera **apenas pagamentos com status `completed`**:

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

**Lógica:**
- Busca todos os pagamentos da tabela `payments`
- Filtra apenas os pagamentos com `status === 'completed'`
- Soma todos os valores dos pagamentos completados
- Armazena em `overrideRevenue` que é usado no cálculo final

**Resultado:** Como autenticadores não têm pagamentos na tabela `payments` (ou têm apenas com status `pending`), seus valores são automaticamente excluídos.

### 2. Cálculo do Total na Tabela de Documentos (DocumentsTable)

**Arquivo:** `src/pages/AdminDashboard/DocumentsTable.tsx`

Na tabela de documentos, o cálculo do total filtrado também exclui explicitamente documentos de autenticadores:

```305:347:src/pages/AdminDashboard/DocumentsTable.tsx
  // Total dinâmico baseado nos filtros atuais
  const totalAmountFiltered = useMemo(() => {
    // Regra: apenas pagamentos com status 'completed' de usuários regulares
    // NÃO incluir receita de autenticador pois não é lucro (valores ficam pending e não são pagos)
    let userSum = 0;
    const total = filteredDocuments
      .filter(doc => (doc.status || '') !== 'draft')
      .reduce((sum, doc) => {
        const isAuthenticator = (doc.user_role || 'user') === 'authenticator';
        // Não somar receita de autenticador
        if (isAuthenticator) {
          return sum;
        }
        // Considerar apenas pagamentos com status 'completed'
        const payment = (doc.payment_status || '').toLowerCase();
        if (payment === 'completed') {
          // Somar todos os pagamentos confirmados quando disponível; fallback para total_cost
          const amount = typeof doc.payment_amount_total === 'number' && (doc.payment_amount_total || 0) > 0
            ? (doc.payment_amount_total as number)
            : (typeof doc.payment_amount === 'number' ? doc.payment_amount : (doc.total_cost || 0));
          userSum += amount;
          return sum + amount;
        }
        return sum;
      }, 0);
    try {
      console.log('[DocumentsTable] Filtered docs:', filteredDocuments.length);
      console.log('[DocumentsTable] Users paid sum (status=completed only):', userSum.toFixed(2));
      console.log('[DocumentsTable] Total (only completed payments):', total.toFixed(2));
      const samples = filteredDocuments.slice(0, 10).map(d => ({
        id: d.id,
        filename: d.filename,
        role: d.user_role,
        status: d.status,
        payment_status: d.payment_status,
        payment_amount_total: d.payment_amount_total,
        payment_amount: d.payment_amount,
        total_cost: d.total_cost
      }));
      console.log('[DocumentsTable] Sample rows:', samples);
    } catch {}
    return total;
  }, [filteredDocuments]);
```

**Lógica:**
1. Filtra documentos que não são `draft`
2. Verifica se o documento é de um autenticador (`user_role === 'authenticator'`)
3. **Se for autenticador, não soma** (retorna `sum` sem adicionar)
4. Se for usuário regular, verifica se o pagamento tem status `completed`
5. Soma apenas valores de pagamentos completados de usuários regulares

---

## 💰 Implementação no Finance Dashboard

### Cálculo do Total Revenue (StatsCards)

**Arquivo:** `src/pages/FinanceDashboard/StatsCards.tsx`

No Finance Dashboard, a lógica é similar, mas calcula separadamente a receita de autenticadores para fins de relatório:

```110:148:src/pages/FinanceDashboard/StatsCards.tsx
      // User Uploads: usar dados da tabela payments
      // NÃO incluir receita de autenticador pois não é lucro (valores ficam pending e não são pagos)
      
      // Revenue de usuários regulares (User Uploads) - usar tabela payments
      // MESMA LÓGICA DO ADMIN DASHBOARD: somar TODOS os pagamentos completed
      // (não apenas os de role='user', pois podem haver outros roles válidos como 'finance')
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
      
      console.log('🔍 Debug - StatsCards total_revenue (only completed payments):', totalRevenue);
      console.log('🔍 Debug - User Uploads revenue (from payments table, status=completed):', regularRevenue);
      console.log('🔍 Debug - Authenticator Uploads revenue (excluded from total):', authenticatorRevenue);
```

**Lógica:**
1. **`regularRevenue`**: Soma todos os pagamentos com `status === 'completed'` da tabela `payments`
2. **`authenticatorRevenue`**: Calcula separadamente a receita de documentos de autenticadores (apenas para relatórios, não incluída no total)
3. **`totalRevenue`**: Usa apenas `regularRevenue` (exclui automaticamente valores de autenticadores)

**Observação:** O `authenticatorRevenue` é calculado separadamente para fins de relatórios e breakdowns, mas **não é incluído no `totalRevenue`**.

---

## 📊 Implementação no Overview Context

**Arquivo:** `src/contexts/OverviewContext.tsx`

No contexto de overview (usado em outras partes da aplicação), a mesma lógica é aplicada:

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

**Lógica:**
- Filtra apenas pagamentos com `status === 'completed'`
- Soma os valores desses pagamentos
- Atribui ao `totalValue` (Total Revenue)

---

## 🔑 Pontos-Chave da Implementação

### 1. Fonte de Dados: Tabela `payments`

Todos os cálculos de Total Revenue utilizam a tabela `payments` como fonte principal, não a tabela `documents`. Isso garante que:
- Apenas pagamentos realmente processados sejam contabilizados
- Valores de autenticadores (que não geram pagamentos) sejam automaticamente excluídos

### 2. Filtro por Status: `completed` apenas

Apenas pagamentos com `status === 'completed'` são considerados:
- ✅ `completed`: Incluído no Total Revenue
- ❌ `pending`: Excluído (não foi pago)
- ❌ `cancelled`: Excluído (foi cancelado)
- ❌ `refunded`: Excluído (foi reembolsado)

### 3. Exclusão Explícita de Autenticadores

Em alguns lugares (como `DocumentsTable`), há uma verificação explícita:
```typescript
const isAuthenticator = (doc.user_role || 'user') === 'authenticator';
if (isAuthenticator) {
  return sum; // Não soma
}
```

### 4. Exclusão de Documentos de Uso Pessoal

Além de excluir autenticadores, também são excluídos documentos com `is_internal_use === true`:
```typescript
.filter(d => !d.is_internal_use)
```

---

## 📈 Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────┐
│                    TABELA: payments                          │
│                                                               │
│  ┌─────────────┬──────────────┬─────────┬─────────────────┐ │
│  │ document_id │    amount    │ status  │    user_id      │ │
│  ├─────────────┼──────────────┼─────────┼─────────────────┤ │
│  │   doc_123   │    100.00    │completed│   user_001      │ │ ✅ Incluído
│  │   doc_456   │     50.00    │pending  │   user_002      │ │ ❌ Excluído
│  │   doc_789   │     75.00    │completed│   user_003      │ │ ✅ Incluído
│  └─────────────┴──────────────┴─────────┴─────────────────┘ │
│                                                               │
│  ⚠️  Autenticadores NÃO têm registros aqui                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  FILTRO: status  │
                    │   === 'completed'│
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  SOMA: amount    │
                    │  de todos os     │
                    │  pagamentos      │
                    │  completados     │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  TOTAL REVENUE   │
                    │  (sem valores    │
                    │  de autenticador)│
                    └──────────────────┘
```

---

## 🧪 Validação e Logs

Ambos os dashboards incluem logs detalhados para validação:

### Admin Dashboard
```typescript
console.log('🔍 ADMIN DASHBOARD - Total completed payments:', completedPayments.length);
console.log('🔍 ADMIN DASHBOARD - Total revenue (sum of all completed):', userRev.toFixed(2));
```

### Finance Dashboard
```typescript
console.log('🔍 FINANCE DASHBOARD - All completed payments:', allCompletedPayments.length);
console.log('🔍 FINANCE DASHBOARD - Regular revenue (all completed, no role filter):', regularRevenue.toFixed(2));
console.log('🔍 Debug - Authenticator Uploads revenue (excluded from total):', authenticatorRevenue);
```

### DocumentsTable
```typescript
console.log('[DocumentsTable] Users paid sum (status=completed only):', userSum.toFixed(2));
console.log('[DocumentsTable] Total (only completed payments):', total.toFixed(2));
```

---

## ✅ Resumo da Lógica

| Componente | Fonte de Dados | Filtro Principal | Exclusão de Autenticadores |
|------------|----------------|-------------------|----------------------------|
| **Admin Dashboard - StatsCards** | `payments` | `status === 'completed'` | Automática (não há pagamentos de autenticadores) |
| **Admin Dashboard - DocumentsTable** | `documents` + `payments` | `status === 'completed'` + verificação de role | Explícita (`if (isAuthenticator) return sum`) |
| **Finance Dashboard - StatsCards** | `payments` | `status === 'completed'` | Automática (não há pagamentos de autenticadores) |
| **Overview Context** | `payments` | `status === 'completed'` | Automática (não há pagamentos de autenticadores) |

---

## 🎯 Conclusão

A exclusão dos valores de autenticadores do Total Revenue é garantida através de:

1. **Uso da tabela `payments`** como fonte principal (autenticadores não têm pagamentos)
2. **Filtro por status `completed`** (apenas pagamentos realmente pagos)
3. **Verificação explícita de role** em alguns componentes (camada extra de segurança)
4. **Exclusão de documentos de uso pessoal** (`is_internal_use === true`)

Essa abordagem garante que o Total Revenue reflita apenas a receita real da empresa, excluindo valores internos e não pagos de autenticadores.









