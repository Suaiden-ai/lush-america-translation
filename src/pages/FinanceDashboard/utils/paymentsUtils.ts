/**
 * Retorna classes CSS para cores de status de pagamento/documento
 */
export function getStatusColor(status: string | null): string {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    case 'refunded':
      return 'bg-gray-200 text-gray-800';
    case 'processing': // For document status
    case 'draft': // For document status
      return 'bg-blue-100 text-blue-800';
    case 'deleted': // For document status
      return 'bg-red-200 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Formata método de pagamento para exibição
 */
export function formatPaymentMethod(paymentMethod: string | null): string {
  if (!paymentMethod) return 'N/A';
  
  const methodMap: Record<string, string> = {
    'card': '💳 Card',
    'stripe': '💳 Stripe',
    'bank_transfer': '🏦 Bank',
    'transfer': '🏦 Bank',
    'zelle': '💰 Zelle',
    'cash': '💵 Cash',
    'paypal': '📱 PayPal',
    'upload': '📋 Upload',
    'other': '🔧 Other'
  };
  
  return methodMap[paymentMethod] || paymentMethod;
}

/**
 * Formata data de forma segura
 */
export function formatDate(dateValue: string | Date | null | undefined): string {
  if (!dateValue) return '-';
  try {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit',
      year: 'numeric'
    });
  } catch (error) {
    console.warn('Erro ao formatar data:', dateValue, error);
    return '-';
  }
}

/**
 * Formata data com hora para exibição completa
 */
export function formatDateTime(dateValue: string | Date | null | undefined): string {
  if (!dateValue) return '';
  try {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString('pt-BR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.warn('Erro ao formatar data/hora:', dateValue, error);
    return '';
  }
}

/**
 * Garante valores numéricos válidos
 */
export function safeNumber(value: any, defaultValue: number = 0): number {
  if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
    return value;
  }
  return defaultValue;
}
