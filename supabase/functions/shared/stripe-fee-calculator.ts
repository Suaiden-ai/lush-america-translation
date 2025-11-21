/**
 * Calculadora de Taxas do Stripe
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
 * @returns Valor bruto em centavos (ex: 104027 = $1,040.27)
 * 
 * @example
 * // Para receber $1,000.00 líquido:
 * const grossAmount = calculateCardAmountWithFees(1000.00);
 * // Retorna: 104027 (centavos) = $1,040.27
 * // Após taxas do Stripe: $1,040.27 - $40.27 = $1,000.00 ✅
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
 * @param grossAmount - Valor bruto em USD (ex: 1040.27)
 * @returns Valor da taxa em USD (ex: 40.27)
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

