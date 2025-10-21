/**
 * Utilitários de formatação para dados de afiliados
 */

export interface PaymentDetails {
  email?: string;
  phone?: string;
  bank_name?: string;
  account_holder?: string;
}

/**
 * Formata detalhes de pagamento baseado no método de pagamento
 */
export const formatPaymentDetails = (paymentMethod: string, paymentDetails: PaymentDetails | null): string => {
  if (!paymentDetails) return 'No details provided';
  
  switch (paymentMethod) {
    case 'zelle':
      if (paymentDetails.email) {
        return `Email: ${paymentDetails.email}`;
      } else if (paymentDetails.phone) {
        return `Phone: ${paymentDetails.phone}`;
      } else {
        return 'Zelle details not provided';
      }
    case 'bank_transfer':
      if (paymentDetails.bank_name && paymentDetails.account_holder) {
        return `${paymentDetails.bank_name} - ${paymentDetails.account_holder}`;
      } else if (paymentDetails.bank_name) {
        return paymentDetails.bank_name;
      } else {
        return 'Bank details not provided';
      }
    case 'stripe':
      if (paymentDetails.email) {
        return `Email: ${paymentDetails.email}`;
      } else {
        return 'Stripe details not provided';
      }
    default:
      return 'Payment details available';
  }
};

/**
 * Formata valor monetário
 */
export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

/**
 * Formata data para exibição
 */
export const formatDisplayDate = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Formata data e hora para exibição
 */
export const formatDisplayDateTime = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
