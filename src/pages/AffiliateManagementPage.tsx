import React, { useState, useEffect } from 'react';
import { Users, DollarSign, Search, Filter, ChevronDown, ChevronUp, Eye, CheckCircle, XCircle, Clock, AlertCircle, User, Mail, Calendar, FileText } from 'lucide-react';
import { useAffiliateAdmin } from '../hooks/useAffiliate';
import { formatDate } from '../utils/dateUtils';
import { useI18n } from '../contexts/I18nContext';

export function AffiliateManagementPage() {
  const { t } = useI18n();
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

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<'affiliates' | 'withdrawals'>('affiliates');
  const [selectedAffiliate, setSelectedAffiliate] = useState<any>(null);
  const [showAffiliateModal, setShowAffiliateModal] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any>(null);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  
  // Filter states
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [balanceFilter, setBalanceFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  
  // Payment requests search
  const [withdrawalSearchTerm, setWithdrawalSearchTerm] = useState('');
  
  // Modal tab states
  const [activeModalTab, setActiveModalTab] = useState<'overview' | 'clients'>('overview');
  const [affiliateClients, setAffiliateClients] = useState<any[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  
  // Dropdown states for inline client view
  const [expandedAffiliate, setExpandedAffiliate] = useState<string | null>(null);

  useEffect(() => {
    fetchAllAffiliates();
    fetchPendingWithdrawals();
  }, []);

  // Fetch clients when switching to clients tab
  useEffect(() => {
    if (activeModalTab === 'clients' && selectedAffiliate?.affiliate_id) {
      const loadClients = async () => {
        setLoadingClients(true);
        try {
          const clients = await fetchAffiliateClients(selectedAffiliate.affiliate_id);
          setAffiliateClients(clients);
        } catch (error) {
          console.error('Error loading clients:', error);
        } finally {
          setLoadingClients(false);
        }
      };
      loadClients();
    }
  }, [activeModalTab, selectedAffiliate?.affiliate_id, fetchAffiliateClients]);

  const formatPaymentDetails = (paymentMethod: string, paymentDetails: any) => {
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

  const handleWithdrawalAction = async (requestId: string, action: 'approve' | 'reject' | 'complete', notes?: string) => {
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
      console.error('Error updating withdrawal request:', err);
      alert('Error updating withdrawal request');
    }
  };

  const toggleExpand = (clientId: string) => {
    setExpandedClient(expandedClient === clientId ? null : clientId);
  };

  const toggleAffiliateExpand = async (affiliateId: string) => {
    if (expandedAffiliate === affiliateId) {
      setExpandedAffiliate(null);
      setAffiliateClients([]);
    } else {
      setExpandedAffiliate(affiliateId);
      setLoadingClients(true);
      try {
        const clients = await fetchAffiliateClients(affiliateId);
        setAffiliateClients(clients);
      } catch (error) {
        console.error('Error loading clients:', error);
      } finally {
        setLoadingClients(false);
      }
    }
  };

  const filteredClients = affiliateClients.filter(client => 
    client.client_name.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
    client.client_email.toLowerCase().includes(clientSearchTerm.toLowerCase())
  );

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

  // Filter payment requests
  const filteredWithdrawals = pendingWithdrawals.filter(withdrawal => {
    const searchTerm = withdrawalSearchTerm.toLowerCase();
    
    return withdrawal.affiliate_name.toLowerCase().includes(searchTerm) ||
           withdrawal.affiliate_email.toLowerCase().includes(searchTerm) ||
           withdrawal.payment_method.toLowerCase().includes(searchTerm) ||
           withdrawal.status.toLowerCase().includes(searchTerm) ||
           withdrawal.amount.toString().includes(withdrawalSearchTerm);
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

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
            {/* Search and Filters */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
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
                         setWithdrawalSearchTerm('');
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
                        Balance
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
                          <span className="font-medium text-blue-600">
                            ${affiliate.total_earned.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleAffiliateExpand(affiliate.affiliate_id)}
                              className="text-tfe-blue-600 hover:text-tfe-blue-900 flex items-center gap-1"
                            >
                              {expandedAffiliate === affiliate.affiliate_id ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                              {expandedAffiliate === affiliate.affiliate_id ? 'Hide Clients' : 'View Clients'}
                            </button>
                            <button
                              onClick={() => {
                                setSelectedAffiliate(affiliate);
                                setShowAffiliateModal(true);
                              }}
                              className="text-gray-600 hover:text-gray-900 flex items-center gap-1"
                            >
                              <Eye className="w-4 h-4" />
                              Details
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedAffiliate === affiliate.affiliate_id && (
                        <tr key={`${affiliate.affiliate_id}-expanded`}>
                          <td colSpan={7} className="px-6 py-4 bg-gray-50">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="text-lg font-semibold text-gray-900">
                                  {t('affiliate.totalClientsInList').replace('{count}', affiliate.total_clients)}
                                </h4>
                                <div className="flex items-center gap-2">
                                  <Search className="w-4 h-4 text-gray-400" />
                                  <input
                                    type="text"
                                    placeholder={t('affiliate.searchClientPlaceholder')}
                                    value={clientSearchTerm}
                                    onChange={(e) => setClientSearchTerm(e.target.value)}
                                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-tfe-blue-500"
                                  />
                                </div>
                              </div>

                              {loadingClients ? (
                                <div className="flex items-center justify-center py-8">
                                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tfe-blue-600"></div>
                                </div>
                              ) : filteredClients.length === 0 ? (
                                <div className="text-center py-8">
                                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                  <h3 className="text-lg font-medium text-gray-900 mb-2">{t('affiliate.noClientsYet')}</h3>
                                </div>
                              ) : (
                                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                                  <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                      <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                          {t('affiliate.clientName')}
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                          Email
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                          Registered
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                          Pages
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                          Commission
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                      {filteredClients.map((client) => (
                                        <tr key={client.client_id} className="hover:bg-gray-50">
                                          <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="flex items-center">
                                              <User className="w-4 h-4 text-gray-400 mr-2" />
                                              <div className="text-sm font-medium text-gray-900">
                                                {client.client_name}
                                              </div>
                                            </div>
                                          </td>
                                          <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="flex items-center">
                                              <Mail className="w-4 h-4 text-gray-400 mr-2" />
                                              <div className="text-sm text-gray-900">
                                                {client.client_email}
                                              </div>
                                            </div>
                                          </td>
                                          <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="flex items-center">
                                              <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                                              <div className="text-sm text-gray-900">
                                                {formatDate(client.registered_at)}
                                              </div>
                                            </div>
                                          </td>
                                          <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="flex items-center">
                                              <FileText className="w-4 h-4 text-gray-400 mr-2" />
                                              <div className="text-sm text-gray-900">
                                                {client.total_pages}
                                              </div>
                                            </div>
                                          </td>
                                          <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="flex items-center">
                                              <DollarSign className="w-4 h-4 text-gray-400 mr-2" />
                                              <div className="text-sm font-medium text-green-600">
                                                ${client.total_commission.toFixed(2)}
                                              </div>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

         {/* Withdrawals Tab */}
         {activeTab === 'withdrawals' && (
           <div className="space-y-6">
             {/* Search Payment Requests */}
             <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
               <div className="flex flex-col sm:flex-row gap-4">
                 <div className="flex-1">
                   <div className="relative">
                     <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                     <input
                       type="text"
                       placeholder="Search by affiliate name, email, payment method, status, or amount..."
                       value={withdrawalSearchTerm}
                       onChange={(e) => setWithdrawalSearchTerm(e.target.value)}
                       className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500"
                     />
                   </div>
                 </div>
                 {withdrawalSearchTerm && (
                   <button
                     onClick={() => setWithdrawalSearchTerm('')}
                     className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
                   >
                     Clear Search
                   </button>
                 )}
               </div>
               {withdrawalSearchTerm && (
                 <div className="mt-2 text-xs text-gray-500">
                   Searching in: Affiliate Name, Email, Payment Method, Status, Amount
                 </div>
               )}
             </div>

             {/* Withdrawals Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Affiliate
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                         Method
                       </th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                         Status
                       </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                   <tbody className="bg-white divide-y divide-gray-200">
                     {filteredWithdrawals.map((withdrawal) => (
                      <tr key={withdrawal.request_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <Users className="w-5 h-5 text-orange-600" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{withdrawal.affiliate_name}</div>
                              <div className="text-sm text-gray-500">{withdrawal.affiliate_email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="font-medium text-green-600">
                            ${withdrawal.amount.toFixed(2)}
                          </span>
                        </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                           <span className="capitalize">{withdrawal.payment_method.replace('_', ' ')}</span>
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(withdrawal.status)}`}>
                            {getStatusIcon(withdrawal.status)}
                            {withdrawal.status === 'pending' ? 'Pending' :
                             withdrawal.status === 'approved' ? 'Approved' :
                             withdrawal.status === 'rejected' ? 'Rejected' :
                             withdrawal.status === 'completed' ? 'Completed' : withdrawal.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(withdrawal.requested_at)}
                        </td>
                         <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                           <div className="flex items-center gap-2">
                             <button
                               onClick={() => {
                                 setSelectedWithdrawal(withdrawal);
                                 setShowWithdrawalModal(true);
                               }}
                               className="text-tfe-blue-600 hover:text-tfe-blue-900 flex items-center gap-1"
                             >
                               <Eye className="w-4 h-4" />
                               View Details
                             </button>
                             {withdrawal.status === 'pending' && (
                               <>
                                 <button
                                   onClick={() => handleWithdrawalAction(withdrawal.request_id, 'approve')}
                                   className="text-green-600 hover:text-green-900"
                                 >
                                   Approve
                                 </button>
                                 <button
                                   onClick={() => handleWithdrawalAction(withdrawal.request_id, 'reject')}
                                   className="text-red-600 hover:text-red-900"
                                 >
                                   Reject
                                 </button>
                               </>
                             )}
                             {withdrawal.status === 'approved' && (
                               <button
                                 onClick={() => handleWithdrawalAction(withdrawal.request_id, 'complete')}
                                 className="text-blue-600 hover:text-blue-900"
                               >
                                 Mark as Paid
                               </button>
                             )}
                           </div>
                         </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Empty States */}
        {activeTab === 'affiliates' && filteredAffiliates.length === 0 && allAffiliates.length > 0 && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No affiliates found</h3>
            <p className="text-gray-600">Try adjusting your search.</p>
          </div>
        )}

        {activeTab === 'affiliates' && allAffiliates.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No affiliates registered</h3>
            <p className="text-gray-600">Affiliates will appear here when they register.</p>
          </div>
        )}

         {activeTab === 'withdrawals' && filteredWithdrawals.length === 0 && pendingWithdrawals.length > 0 && (
           <div className="text-center py-12">
             <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
             <h3 className="text-lg font-medium text-gray-900 mb-2">No payment requests found</h3>
             <p className="text-gray-600">Try adjusting your search criteria.</p>
           </div>
         )}

         {activeTab === 'withdrawals' && pendingWithdrawals.length === 0 && (
           <div className="text-center py-12">
             <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
             <h3 className="text-lg font-medium text-gray-900 mb-2">No payment requests</h3>
             <p className="text-gray-600">Withdrawal requests will appear here when made by affiliates.</p>
           </div>
         )}

        {/* Affiliate Details Modal */}
        {showAffiliateModal && selectedAffiliate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className={`bg-white rounded-lg w-full max-h-[90vh] overflow-y-auto ${
              activeModalTab === 'clients' ? 'max-w-6xl' : 'max-w-2xl'
            }`}>
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

                {/* Tab Navigation */}
                <div className="border-b border-gray-200 mb-6">
                  <nav className="-mb-px flex space-x-8">
                    <button
                      onClick={() => setActiveModalTab('overview')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeModalTab === 'overview'
                          ? 'border-tfe-blue-500 text-tfe-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {t('affiliate.overviewTab')}
                    </button>
                    <button
                      onClick={() => setActiveModalTab('clients')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeModalTab === 'clients'
                          ? 'border-tfe-blue-500 text-tfe-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {t('affiliate.clientsTab')}
                    </button>
                  </nav>
                </div>

                {activeModalTab === 'overview' && (
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
                    
                    {/* Withdrawal Status within Basic Information */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Withdrawal Status</h4>
                      {(() => {
                        const firstPageDate = selectedAffiliate.first_page_translated_at;
                        const canWithdraw = selectedAffiliate.can_request_withdrawal;
                        const daysUntilWithdrawal = selectedAffiliate.days_until_withdrawal_available;
                        
                        if (!firstPageDate) {
                          return (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-gray-500" />
                                <div>
                                  <p className="text-sm font-medium text-gray-700">
                                    No translated pages yet
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    Start earning to unlock withdrawals
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        
                        if (canWithdraw) {
                          return (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                <div>
                                  <p className="text-sm font-medium text-green-800">
                                    Available now!
                                  </p>
                                  <p className="text-xs text-green-600 mt-1">
                                    Ready to request withdrawal
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        
                        return (
                          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-orange-600" />
                              <div>
                                <p className="text-sm font-medium text-orange-800">
                                  Not available yet
                                </p>
                                <p className="text-xs text-orange-600 mt-1">
                                  {daysUntilWithdrawal || 0} days remaining
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
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
                        <label className="text-sm font-medium text-gray-500">Total Earned</label>
                        <p className="text-2xl font-bold text-blue-600">${selectedAffiliate.total_earned.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

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
                )}

                {activeModalTab === 'clients' && (
                  <div className="space-y-6">
                    {/* Clients Header */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {t('affiliate.totalClientsInList').replace('{count}', selectedAffiliate.total_clients)}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Search className="w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder={t('affiliate.searchClientPlaceholder')}
                          value={clientSearchTerm}
                          onChange={(e) => setClientSearchTerm(e.target.value)}
                          className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-tfe-blue-500"
                        />
                      </div>
                    </div>

                    {/* Clients Table */}
                    {loadingClients ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tfe-blue-600"></div>
                      </div>
                    ) : filteredClients.length === 0 ? (
                      <div className="text-center py-12">
                        <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">{t('affiliate.noClientsYet')}</h3>
                      </div>
                    ) : (
                      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t('affiliate.clientName')}
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Email
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Registered
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Pages
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Commission
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {filteredClients.map((client) => (
                              <React.Fragment key={client.client_id}>
                                <tr className="hover:bg-gray-50">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                      <User className="w-4 h-4 text-gray-400 mr-2" />
                                      <div className="text-sm font-medium text-gray-900">
                                        {client.client_name}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                      <Mail className="w-4 h-4 text-gray-400 mr-2" />
                                      <div className="text-sm text-gray-900">
                                        {client.client_email}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                      <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                                      <div className="text-sm text-gray-900">
                                        {formatDate(client.registered_at)}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                      <FileText className="w-4 h-4 text-gray-400 mr-2" />
                                      <div className="text-sm text-gray-900">
                                        {client.total_pages}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                      <DollarSign className="w-4 h-4 text-gray-400 mr-2" />
                                      <div className="text-sm font-medium text-green-600">
                                        ${client.total_commission.toFixed(2)}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <button
                                      onClick={() => toggleExpand(client.client_id)}
                                      className="text-tfe-blue-600 hover:text-tfe-blue-900 flex items-center gap-1"
                                    >
                                      <Eye className="w-4 h-4" />
                                      {t('affiliate.viewClientDetails')}
                                    </button>
                                  </td>
                                </tr>
                                {expandedClient === client.client_id && (
                                  <tr>
                                    <td colSpan={6} className="px-6 py-4 bg-gray-50">
                                      <div className="space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <div>
                                            <label className="text-sm font-medium text-gray-500">{t('affiliate.lastDocumentDate')}</label>
                                            <p className="text-sm text-gray-900">
                                              {client.last_document_date ? formatDate(client.last_document_date) : 'No documents yet'}
                                            </p>
                                          </div>
                                          <div>
                                            <label className="text-sm font-medium text-gray-500">{t('affiliate.activeDocuments')}</label>
                                            <p className="text-sm text-gray-900">
                                              {client.has_active_documents ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                  Yes
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                  No
                                                </span>
                                              )}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

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

         {/* Withdrawal Details Modal */}
         {showWithdrawalModal && selectedWithdrawal && (
           <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
             <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
               <div className="p-6">
                 <div className="flex items-center justify-between mb-6">
                   <h2 className="text-xl font-bold text-gray-900">Payment Request Details</h2>
                   <button
                     onClick={() => {
                       setShowWithdrawalModal(false);
                       setSelectedWithdrawal(null);
                     }}
                     className="text-gray-400 hover:text-gray-600"
                   >
                     <XCircle className="w-6 h-6" />
                   </button>
                 </div>

                 <div className="space-y-6">
                   {/* Basic Info */}
                   <div className="bg-gray-50 rounded-lg p-4">
                     <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Information</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div>
                         <label className="text-sm font-medium text-gray-500">Affiliate Name</label>
                         <p className="text-gray-900">{selectedWithdrawal.affiliate_name}</p>
                       </div>
                       <div>
                         <label className="text-sm font-medium text-gray-500">Affiliate Email</label>
                         <p className="text-gray-900">{selectedWithdrawal.affiliate_email}</p>
                       </div>
                       <div>
                         <label className="text-sm font-medium text-gray-500">Amount</label>
                         <p className="text-2xl font-bold text-green-600">${selectedWithdrawal.amount.toFixed(2)}</p>
                       </div>
                       <div>
                         <label className="text-sm font-medium text-gray-500">Status</label>
                         <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(selectedWithdrawal.status)}`}>
                           {getStatusIcon(selectedWithdrawal.status)}
                           {selectedWithdrawal.status === 'pending' ? 'Pending' :
                            selectedWithdrawal.status === 'approved' ? 'Approved' :
                            selectedWithdrawal.status === 'rejected' ? 'Rejected' :
                            selectedWithdrawal.status === 'completed' ? 'Completed' : selectedWithdrawal.status}
                         </span>
                       </div>
                       <div>
                         <label className="text-sm font-medium text-gray-500">Request Date</label>
                         <p className="text-gray-900">{formatDate(selectedWithdrawal.requested_at)}</p>
                       </div>
                     </div>
                   </div>

                   {/* Payment Method Details */}
                   <div className="bg-blue-50 rounded-lg p-4">
                     <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Method Details</h3>
                     <div className="space-y-3">
                       <div>
                         <label className="text-sm font-medium text-gray-500">Payment Method</label>
                         <p className="text-gray-900 capitalize">{selectedWithdrawal.payment_method.replace('_', ' ')}</p>
                       </div>
                       
                       {selectedWithdrawal.payment_method === 'zelle' && (
                         <div className="space-y-2">
                           {selectedWithdrawal.payment_details?.email && (
                             <div>
                               <label className="text-sm font-medium text-gray-500">Zelle Email</label>
                               <p className="text-gray-900 font-mono">{selectedWithdrawal.payment_details.email}</p>
                             </div>
                           )}
                           {selectedWithdrawal.payment_details?.phone && (
                             <div>
                               <label className="text-sm font-medium text-gray-500">Zelle Phone</label>
                               <p className="text-gray-900 font-mono">{selectedWithdrawal.payment_details.phone}</p>
                             </div>
                           )}
                         </div>
                       )}

                       {selectedWithdrawal.payment_method === 'bank_transfer' && (
                         <div className="space-y-2">
                           {selectedWithdrawal.payment_details?.bank_name && (
                             <div>
                               <label className="text-sm font-medium text-gray-500">Bank Name</label>
                               <p className="text-gray-900">{selectedWithdrawal.payment_details.bank_name}</p>
                             </div>
                           )}
                           {selectedWithdrawal.payment_details?.account_holder && (
                             <div>
                               <label className="text-sm font-medium text-gray-500">Account Holder</label>
                               <p className="text-gray-900">{selectedWithdrawal.payment_details.account_holder}</p>
                             </div>
                           )}
                           {selectedWithdrawal.payment_details?.account_number && (
                             <div>
                               <label className="text-sm font-medium text-gray-500">Account Number</label>
                               <p className="text-gray-900 font-mono">{selectedWithdrawal.payment_details.account_number}</p>
                             </div>
                           )}
                           {selectedWithdrawal.payment_details?.routing_number && (
                             <div>
                               <label className="text-sm font-medium text-gray-500">Routing Number</label>
                               <p className="text-gray-900 font-mono">{selectedWithdrawal.payment_details.routing_number}</p>
                             </div>
                           )}
                         </div>
                       )}

                       {selectedWithdrawal.payment_method === 'stripe' && selectedWithdrawal.payment_details?.email && (
                         <div>
                           <label className="text-sm font-medium text-gray-500">Stripe Email</label>
                           <p className="text-gray-900 font-mono">{selectedWithdrawal.payment_details.email}</p>
                         </div>
                       )}

                       {selectedWithdrawal.payment_method === 'other' && (
                         <div>
                           <label className="text-sm font-medium text-gray-500">Other Details</label>
                           <p className="text-gray-900">{JSON.stringify(selectedWithdrawal.payment_details, null, 2)}</p>
                         </div>
                       )}
                     </div>
                   </div>

                   {/* Admin Notes */}
                   {selectedWithdrawal.admin_notes && (
                     <div className="bg-yellow-50 rounded-lg p-4">
                       <h3 className="text-lg font-semibold text-gray-900 mb-2">Admin Notes</h3>
                       <p className="text-gray-700">{selectedWithdrawal.admin_notes}</p>
                     </div>
                   )}
                 </div>

                 <div className="mt-6 flex justify-end">
                   <button
                     onClick={() => {
                       setShowWithdrawalModal(false);
                       setSelectedWithdrawal(null);
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
