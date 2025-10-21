import { useState, useEffect } from 'react';
import { Users, DollarSign, Search } from 'lucide-react';
import { useAffiliateAdmin } from '../hooks/useAffiliate';

// Importar hooks customizados
import { useClientsCache } from '../hooks/useClientsCache';
import { useAffiliateFilters } from '../hooks/useAffiliateFilters';
import { useWithdrawalActions } from '../hooks/useWithdrawalActions';

// Importar componentes
import { FilterBar } from '../components/AffiliateManagement/FilterBar';
import { AffiliatesTable } from '../components/AffiliateManagement/AffiliatesTable';
import { WithdrawalsTable } from '../components/AffiliateManagement/WithdrawalsTable';
import { AffiliateDetailModal } from '../components/AffiliateManagement/AffiliateDetailModal';
import { WithdrawalDetailModal } from '../components/AffiliateManagement/WithdrawalDetailModal';

export function AffiliateManagementPage() {
  const { 
    allAffiliates, 
    pendingWithdrawals, 
    loading, 
    error, 
    fetchAllAffiliates, 
    fetchPendingWithdrawals, 
    updateWithdrawalRequest,
    fetchAffiliateClients
  } = useAffiliateAdmin();

  // Estados principais
  const [activeTab, setActiveTab] = useState<'affiliates' | 'withdrawals'>('affiliates');
  const [showFilters, setShowFilters] = useState(false);
  
  // Estados de modais
  const [selectedAffiliate, setSelectedAffiliate] = useState<any>(null);
  const [showAffiliateModal, setShowAffiliateModal] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any>(null);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  
  // Estados de expansão e clientes
  const [expandedAffiliate, setExpandedAffiliate] = useState<string | null>(null);
  const [affiliateClients, setAffiliateClients] = useState<any[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState('');

  // Hooks customizados
  const {
    saveClientsCache,
    getCachedClients
  } = useClientsCache();

  const {
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
    filterAffiliates,
    filterWithdrawals,
    clearAffiliateFilters,
    clearWithdrawalFilters
  } = useAffiliateFilters();

  const {
    approveWithdrawal,
    rejectWithdrawal,
    completeWithdrawal
  } = useWithdrawalActions(updateWithdrawalRequest, fetchPendingWithdrawals);

  // Carregar dados iniciais
  useEffect(() => {
    fetchAllAffiliates();
    fetchPendingWithdrawals();
  }, []);

  // Aplicar filtros
  const filteredAffiliates = filterAffiliates(allAffiliates);
  const filteredWithdrawals = filterWithdrawals(pendingWithdrawals);

  // Função para alternar expansão de afiliado
  const toggleAffiliateExpand = async (affiliateId: string) => {
    if (expandedAffiliate === affiliateId) {
      setExpandedAffiliate(null);
      setAffiliateClients([]);
    } else {
      setExpandedAffiliate(affiliateId);
      
      // Verificar cache
      const cachedClients = getCachedClients(affiliateId);
      if (cachedClients) {
        setAffiliateClients(cachedClients);
        return;
      }
      
      setLoadingClients(true);
      try {
        const clients = await fetchAffiliateClients(affiliateId);
        setAffiliateClients(clients);
        saveClientsCache(affiliateId, clients);
      } catch (error) {
        console.error('Error loading clients:', error);
      } finally {
        setLoadingClients(false);
      }
    }
  };

  // Função para visualizar detalhes do afiliado
  const handleViewAffiliateDetails = (affiliate: any) => {
    setSelectedAffiliate(affiliate);
    setShowAffiliateModal(true);
  };

  // Função para visualizar detalhes do saque
  const handleViewWithdrawalDetails = (withdrawal: any) => {
    setSelectedWithdrawal(withdrawal);
    setShowWithdrawalModal(true);
  };

  // Funções de ação de saque
  const handleApproveWithdrawal = async (requestId: string) => {
    try {
      await approveWithdrawal(requestId);
    } catch (error) {
      console.error('Error approving withdrawal:', error);
    }
  };

  const handleRejectWithdrawal = async (requestId: string) => {
    try {
      await rejectWithdrawal(requestId);
    } catch (error) {
      console.error('Error rejecting withdrawal:', error);
    }
  };

  const handleCompleteWithdrawal = async (requestId: string) => {
    try {
      await completeWithdrawal(requestId);
    } catch (error) {
      console.error('Error completing withdrawal:', error);
    }
  };

  // Função para limpar filtros
  const handleClearFilters = () => {
    clearAffiliateFilters();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tfe-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error loading data</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-1 sm:px-4 lg:px-6 overflow-hidden">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Affiliate Management</h1>
          <p className="text-gray-600 mt-1 sm:mt-2 text-sm">Manage affiliates and payment requests</p>
        </div>


        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('affiliates')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'affiliates'
                    ? 'border-tfe-blue-500 text-tfe-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Users className="w-4 h-4 inline mr-2" />
                Affiliates ({allAffiliates.length})
              </button>
              <button
                onClick={() => setActiveTab('withdrawals')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'withdrawals'
                    ? 'border-tfe-blue-500 text-tfe-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <DollarSign className="w-4 h-4 inline mr-2" />
                Payment Requests ({pendingWithdrawals.length})
              </button>
            </nav>
          </div>
        </div>

        {/* Affiliates Tab */}
        {activeTab === 'affiliates' && (
          <div className="space-y-6">
            <FilterBar
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              showFilters={showFilters}
              setShowFilters={setShowFilters}
              levelFilter={levelFilter}
              setLevelFilter={setLevelFilter}
              balanceFilter={balanceFilter}
              setBalanceFilter={setBalanceFilter}
              dateFilter={dateFilter}
              setDateFilter={setDateFilter}
              onClearFilters={handleClearFilters}
            />

            <AffiliatesTable
              affiliates={filteredAffiliates}
              expandedAffiliate={expandedAffiliate}
              onToggleExpand={toggleAffiliateExpand}
              onViewDetails={handleViewAffiliateDetails}
              clients={affiliateClients}
              loadingClients={loadingClients}
              clientSearchTerm={clientSearchTerm}
              onClientSearchChange={setClientSearchTerm}
            />

            {/* Empty States */}
            {filteredAffiliates.length === 0 && allAffiliates.length > 0 && (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No affiliates found</h3>
                <p className="text-gray-600">Try adjusting your search criteria.</p>
              </div>
            )}

            {allAffiliates.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No affiliates registered</h3>
                <p className="text-gray-600">Affiliates will appear here when they register.</p>
              </div>
            )}
          </div>
        )}

        {/* Withdrawals Tab */}
        {activeTab === 'withdrawals' && (
          <div className="space-y-6">
            <WithdrawalsTable
              withdrawals={filteredWithdrawals}
              searchTerm={withdrawalSearchTerm}
              onSearchChange={setWithdrawalSearchTerm}
              onViewDetails={handleViewWithdrawalDetails}
              onApprove={handleApproveWithdrawal}
              onReject={handleRejectWithdrawal}
              onComplete={handleCompleteWithdrawal}
            />

            {/* Empty States */}
            {filteredWithdrawals.length === 0 && pendingWithdrawals.length > 0 && (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No payment requests found</h3>
                <p className="text-gray-600">Try adjusting your search criteria.</p>
              </div>
            )}

            {pendingWithdrawals.length === 0 && (
              <div className="text-center py-12">
                <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No payment requests</h3>
                <p className="text-gray-600">Withdrawal requests will appear here when made by affiliates.</p>
              </div>
            )}
          </div>
        )}

        {/* Modals */}
        <AffiliateDetailModal
          affiliate={selectedAffiliate}
          isOpen={showAffiliateModal}
          onClose={() => {
            setShowAffiliateModal(false);
            setSelectedAffiliate(null);
          }}
        />

        <WithdrawalDetailModal
          withdrawal={selectedWithdrawal}
          isOpen={showWithdrawalModal}
          onClose={() => {
            setShowWithdrawalModal(false);
            setSelectedWithdrawal(null);
          }}
        />
      </div>
    </div>
  );
}