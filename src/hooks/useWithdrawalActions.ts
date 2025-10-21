import { useState } from 'react';

export type WithdrawalAction = 'approve' | 'reject' | 'complete';

export interface WithdrawalActionParams {
  requestId: string;
  action: WithdrawalAction;
  notes?: string;
}

/**
 * Hook para gerenciar ações de saque
 */
export const useWithdrawalActions = (
  updateWithdrawalRequest: (requestId: string, status: string, notes?: string) => Promise<void>,
  fetchPendingWithdrawals: () => Promise<void>
) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Executa ação em uma solicitação de saque
   */
  const handleWithdrawalAction = async ({ requestId, action, notes }: WithdrawalActionParams) => {
    setIsProcessing(true);
    setError(null);
    
    try {
      let status = '';
      switch (action) {
        case 'approve':
          status = 'approved';
          break;
        case 'reject':
          status = 'rejected';
          break;
        case 'complete':
          status = 'completed';
          break;
      }
      
      await updateWithdrawalRequest(requestId, status, notes);
      await fetchPendingWithdrawals();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error updating withdrawal request';
      console.error('Error updating withdrawal request:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Aprova uma solicitação de saque
   */
  const approveWithdrawal = async (requestId: string, notes?: string) => {
    return handleWithdrawalAction({ requestId, action: 'approve', notes });
  };

  /**
   * Rejeita uma solicitação de saque
   */
  const rejectWithdrawal = async (requestId: string, notes?: string) => {
    return handleWithdrawalAction({ requestId, action: 'reject', notes });
  };

  /**
   * Marca uma solicitação de saque como completa
   */
  const completeWithdrawal = async (requestId: string, notes?: string) => {
    return handleWithdrawalAction({ requestId, action: 'complete', notes });
  };

  /**
   * Limpa o erro atual
   */
  const clearError = () => {
    setError(null);
  };

  return {
    isProcessing,
    error,
    handleWithdrawalAction,
    approveWithdrawal,
    rejectWithdrawal,
    completeWithdrawal,
    clearError
  };
};
