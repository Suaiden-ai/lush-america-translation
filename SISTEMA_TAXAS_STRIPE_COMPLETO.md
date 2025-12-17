# Sistema de Taxas do Stripe - Documentação Completa

## 📋 Visão Geral

O sistema implementa um **markup de taxas** que garante que o valor líquido desejado seja sempre recebido, mesmo após as taxas do Stripe. As taxas são **passadas para o cliente**, ou seja, o cliente paga o valor base + taxa de processamento.

### Conceito Principal

**Antes (sem markup):**
- Cliente paga: $100.00
- Stripe cobra: $3.90 + $0.30 = $4.20
- Você recebe: $95.80 ❌ (menos que o desejado)

**Depois (com markup):**
- Você quer receber: $100.00 (valor líquido)
- Sistema calcula: $104.27 (valor bruto com markup)
- Cliente paga: $104.27
- Stripe cobra: $4.07 + $0.30 = $4.27
- Você recebe: $100.00 ✅ (exatamente o desejado)

---

## 🧮 Fórmula Matemática

### Taxas do Stripe (Cartão USD)

- **Taxa Percentual:** 3.9% (taxa conservadora para cartões internacionais)
- **Taxa Fixa:** $0.30 por transação

### Fórmula de Cálculo

#### 1. Calcular Valor Bruto (com markup)

```
grossAmount = (netAmount + STRIPE_FIXED_FEE) / (1 - STRIPE_PERCENTAGE)
```

**Onde:**
- `netAmount` = Valor líquido desejado (ex: $100.00)
- `STRIPE_FIXED_FEE` = $0.30
- `STRIPE_PERCENTAGE` = 0.039 (3.9%)

**Exemplo:**
```
grossAmount = ($100.00 + $0.30) / (1 - 0.039)
grossAmount = $100.30 / 0.961
grossAmount = $104.27
```

#### 2. Calcular Taxa do Stripe

```
feeAmount = (grossAmount × STRIPE_PERCENTAGE) + STRIPE_FIXED_FEE
```

**Exemplo:**
```
feeAmount = ($104.27 × 0.039) + $0.30
feeAmount = $4.07 + $0.30
feeAmount = $4.27
```

#### 3. Validar Valor Líquido

```
netAmount = grossAmount - feeAmount
```

**Exemplo:**
```
netAmount = $104.27 - $4.27
netAmount = $100.00 ✅
```

---

## 💻 Implementação Backend (Edge Functions)

### Arquivo: `supabase/functions/shared/stripe-fee-calculator.ts`

```typescript
// Constantes para taxas do Stripe (Cartão USD)
const STRIPE_PERCENTAGE = 0.039; // 3.9%
const STRIPE_FIXED_FEE = 0.30;   // $0.30

/**
 * Calcula o valor bruto (gross amount) que deve ser cobrado do cliente
 * para garantir que o valor líquido desejado seja recebido após as taxas do Stripe.
 * 
 * @param netAmount - Valor líquido desejado em USD (ex: 100.00)
 * @returns Valor bruto em centavos (ex: 10427 = $104.27)
 */
export function calculateCardAmountWithFees(netAmount: number): number {
  // Validar entrada
  if (netAmount <= 0) {
    throw new Error('Valor líquido deve ser maior que zero');
  }

  // Fórmula: (Valor líquido + Taxa fixa) / (1 - Taxa percentual)
  const grossAmount = (netAmount + STRIPE_FIXED_FEE) / (1 - STRIPE_PERCENTAGE);

  // Arredondar para 2 casas decimais e converter para centavos
  const grossAmountRounded = Math.round(grossAmount * 100) / 100;
  const grossAmountInCents = Math.round(grossAmountRounded * 100);

  return grossAmountInCents;
}

/**
 * Calcula o valor da taxa do Stripe baseado no valor bruto cobrado.
 * 
 * @param grossAmount - Valor bruto em USD (ex: 104.27)
 * @returns Valor da taxa em USD (ex: 4.27)
 */
export function calculateCardFee(grossAmount: number): number {
  // Taxa = (Valor bruto × Taxa percentual) + Taxa fixa
  const feeAmount = (grossAmount * STRIPE_PERCENTAGE) + STRIPE_FIXED_FEE;
  
  // Arredondar para 2 casas decimais
  return Math.round(feeAmount * 100) / 100;
}

/**
 * Valida se o valor líquido recebido após as taxas está correto.
 * 
 * @param grossAmount - Valor bruto cobrado em USD
 * @param expectedNetAmount - Valor líquido esperado em USD
 * @returns true se o valor líquido está correto (com tolerância de 1 centavo)
 */
export function validateNetAmount(grossAmount: number, expectedNetAmount: number): boolean {
  const actualFee = calculateCardFee(grossAmount);
  const actualNetAmount = grossAmount - actualFee;
  const difference = Math.abs(actualNetAmount - expectedNetAmount);
  
  // Tolerância de 1 centavo para arredondamentos
  return difference <= 0.01;
}
```

### Uso na Edge Function: `create-checkout-session`

**Arquivo:** `supabase/functions/create-checkout-session/index.ts`

```typescript
// Calcular preço base (valor líquido desejado)
const basePrice = calculatePrice(pages, isBankStatement);

// Calcular valor bruto com markup de taxas do Stripe
const grossAmountInCents = calculateCardAmountWithFees(basePrice);
const grossAmount = grossAmountInCents / 100; // Converter centavos para dólares
const feeAmount = calculateCardFee(grossAmount);
const totalPrice = grossAmount; // Valor bruto a ser cobrado

console.log('DEBUG: Preço base (líquido):', basePrice);
console.log('DEBUG: Valor bruto (com taxas):', totalPrice);
console.log('DEBUG: Taxa do Stripe:', feeAmount);
console.log('DEBUG: Valor líquido esperado:', basePrice);

// Criar sessão de Checkout do Stripe
const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card'],
  customer_email: userEmail,
  line_items: [
    {
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'Document Translation',
          description: serviceDescription,
        },
        unit_amount: grossAmountInCents, // Stripe usa centavos (já calculado com markup)
      },
      quantity: 1,
    },
  ],
  mode: 'payment',
  success_url: `${req.headers.get('origin')}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${req.headers.get('origin')}/payment-cancelled?document_id=${documentId || ''}`,
  metadata: {
    // ... outros metadados ...
    // Valores com markup de taxas
    base_amount: basePrice.toString(),           // Valor líquido desejado
    gross_amount: grossAmount.toFixed(2),        // Valor bruto cobrado
    fee_amount: feeAmount.toFixed(2),            // Taxa do Stripe
    markup_enabled: 'true',                      // Indica que markup foi aplicado
    totalPrice: totalPrice.toFixed(2),           // Valor bruto (mantido para compatibilidade)
  },
});
```

### Salvamento na Tabela `stripe_sessions`

```typescript
const { error: insertError } = await supabaseClient
  .from('stripe_sessions')
  .insert({
    session_id: session.id,
    document_id: documentId || null,
    user_id: userId,
    metadata: metadataToSave,
    payment_status: 'pending',
    amount: totalPrice,
    base_amount: basePrice,      // Valor líquido desejado
    gross_amount: grossAmount,   // Valor bruto cobrado
    fee_amount: feeAmount,       // Taxa do Stripe
    currency: 'usd'
  });
```

---

## 🎨 Implementação Frontend

### Arquivo: `src/utils/stripeFeeCalculator.ts`

```typescript
// Constantes para taxas do Stripe (Cartão USD)
const STRIPE_PERCENTAGE = 0.039; // 3.9%
const STRIPE_FIXED_FEE = 0.30;   // $0.30

/**
 * Calcula o valor bruto (gross amount) que deve ser cobrado do cliente
 * para garantir que o valor líquido desejado seja recebido após as taxas do Stripe.
 * 
 * @param netAmount - Valor líquido desejado em USD (ex: 100.00)
 * @returns Valor bruto em USD (ex: 104.27)
 */
export function calculateCardAmountWithFees(netAmount: number): number {
  // Validar entrada
  if (netAmount <= 0) {
    throw new Error('Valor líquido deve ser maior que zero');
  }

  // Fórmula: (Valor líquido + Taxa fixa) / (1 - Taxa percentual)
  const grossAmount = (netAmount + STRIPE_FIXED_FEE) / (1 - STRIPE_PERCENTAGE);

  // Arredondar para 2 casas decimais
  const grossAmountRounded = Math.round(grossAmount * 100) / 100;

  return grossAmountRounded;
}

/**
 * Calcula o valor da taxa do Stripe baseado no valor bruto cobrado.
 * 
 * @param grossAmount - Valor bruto em USD (ex: 104.27)
 * @returns Valor da taxa em USD (ex: 4.27)
 */
export function calculateCardFee(grossAmount: number): number {
  // Taxa = (Valor bruto × Taxa percentual) + Taxa fixa
  const feeAmount = (grossAmount * STRIPE_PERCENTAGE) + STRIPE_FIXED_FEE;
  
  // Arredondar para 2 casas decimais
  return Math.round(feeAmount * 100) / 100;
}

/**
 * Formata o valor para exibição com 2 casas decimais
 * 
 * @param amount - Valor em USD
 * @returns String formatada (ex: "104.27")
 */
export function formatAmount(amount: number): string {
  return amount.toFixed(2);
}
```

### Componente: `PaymentMethodModal`

**Arquivo:** `src/components/PaymentMethodModal.tsx`

```typescript
import { calculateCardAmountWithFees, calculateCardFee, formatAmount } from '../utils/stripeFeeCalculator';

export function PaymentMethodModal({ 
  amount, // Valor base (líquido desejado)
  // ... outros props
}: PaymentMethodModalProps) {
  // Calcular valor com taxa do Stripe
  const stripeAmount = calculateCardAmountWithFees(amount);
  const stripeFee = calculateCardFee(stripeAmount);

  return (
    <div>
      {/* Stripe Option */}
      <button onClick={onSelectStripe}>
        <div className="flex items-center space-x-4">
          <div className="flex-1 text-left">
            <div className="flex items-center justify-between mb-1">
              <h3>Stripe</h3>
              <span className="text-sm font-semibold text-blue-600">
                ${formatAmount(stripeAmount)}
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-1">
              Base: ${formatAmount(amount)} + Processing fee: ${formatAmount(stripeFee)}
            </p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-green-600 font-medium">✓ Instant processing</p>
            </div>
          </div>
        </div>
      </button>

      {/* Zelle Option - SEM taxa */}
      <button onClick={() => onSelectZelle(amount, documentId, filename, pages)}>
        <div className="flex-1 text-left">
          <h3>Zelle</h3>
          <p className="text-sm text-gray-600">Direct bank transfer via email/phone</p>
          {/* Zelle não tem taxa, mostra valor base */}
        </div>
      </button>
    </div>
  );
}
```

**Exibição:**
- **Stripe:** Mostra valor total com taxa (`$104.27`) e breakdown (`Base: $100.00 + Processing fee: $4.27`)
- **Zelle:** Mostra apenas valor base (`$100.00`) - sem taxa

---

## 🗄️ Estrutura do Banco de Dados

### Migration: Adicionar Campos de Taxa

**Arquivo:** `supabase/migrations/20250131000000_add_payment_fee_fields.sql`

```sql
-- Migration: Add payment fee fields to payments table
-- This migration adds fields to store Stripe processing fees information

-- Add fee-related columns to payments table
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS base_amount numeric(10,2),
ADD COLUMN IF NOT EXISTS gross_amount numeric(10,2),
ADD COLUMN IF NOT EXISTS fee_amount numeric(10,2);

-- Add comments to document the new columns
COMMENT ON COLUMN payments.base_amount IS 'Base amount (net amount desired) before processing fees';
COMMENT ON COLUMN payments.gross_amount IS 'Gross amount (total amount charged to customer) including processing fees';
COMMENT ON COLUMN payments.fee_amount IS 'Processing fee amount paid by the customer';

-- Create index for fee_amount to enable fee analysis queries
CREATE INDEX IF NOT EXISTS idx_payments_fee_amount ON payments(fee_amount);
```

### Campos Explicados

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `base_amount` | numeric(10,2) | Valor líquido desejado (antes das taxas) |
| `gross_amount` | numeric(10,2) | Valor bruto cobrado do cliente (com taxas) |
| `fee_amount` | numeric(10,2) | Valor da taxa de processamento paga pelo cliente |

### Relação entre Campos

```
base_amount + fee_amount = gross_amount
gross_amount - fee_amount = base_amount
```

**Exemplo:**
- `base_amount`: $100.00
- `fee_amount`: $4.27
- `gross_amount`: $104.27

---

## 🔄 Fluxo Completo

### 1. Cliente Seleciona Método de Pagamento

```
┌─────────────────────────────────────────┐
│  PaymentMethodModal                      │
│                                         │
│  Valor Base: $100.00                    │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ Stripe                             │ │
│  │ Total: $104.27                     │ │
│  │ Base: $100.00 + Fee: $4.27         │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ Zelle                              │ │
│  │ Total: $100.00 (sem taxa)          │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 2. Cliente Escolhe Stripe

```
Frontend:
  amount = $100.00 (valor base)
  stripeAmount = calculateCardAmountWithFees($100.00) = $104.27
  stripeFee = calculateCardFee($104.27) = $4.27
  
  → Mostra: "Base: $100.00 + Processing fee: $4.27"
  → Total: $104.27
```

### 3. Criação da Sessão de Checkout

```
Edge Function (create-checkout-session):
  1. Recebe: basePrice = $100.00
  2. Calcula: grossAmountInCents = calculateCardAmountWithFees($100.00) = 10427
  3. Calcula: feeAmount = calculateCardFee($104.27) = $4.27
  4. Cria sessão Stripe com unit_amount = 10427 (centavos)
  5. Salva em metadata:
     - base_amount: "100.00"
     - gross_amount: "104.27"
     - fee_amount: "4.27"
     - markup_enabled: "true"
  6. Salva em stripe_sessions:
     - base_amount: 100.00
     - gross_amount: 104.27
     - fee_amount: 4.27
```

### 4. Cliente Paga no Stripe

```
Stripe Checkout:
  Cliente vê: $104.27
  Cliente paga: $104.27
  Stripe processa: $104.27
  Stripe cobra taxa: ~$4.27
  Stripe transfere: ~$100.00 ✅
```

### 5. Webhook Processa Pagamento

```
Edge Function (stripe-webhook):
  1. Recebe evento: checkout.session.completed
  2. Extrai metadata:
     - base_amount: "100.00"
     - gross_amount: "104.27"
     - fee_amount: "4.27"
  3. Cria registro em payments:
     {
       amount: 100.00,        // Valor líquido (receita real)
       base_amount: 100.00,  // Valor base
       gross_amount: 104.27, // Valor bruto cobrado
       fee_amount: 4.27,     // Taxa paga pelo cliente
       status: 'completed',
       payment_method: 'card'
     }
  4. Atualiza documento para 'processing'
```

---

## 💾 Salvamento no Banco de Dados

### Tabela: `payments`

**Arquivo:** `supabase/functions/stripe-webhook/index.ts`

```typescript
// Extrair valores dos metadados
const {
  base_amount,
  gross_amount,
  fee_amount,
  // ... outros campos
} = session.metadata;

// Converter para números
const baseAmount = base_amount ? parseFloat(base_amount) : 0;
const grossAmount = gross_amount ? parseFloat(gross_amount) : 0;
const feeAmount = fee_amount ? parseFloat(fee_amount) : 0;

// Criar registro na tabela payments
const paymentData = {
  document_id: documentId,
  user_id: userId,
  stripe_session_id: session.id,
  amount: baseAmount,        // Valor líquido (receita real)
  base_amount: baseAmount,   // Valor base (líquido desejado)
  gross_amount: grossAmount, // Valor bruto cobrado
  fee_amount: feeAmount,    // Taxa do Stripe paga pelo usuário
  currency: 'USD',
  status: 'completed',
  payment_method: 'card',
  payment_date: new Date().toISOString()
};

const { data: paymentRecord, error: paymentError } = await supabase
  .from('payments')
  .insert(paymentData)
  .select()
  .single();
```

### Importante: Campo `amount`

O campo `amount` na tabela `payments` armazena o **valor líquido** (`base_amount`), não o valor bruto. Isso é importante porque:

- ✅ **Total Revenue** usa `amount` (valor líquido recebido)
- ✅ Reflete receita real da empresa
- ✅ Taxas já foram pagas pelo cliente

---

## 📊 Exemplos Práticos

### Exemplo 1: Documento de 5 páginas

**Cálculo:**
```
basePrice = 5 páginas × $20 = $100.00
grossAmount = ($100.00 + $0.30) / (1 - 0.039) = $104.27
feeAmount = ($104.27 × 0.039) + $0.30 = $4.27
```

**Cliente vê:**
- Base: $100.00
- Processing fee: $4.27
- **Total: $104.27**

**Banco de dados:**
```json
{
  "amount": 100.00,      // Receita real
  "base_amount": 100.00,
  "gross_amount": 104.27,
  "fee_amount": 4.27
}
```

### Exemplo 2: Documento de 10 páginas

**Cálculo:**
```
basePrice = 10 páginas × $20 = $200.00
grossAmount = ($200.00 + $0.30) / (1 - 0.039) = $208.54
feeAmount = ($208.54 × 0.039) + $0.30 = $8.43
```

**Cliente vê:**
- Base: $200.00
- Processing fee: $8.43
- **Total: $208.54**

**Banco de dados:**
```json
{
  "amount": 200.00,
  "base_amount": 200.00,
  "gross_amount": 208.54,
  "fee_amount": 8.43
}
```

### Exemplo 3: Documento de 1 página

**Cálculo:**
```
basePrice = 1 página × $20 = $20.00
grossAmount = ($20.00 + $0.30) / (1 - 0.039) = $21.18
feeAmount = ($21.18 × 0.039) + $0.30 = $1.13
```

**Cliente vê:**
- Base: $20.00
- Processing fee: $1.13
- **Total: $21.18**

**Banco de dados:**
```json
{
  "amount": 20.00,
  "base_amount": 20.00,
  "gross_amount": 21.18,
  "fee_amount": 1.13
}
```

---

## 🎯 Design Decisions

### 1. Por que markup em vez de absorver taxas?

**Problema:** Se você absorver as taxas, recebe menos que o valor desejado.

**Solução:** Markup garante que você sempre recebe o valor líquido desejado.

**Benefícios:**
- ✅ Receita previsível
- ✅ Cliente paga as taxas (transparência)
- ✅ Margem de lucro preservada

### 2. Por que taxa conservadora de 3.9%?

**Razão:** Cartões internacionais podem ter taxas mais altas.

**Benefícios:**
- ✅ Cobre variações de taxa
- ✅ Protege contra surpresas
- ✅ Margem de segurança

**Nota:** Se suas taxas reais forem menores, você recebe um pouco mais.

### 3. Por que salvar `base_amount`, `gross_amount` e `fee_amount`?

**Razões:**
- ✅ **Transparência:** Cliente pode ver breakdown
- ✅ **Auditoria:** Rastrear taxas pagas
- ✅ **Análise:** Calcular total de taxas coletadas
- ✅ **Relatórios:** Mostrar impacto das taxas

### 4. Por que `amount` = `base_amount`?

**Razão:** `amount` representa receita real da empresa.

**Benefícios:**
- ✅ Total Revenue calculado corretamente
- ✅ Reflete dinheiro realmente recebido
- ✅ Consistente com princípios contábeis

### 5. Por que Zelle não tem taxa?

**Razão:** Zelle é transferência direta entre bancos.

**Benefícios:**
- ✅ Cliente economiza (sem taxa)
- ✅ Incentivo para usar Zelle
- ✅ Processamento manual (1-2 dias)

---

## ✅ Boas Práticas

### 1. Sempre use as funções de cálculo

❌ **Ruim:**
```typescript
const grossAmount = basePrice * 1.039 + 0.30; // Incorreto!
```

✅ **Bom:**
```typescript
const grossAmount = calculateCardAmountWithFees(basePrice);
```

### 2. Sempre arredonde para 2 casas decimais

❌ **Ruim:**
```typescript
const fee = grossAmount * 0.039 + 0.30; // Pode ter muitas casas
```

✅ **Bom:**
```typescript
const fee = calculateCardFee(grossAmount); // Já arredonda
```

### 3. Sempre salve todos os três valores

❌ **Ruim:**
```typescript
{
  amount: grossAmount, // Errado! Deve ser baseAmount
  fee_amount: feeAmount
}
```

✅ **Bom:**
```typescript
{
  amount: baseAmount,      // Valor líquido (receita)
  base_amount: baseAmount, // Valor base
  gross_amount: grossAmount, // Valor bruto
  fee_amount: feeAmount    // Taxa
}
```

### 4. Sempre mostre breakdown para o cliente

❌ **Ruim:**
```typescript
<p>Total: ${grossAmount}</p> // Cliente não sabe o que está pagando
```

✅ **Bom:**
```typescript
<p>Base: ${baseAmount} + Processing fee: ${feeAmount}</p>
<p>Total: ${grossAmount}</p>
```

### 5. Sempre valide valores antes de salvar

✅ **Bom:**
```typescript
if (baseAmount <= 0 || grossAmount <= 0 || feeAmount < 0) {
  throw new Error('Valores inválidos');
}

// Validar que a matemática está correta
const expectedFee = calculateCardFee(grossAmount);
if (Math.abs(expectedFee - feeAmount) > 0.01) {
  throw new Error('Taxa calculada não corresponde');
}
```

---

## 🚀 Guia de Implementação Passo a Passo

### Passo 1: Criar Migration

1. Criar arquivo: `supabase/migrations/YYYYMMDDHHMMSS_add_payment_fee_fields.sql`
2. Copiar SQL da migration
3. Executar migration

### Passo 2: Criar Calculadora Backend

1. Criar arquivo: `supabase/functions/shared/stripe-fee-calculator.ts`
2. Implementar funções:
   - `calculateCardAmountWithFees()`
   - `calculateCardFee()`
   - `validateNetAmount()`
3. Testar com valores conhecidos

### Passo 3: Criar Calculadora Frontend

1. Criar arquivo: `src/utils/stripeFeeCalculator.ts`
2. Implementar mesmas funções (sem conversão para centavos)
3. Adicionar `formatAmount()` para exibição

### Passo 4: Atualizar Edge Function de Checkout

1. Importar `calculateCardAmountWithFees` e `calculateCardFee`
2. Calcular `grossAmount` e `feeAmount` antes de criar sessão
3. Adicionar valores em `metadata` da sessão
4. Salvar em `stripe_sessions` com campos de taxa

### Passo 5: Atualizar Webhook

1. Extrair `base_amount`, `gross_amount`, `fee_amount` dos metadados
2. Salvar todos os três valores na tabela `payments`
3. Usar `base_amount` como `amount` (receita real)

### Passo 6: Atualizar Componentes Frontend

1. Atualizar `PaymentMethodModal` para mostrar breakdown
2. Calcular e exibir taxa do Stripe
3. Mostrar valor total com taxa
4. Manter Zelle sem taxa

### Passo 7: Testar

1. Testar cálculo com diferentes valores
2. Testar criação de sessão
3. Testar webhook e salvamento
4. Verificar que valores estão corretos no banco

---

## 📊 Queries Úteis

### Total de Taxas Coletadas

```sql
SELECT 
  SUM(fee_amount) as total_fees_collected,
  COUNT(*) as total_payments,
  AVG(fee_amount) as avg_fee_per_payment
FROM payments
WHERE payment_method = 'card'
  AND status = 'completed'
  AND fee_amount IS NOT NULL;
```

### Receita vs. Taxas

```sql
SELECT 
  SUM(amount) as total_revenue,        -- Receita líquida
  SUM(gross_amount) as total_charged,   -- Total cobrado
  SUM(fee_amount) as total_fees        -- Total de taxas
FROM payments
WHERE payment_method = 'card'
  AND status = 'completed';
```

### Taxa Média por Valor

```sql
SELECT 
  CASE 
    WHEN base_amount < 50 THEN '0-50'
    WHEN base_amount < 100 THEN '50-100'
    WHEN base_amount < 200 THEN '100-200'
    ELSE '200+'
  END as amount_range,
  COUNT(*) as payments,
  AVG(fee_amount) as avg_fee,
  AVG(fee_amount / gross_amount * 100) as avg_fee_percentage
FROM payments
WHERE payment_method = 'card'
  AND status = 'completed'
GROUP BY amount_range
ORDER BY amount_range;
```

### Comparação Stripe vs. Zelle

```sql
SELECT 
  payment_method,
  COUNT(*) as total_payments,
  SUM(amount) as total_revenue,
  AVG(amount) as avg_payment,
  SUM(COALESCE(fee_amount, 0)) as total_fees
FROM payments
WHERE status = 'completed'
GROUP BY payment_method;
```

---

## 🔍 Troubleshooting

### Problema: Cliente paga mas recebo menos

**Causa:** Markup não foi aplicado.

**Solução:**
1. Verificar que `calculateCardAmountWithFees()` está sendo chamada
2. Verificar que `grossAmountInCents` está sendo usado no Stripe
3. Verificar logs da Edge Function

### Problema: Taxa calculada está errada

**Causa:** Constantes de taxa incorretas ou arredondamento.

**Solução:**
1. Verificar `STRIPE_PERCENTAGE` e `STRIPE_FIXED_FEE`
2. Verificar arredondamento (2 casas decimais)
3. Usar `validateNetAmount()` para validar

### Problema: Valores não salvam no banco

**Causa:** Migration não executada ou campos não incluídos no INSERT.

**Solução:**
1. Verificar que migration foi executada
2. Verificar que campos estão no `paymentData`
3. Verificar logs do webhook

### Problema: Cliente não vê breakdown

**Causa:** Componente não está calculando/exibindo taxa.

**Solução:**
1. Verificar que `calculateCardFee()` está sendo chamada
2. Verificar que breakdown está sendo exibido
3. Verificar formato de exibição

---

## 📝 Checklist de Implementação

- [ ] Migration criada e executada
- [ ] Campos `base_amount`, `gross_amount`, `fee_amount` adicionados
- [ ] Calculadora backend implementada
- [ ] Calculadora frontend implementada
- [ ] Edge Function de checkout atualizada
- [ ] Webhook atualizado para salvar taxas
- [ ] Componente de seleção de pagamento atualizado
- [ ] Breakdown de taxas exibido para cliente
- [ ] Testes com diferentes valores realizados
- [ ] Validação de valores implementada
- [ ] Logs de debug adicionados
- [ ] Documentação atualizada

---

## 🎯 Resumo

### Conceito

**Markup de taxas:** Cliente paga valor base + taxa de processamento, garantindo que você sempre recebe o valor líquido desejado.

### Fórmula

```
grossAmount = (netAmount + $0.30) / (1 - 0.039)
feeAmount = (grossAmount × 0.039) + $0.30
```

### Implementação

1. **Backend:** Calcula markup antes de criar sessão Stripe
2. **Frontend:** Mostra breakdown (base + taxa = total)
3. **Banco:** Salva `base_amount`, `gross_amount`, `fee_amount`
4. **Webhook:** Extrai e salva valores dos metadados

### Resultado

- ✅ Cliente paga taxas (transparência)
- ✅ Você recebe valor líquido desejado
- ✅ Receita previsível
- ✅ Rastreamento completo de taxas

---

## ✅ Conclusão

O sistema de taxas do Stripe está completamente implementado e funcional. Ele garante que:

1. ✅ Cliente sempre vê breakdown claro (base + taxa)
2. ✅ Você sempre recebe o valor líquido desejado
3. ✅ Taxas são rastreadas e salvas no banco
4. ✅ Total Revenue usa valor líquido (correto)
5. ✅ Zelle não tem taxa (incentivo)

Siga este guia para implementar um sistema idêntico em seu projeto!







