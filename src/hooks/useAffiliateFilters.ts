import { useState, useMemo } from 'react';

export interface Affiliate {
  affiliate_id: string;
  user_name: string;
  user_email: string;
  referral_code: string;
  current_level: number;
  available_balance: number;
  created_at: string;
  total_clients: number;
  total_pages: number;
  total_earned: number;
  [key: string]: any;
}

export interface Withdrawal {
  request_id: string;
  affiliate_name: string;
  affiliate_email: string;
  payment_method: string;
  status: string;
  amount: number;
  requested_at: string;
  [key: string]: any;
}

export interface FilterState {
  searchTerm: string;
  levelFilter: string;
  balanceFilter: string;
  dateFilter: string;
  withdrawalSearchTerm: string;
}

/**
 * Hook para gerenciar filtros de afiliados e saques
 */
export const useAffiliateFilters = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [balanceFilter, setBalanceFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [withdrawalSearchTerm, setWithdrawalSearchTerm] = useState('');

  /**
   * Filtra afiliados baseado nos critérios selecionados
   */
  const filterAffiliates = (affiliates: Affiliate[]): Affiliate[] => {
    return affiliates.filter(affiliate => {
      // Search filter
      const matchesSearch = affiliate.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           affiliate.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           affiliate.referral_code.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Level filter
      const matchesLevel = levelFilter === 'all' || affiliate.current_level.toString() === levelFilter;
      
      // Balance filter
      let matchesBalance = true;
      if (balanceFilter === 'high') {
        matchesBalance = affiliate.available_balance >= 100;
      } else if (balanceFilter === 'medium') {
        matchesBalance = affiliate.available_balance >= 10 && affiliate.available_balance < 100;
      } else if (balanceFilter === 'low') {
        matchesBalance = affiliate.available_balance < 10;
      }
      
      // Date filter
      let matchesDate = true;
      if (dateFilter === 'recent') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        matchesDate = new Date(affiliate.created_at) >= thirtyDaysAgo;
      } else if (dateFilter === 'old') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        matchesDate = new Date(affiliate.created_at) < thirtyDaysAgo;
      }
      
      return matchesSearch && matchesLevel && matchesBalance && matchesDate;
    });
  };

  /**
   * Filtra saques baseado no termo de busca
   */
  const filterWithdrawals = (withdrawals: Withdrawal[]): Withdrawal[] => {
    const searchTerm = withdrawalSearchTerm.toLowerCase();
    
    return withdrawals.filter(withdrawal => 
      withdrawal.affiliate_name.toLowerCase().includes(searchTerm) ||
      withdrawal.affiliate_email.toLowerCase().includes(searchTerm) ||
      withdrawal.payment_method.toLowerCase().includes(searchTerm) ||
      withdrawal.status.toLowerCase().includes(searchTerm) ||
      withdrawal.amount.toString().includes(withdrawalSearchTerm)
    );
  };

  /**
   * Limpa todos os filtros
   */
  const clearFilters = () => {
    setSearchTerm('');
    setLevelFilter('all');
    setBalanceFilter('all');
    setDateFilter('all');
    setWithdrawalSearchTerm('');
  };

  /**
   * Reseta apenas filtros de afiliados
   */
  const clearAffiliateFilters = () => {
    setSearchTerm('');
    setLevelFilter('all');
    setBalanceFilter('all');
    setDateFilter('all');
  };

  /**
   * Reseta apenas filtro de saques
   */
  const clearWithdrawalFilters = () => {
    setWithdrawalSearchTerm('');
  };

  return {
    // Estados
    searchTerm,
    setSearchTerm,
    levelFilter,
    setLevelFilter,
    balanceFilter,
    setBalanceFilter,
    dateFilter,
    setDateFilter,
    withdrawalSearchTerm,
    setWithdrawalSearchTerm,
    
    // Funções de filtro
    filterAffiliates,
    filterWithdrawals,
    
    // Funções de limpeza
    clearFilters,
    clearAffiliateFilters,
    clearWithdrawalFilters
  };
};
