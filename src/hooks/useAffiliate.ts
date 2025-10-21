import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface AffiliateStats {
  total_balance: number;
  available_balance: number;
  pending_balance: number;
  next_withdrawal_date: string | null;
  total_earned: number;
  total_clients: number;
  total_pages: number;
  current_level: number;
  referral_code: string;
  pages_to_next_level: number;
  first_page_translated_at: string | null;
}

export interface AffiliateClient {
  client_id: string;
  client_name: string;
  client_email: string;
  registered_at: string;
  total_pages: number;
  total_commission: number;
}

export interface AffiliateCommission {
  id: string;
  client_name: string;
  pages_count: number;
  commission_rate: number;
  commission_amount: number;
  commission_level: number;
  status: string;
  reversal_reason?: string;
  created_at: string;
  reversed_at?: string;
}

export interface WithdrawalRequest {
  request_id: string;
  affiliate_id: string;
  affiliate_name: string;
  affiliate_email: string;
  amount: number;
  payment_method: string;
  payment_details: {
    email?: string;
    phone?: string;
    bank_name?: string;
    account_number?: string;
    account_holder?: string;
    routing_number?: string;
    [key: string]: any;
  };
  status: string;
  requested_at: string;
  admin_notes?: string;
}

export interface CreateWithdrawalRequestData {
  amount: number;
  payment_method: 'zelle' | 'bank_transfer' | 'stripe' | 'other';
  payment_details: any;
}

export function useAffiliate(userId?: string) {
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [clients, setClients] = useState<AffiliateClient[]>([]);
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get affiliate stats
  const fetchStats = async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .rpc('get_affiliate_stats_by_user_id', { p_affiliate_user_id: userId });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setStats(data[0]);
      } else {
        setStats(null);
      }
    } catch (err: any) {
      console.error('Error fetching affiliate stats:', err);
      setError(err.message || 'Error fetching affiliate stats');
    } finally {
      setLoading(false);
    }
  };

  // Get affiliate clients
  const fetchClients = async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .rpc('get_affiliate_clients', { p_affiliate_user_id: userId });
      
      if (error) throw error;
      
      setClients(data || []);
    } catch (err: any) {
      console.error('Error fetching affiliate clients:', err);
      setError(err.message || 'Error fetching referred clients');
    } finally {
      setLoading(false);
    }
  };

  // Get affiliate commissions history
  const fetchCommissions = async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .rpc('get_affiliate_commissions_history', { p_affiliate_user_id: userId });
      
      if (error) throw error;
      
      setCommissions(data || []);
    } catch (err: any) {
      console.error('Error fetching affiliate commissions:', err);
      setError(err.message || 'Error fetching commission history');
    } finally {
      setLoading(false);
    }
  };

  // Get withdrawal requests
  const fetchWithdrawalRequests = async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .rpc('get_affiliate_withdrawal_requests', { p_affiliate_user_id: userId });
      
      if (error) throw error;
      
      setWithdrawalRequests(data || []);
    } catch (err: any) {
      console.error('Error fetching withdrawal requests:', err);
      setError(err.message || 'Error fetching withdrawal requests');
    } finally {
      setLoading(false);
    }
  };

  // Create withdrawal request
  const createWithdrawalRequest = async (requestData: CreateWithdrawalRequestData) => {
    if (!userId) throw new Error('User not found');
    
    try {
      setLoading(true);
      setError(null);
      
      // Primeiro, buscar o affiliate_id do usuário
      const { data: affiliateData, error: affiliateError } = await supabase
        .from('affiliates')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (affiliateError || !affiliateData) {
        throw new Error('Affiliate not found for this user');
      }

      const { data, error } = await supabase
        .rpc('create_withdrawal_request', {
          p_affiliate_id: affiliateData.id,
          p_amount: requestData.amount,
          p_payment_method: requestData.payment_method,
          p_payment_details: requestData.payment_details
        });
      
      if (error) throw error;
      
      // Verificar se a resposta indica sucesso ou erro
      if (data && typeof data === 'object' && 'success' in data) {
        if (!data.success) {
          throw new Error(data.error || 'Error creating withdrawal request');
        }
      }
      
      // Refresh stats and withdrawal requests after creating request
      await Promise.all([fetchStats(), fetchWithdrawalRequests()]);
      
      return data;
    } catch (err: any) {
      console.error('Error creating withdrawal request:', err);
      setError(err.message || 'Error creating withdrawal request');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Load all data
  const loadAllData = async () => {
    await Promise.all([
      fetchStats(),
      fetchClients(),
      fetchCommissions(),
      fetchWithdrawalRequests()
    ]);
  };

  useEffect(() => {
    if (userId) {
      loadAllData();
    }
  }, [userId]);

  return {
    stats,
    clients,
    commissions,
    withdrawalRequests,
    loading,
    error,
    fetchStats,
    fetchClients,
    fetchCommissions,
    fetchWithdrawalRequests,
    createWithdrawalRequest,
    loadAllData
  };
}

// Admin functions
export function useAffiliateAdmin() {
  const [allAffiliates, setAllAffiliates] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get all affiliates (admin only)
  const fetchAllAffiliates = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 DEBUG fetchAllAffiliates - Chamando get_all_affiliates_admin');
      const { data, error } = await supabase
        .rpc('get_all_affiliates_admin');
      
      if (error) throw error;
      
      console.log('🔍 DEBUG fetchAllAffiliates - Dados recebidos:', data);
      console.log('🔍 DEBUG fetchAllAffiliates - Quantidade de affiliates:', data?.length);
      if (data && data.length > 0) {
        console.log('🔍 DEBUG fetchAllAffiliates - Primeiro affiliate:', data[0]);
        console.log('🔍 DEBUG fetchAllAffiliates - Available balance:', data[0]?.available_balance);
        console.log('🔍 DEBUG fetchAllAffiliates - Pending balance:', data[0]?.pending_balance);
      }
      
      setAllAffiliates(data || []);
    } catch (err: any) {
      console.error('Error fetching all affiliates:', err);
      setError(err.message || 'Error fetching affiliates');
    } finally {
      setLoading(false);
    }
  };

  // Get pending withdrawal requests (admin only)
  const fetchPendingWithdrawals = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .rpc('get_pending_withdrawal_requests');
      
      if (error) throw error;
      
      setPendingWithdrawals(data || []);
    } catch (err: any) {
      console.error('Error fetching pending withdrawals:', err);
      setError(err.message || 'Error fetching withdrawal requests');
    } finally {
      setLoading(false);
    }
  };

  // Update withdrawal request status
  const updateWithdrawalRequest = async (requestId: string, status: string, adminNotes?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const { error } = await supabase
        .from('affiliate_withdrawal_requests')
        .update({
          status,
          admin_notes: adminNotes,
          processed_at: new Date().toISOString(),
          processed_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', requestId);
      
      if (error) throw error;
      
      // Refresh data
      await fetchPendingWithdrawals();
      
    } catch (err: any) {
      console.error('Error updating withdrawal request:', err);
      setError(err.message || 'Error updating withdrawal request');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Get affiliate clients (admin only)
  const fetchAffiliateClients = async (affiliateId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .rpc('get_affiliate_clients_admin', { p_affiliate_id: affiliateId });
      
      if (error) throw error;
      
      return data || [];
    } catch (err: any) {
      console.error('Error fetching affiliate clients:', err);
      setError(err.message || 'Error fetching affiliate clients');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    allAffiliates,
    pendingWithdrawals,
    loading,
    error,
    fetchAllAffiliates,
    fetchPendingWithdrawals,
    updateWithdrawalRequest,
    fetchAffiliateClients
  };
}
