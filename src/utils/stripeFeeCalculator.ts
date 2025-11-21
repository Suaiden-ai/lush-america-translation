/**
 * Calculadora de Taxas do Stripe (Frontend)
 * 
 * Implementa o sistema de markup de taxas que garante que o valor líquido desejado
 * seja sempre recebido, mesmo após as taxas do Stripe.
 * 
 * Para pagamentos com cartão (USD):
 * - Taxa Percentual: 3.9% (taxa conservadora para cartões internacionais)
 * - Taxa Fixa: $0.30 por transação
 * - Fórmula: grossAmount = (netAmount + STRIPE_FIXED_FEE) / (1 - STRIPE_PERCENTAGE)
 */

// Constantes para taxas do Stripe (Cartão USD)
const STRIPE_PERCENTAGE = 0.039; // 3.9% - taxa conservadora para cartões internacionais
const STRIPE_FIXED_FEE = 0.30;   // $0.30 por transação

/**
 * Calcula o valor bruto (gross amount) que deve ser cobrado do cliente
 * para garantir que o valor líquido desejado seja recebido após as taxas do Stripe.
 * 
 * @param netAmount - Valor líquido desejado em USD (ex: 100.00)
 * @returns Valor bruto em USD (ex: 104.27)
 * 
 * @example
 * // Para receber $100.00 líquido:
 * const grossAmount = calculateCardAmountWithFees(100.00);
 * // Retorna: 104.27
 * // Após taxas do Stripe: $104.27 - $4.27 = $100.00 ✅
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

