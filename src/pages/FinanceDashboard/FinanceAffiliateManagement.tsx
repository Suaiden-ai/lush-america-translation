import React, { useState, useEffect } from 'react';
import { Users, Search, Filter, ChevronDown, ChevronUp, Eye, Clock, XCircle } from 'lucide-react';
import { useAffiliateAdmin } from '../../hooks/useAffiliate';
import { formatDate } from '../../utils/dateUtils';
import { useI18n } from '../../contexts/I18nContext';

export function FinanceAffiliateManagement() {
  const { t } = useI18n();
  const {
    allAffiliates,
    loading,
    error,
    fetchAllAffiliates
  } = useAffiliateAdmin();

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAffiliate, setSelectedAffiliate] = useState<any>(null);
  const [showAffiliateModal, setShowAffiliateModal] = useState(false);
  
  // Filter states
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [balanceFilter, setBalanceFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  
  // Removed modal tab states - only showing overview
  // Removed client-related state variables
  
  // Removed dropdown states for client view
  
  // Timer state for withdrawal countdown
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    fetchAllAffiliates();
  }, []);

  // Função para calcular tempo restante até a próxima liberação
  const calculateTimeLeft = (nextWithdrawalDate: string | null) => {
    if (!nextWithdrawalDate) return '';
    
    const now = new Date();
    const withdrawalDate = new Date(nextWithdrawalDate);
    const diffInMs = withdrawalDate.getTime() - now.getTime();
    
    if (diffInMs <= 0) return t('affiliate.withdrawalAvailableNow');
    
    const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffInMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffInMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffInMs % (1000 * 60)) / 1000);
    
    if (days > 0) {
      return t('affiliate.withdrawalAvailableIn')
        .replace('{days}', days.toString())
        .replace('{hours}', hours.toString())
        .replace('{minutes}', minutes.toString());
    } else if (hours > 0) {
      return t('affiliate.withdrawalAvailableInHours')
        .replace('{hours}', hours.toString())
        .replace('{minutes}', minutes.toString());
    } else {
      return `${minutes}m ${seconds}s restantes`;
    }
  };

  // Atualizar contador quando selectedAffiliate mudar
  useEffect(() => {
    if (selectedAffiliate?.next_withdrawal_date) {
      const updateTimer = () => {
        const calculatedTime = calculateTimeLeft(selectedAffiliate.next_withdrawal_date);
        setTimeLeft(calculatedTime);
      };
      
      updateTimer();
      const interval = setInterval(updateTimer, 1000); // Update every second
      
      return () => clearInterval(interval);
    } else {
      setTimeLeft('');
    }
  }, [selectedAffiliate?.next_withdrawal_date, t]);

  // Removed clients tab functionality

  // Removed client-related functions

  const filteredAffiliates = allAffiliates.filter(affiliate => {
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

  // Filtered affiliates logic

  if (loading) {
    return (
      <div className="py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="flex flex-col items-center space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <img
                    src="/logo.png"
                    alt="Lush America Translations"
                    className="w-8 h-8 flex-shrink-0 object-contain"
                  />
                  <h3 className="text-xl font-bold">Lush America Translations</h3>
                </div>
              </div>
              <p className="text-gray-600 mt-4">Loading affiliate data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-4 sm:py-6">
      <div className="max-w-7xl mx-auto px-1 sm:px-4 lg:px-6 overflow-hidden">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Affiliate Management</h1>
          <p className="text-gray-600 mt-1 sm:mt-2 text-sm">View and manage all affiliates</p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search affiliates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500"
                />
              </div>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Filter className="w-4 h-4" />
              Filters
              {(levelFilter !== 'all' || balanceFilter !== 'all' || dateFilter !== 'all') && (
                <span className="bg-tfe-blue-500 text-white text-xs rounded-full px-2 py-1">
                  {[levelFilter, balanceFilter, dateFilter].filter(f => f !== 'all').length}
                </span>
              )}
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
          
          {/* Filter Controls */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Level Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Level</label>
                  <select
                    value={levelFilter}
                    onChange={(e) => setLevelFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500"
                  >
                    <option value="all">All Levels</option>
                    <option value="1">Level 1</option>
                    <option value="2">Level 2</option>
                  </select>
                </div>
                
                {/* Balance Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Balance</label>
                  <select
                    value={balanceFilter}
                    onChange={(e) => setBalanceFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500"
                  >
                    <option value="all">All Balances</option>
                    <option value="high">High ($100+)</option>
                    <option value="medium">Medium ($10-$99)</option>
                    <option value="low">Low (Under $10)</option>
                  </select>
                </div>
                
                {/* Date Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Registration</label>
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500"
                  >
                    <option value="all">All Time</option>
                    <option value="recent">Last 30 Days</option>
                    <option value="old">Older than 30 Days</option>
                  </select>
                </div>
              </div>
              
              {/* Clear Filters Button */}
              <div className="mt-4 flex justify-end">
                <button
                   onClick={() => {
                     setLevelFilter('all');
                     setBalanceFilter('all');
                     setDateFilter('all');
                     setSearchTerm('');
                   }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Affiliates Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Affiliate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Clients
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pages
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Available Balance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pending Balance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Earned
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAffiliates.map((affiliate) => (
                  <React.Fragment key={affiliate.affiliate_id}>
                    <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <Users className="w-5 h-5 text-orange-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{affiliate.user_name}</div>
                          <div className="text-sm text-gray-500">{affiliate.user_email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono text-gray-900">{affiliate.referral_code}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        affiliate.current_level === 2 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        Level {affiliate.current_level}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {affiliate.total_clients}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {affiliate.total_pages}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="font-medium text-green-600">
                        ${affiliate.available_balance.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="font-medium text-orange-600">
                        ${affiliate.pending_balance.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="font-medium text-blue-600">
                        ${affiliate.total_earned.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedAffiliate(affiliate);
                            setShowAffiliateModal(true);
                          }}
                          className="text-tfe-blue-600 hover:text-tfe-blue-900 flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          View Details
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Removed expanded client view */}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Empty States */}
        {filteredAffiliates.length === 0 && allAffiliates.length > 0 && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No affiliates found</h3>
            <p className="text-gray-600">Try adjusting your search.</p>
          </div>
        )}

        {allAffiliates.length === 0 && !loading && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No affiliates registered</h3>
            <p className="text-gray-600">Affiliates will appear here when they register.</p>
          </div>
        )}

        {/* Affiliate Details Modal */}
        {showAffiliateModal && selectedAffiliate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Affiliate Details</h2>
                  <button
                    onClick={() => {
                      setShowAffiliateModal(false);
                      setSelectedAffiliate(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>

                {/* Removed tab navigation - only showing overview */}

                <div className="space-y-6">
                    {/* Basic Info */}
                    <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Name</label>
                        <p className="text-gray-900">{selectedAffiliate.user_name}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Email</label>
                        <p className="text-gray-900">{selectedAffiliate.user_email}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Referral Code</label>
                        <p className="text-gray-900 font-mono">{selectedAffiliate.referral_code}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Registration Date</label>
                        <p className="text-gray-900">{formatDate(selectedAffiliate.created_at)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Current Level</label>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          selectedAffiliate.current_level === 2 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          Level {selectedAffiliate.current_level}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Performance Stats */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Statistics</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Total Clients</label>
                        <p className="text-2xl font-bold text-gray-900">{selectedAffiliate.total_clients}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Total Pages</label>
                        <p className="text-2xl font-bold text-gray-900">{selectedAffiliate.total_pages}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Available Balance</label>
                        <p className="text-2xl font-bold text-green-600">${selectedAffiliate.available_balance.toFixed(2)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Pending Balance</label>
                        <p className="text-2xl font-bold text-orange-600">${selectedAffiliate.pending_balance.toFixed(2)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Total Earned</label>
                        <p className="text-2xl font-bold text-blue-600">${selectedAffiliate.total_earned.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Withdrawal Status */}
                  {selectedAffiliate.next_withdrawal_date && (
                    <div className="bg-orange-50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Withdrawal Status</h3>
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-orange-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-orange-800">
                            {selectedAffiliate.available_balance > 0 ? t('affiliate.withdrawalAvailable') : t('affiliate.withdrawalNotAvailable')}
                          </p>
                          <p className="text-xs text-orange-600 mt-1">
                            {timeLeft || calculateTimeLeft(selectedAffiliate.next_withdrawal_date) || `${selectedAffiliate.days_until_withdrawal_available || 0} dias restantes`}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            Próxima liberação: {new Date(selectedAffiliate.next_withdrawal_date).toLocaleDateString()}
                          </p>
                        </div>
                        {selectedAffiliate.available_balance > 0 && (
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-xs text-green-600 font-medium">
                              {t('affiliate.ready')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Commission Rate Info */}
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Commission Information</h3>
                    <p className="text-sm text-gray-600">
                      Current commission rate: <span className="font-semibold">
                        ${selectedAffiliate.current_level === 1 ? '0.50' : '1.00'} per page
                      </span>
                    </p>
                    {selectedAffiliate.current_level === 1 && (
                      <p className="text-sm text-gray-600 mt-1">
                        Pages to next level: <span className="font-semibold">
                          {Math.max(0, 200 - selectedAffiliate.total_pages)}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Removed clients tab - only showing overview */}

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => {
                      setShowAffiliateModal(false);
                      setSelectedAffiliate(null);
                    }}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
         )}
       </div>
     </div>
   );
 }
