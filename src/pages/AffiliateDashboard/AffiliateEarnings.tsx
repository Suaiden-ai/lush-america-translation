import React, { useState } from 'react';
import { 
  DollarSign, 
  Search, 
  Calendar, 
  User, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  CreditCard,
  Clock,
  Plus,
  Eye
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAffiliate, CreateWithdrawalRequestData } from '../../hooks/useAffiliate';
import { useI18n } from '../../contexts/I18nContext';
import { formatDate } from '../../utils/dateUtils';
import { WithdrawalTimer } from '../../components/WithdrawalTimer';

type TabType = 'commissions' | 'withdrawals';

export function AffiliateEarnings() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { stats, commissions, withdrawalRequests, createWithdrawalRequest, loading, error } = useAffiliate(user?.id);
  const [activeTab, setActiveTab] = useState<TabType>('commissions');
  
  // Commission filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'reversed'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'client'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Withdrawal modal state
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Details modal state
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any>(null);

  // Withdrawal form state
  const [formData, setFormData] = useState<CreateWithdrawalRequestData>({
    amount: 0,
    payment_method: 'zelle',
    payment_details: {}
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const paymentMethods = [
    { value: 'zelle', label: 'Zelle', description: 'Transfer via Zelle' },
    { value: 'bank_transfer', label: 'Bank Transfer', description: 'Direct transfer to bank account' },
    { value: 'stripe', label: 'Stripe', description: 'Payment via Stripe' },
    { value: 'other', label: 'Other', description: 'Other payment method' }
  ];

  // Calculate commission totals
  const totals = commissions.reduce((acc, commission) => {
    if (commission.status === 'confirmed') {
      acc.confirmed += commission.commission_amount;
    } else if (commission.status === 'reversed') {
      acc.reversed += commission.commission_amount;
    }
    return acc;
  }, { confirmed: 0, reversed: 0 });

  // Filter and sort commissions
  const filteredCommissions = commissions
    .filter(commission => {
      const matchesSearch = commission.client_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || commission.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'date':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 'amount':
          aValue = a.commission_amount;
          bValue = b.commission_amount;
          break;
        case 'client':
          aValue = a.client_name.toLowerCase();
          bValue = b.client_name.toLowerCase();
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFormErrors(prev => ({ ...prev, [field]: '' }));
    setSubmitError(null);
    
    // Real-time validation for amount
    if (field === 'amount' && value > (stats?.available_balance || 0)) {
      setFormErrors(prev => ({ 
        ...prev, 
        amount: `Insufficient balance. Maximum: $${(stats?.available_balance || 0).toFixed(2)}` 
      }));
    }
  };

  const handlePaymentDetailsChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      payment_details: { ...prev.payment_details, [field]: value }
    }));
  };

  const handleViewDetails = (withdrawal: any) => {
    setSelectedWithdrawal(withdrawal);
    setShowDetailsModal(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.amount || formData.amount <= 0) {
      errors.amount = 'Amount must be greater than zero';
    } else if (formData.amount > (stats?.available_balance || 0)) {
      errors.amount = 'Amount exceeds available balance';
    }

    if (!formData.payment_method) {
      errors.payment_method = 'Select a payment method';
    }

    // Validate payment details based on method
    if (formData.payment_method === 'zelle') {
      if (!formData.payment_details.email && !formData.payment_details.phone) {
        errors.payment_details = 'Email or phone is required for Zelle';
      }
    } else if (formData.payment_method === 'bank_transfer') {
      if (!formData.payment_details.bank_name || !formData.payment_details.account_number || !formData.payment_details.account_holder) {
        errors.payment_details = 'Bank details are required';
      }
    } else if (formData.payment_method === 'stripe') {
      if (!formData.payment_details.email) {
        errors.payment_details = 'Email is required for Stripe';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await createWithdrawalRequest(formData);
      setSubmitSuccess(true);
      setFormData({
        amount: 0,
        payment_method: 'zelle',
        payment_details: {}
      });
      setTimeout(() => {
        setShowWithdrawalModal(false);
        setSubmitSuccess(false);
      }, 2000);
    } catch (err: any) {
      setSubmitError(err.message || 'Error creating withdrawal request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPaymentDetailsForm = () => {
    switch (formData.payment_method) {
      case 'zelle':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Zelle Email or Phone *
              </label>
              <input
                type="text"
                placeholder="example@email.com or +1234567890"
                value={formData.payment_details.email || formData.payment_details.phone || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.includes('@')) {
                    handlePaymentDetailsChange('email', value);
                    handlePaymentDetailsChange('phone', '');
                  } else {
                    handlePaymentDetailsChange('phone', value);
                    handlePaymentDetailsChange('email', '');
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500"
              />
            </div>
          </div>
        );

      case 'bank_transfer':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bank Name *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Bank of America"
                  value={formData.payment_details.bank_name || ''}
                  onChange={(e) => handlePaymentDetailsChange('bank_name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Number *
                </label>
                <input
                  type="text"
                  placeholder="12345-6"
                  value={formData.payment_details.account_number || ''}
                  onChange={(e) => handlePaymentDetailsChange('account_number', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Agency
                </label>
                <input
                  type="text"
                  placeholder="1234"
                  value={formData.payment_details.agency || ''}
                  onChange={(e) => handlePaymentDetailsChange('agency', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Holder *
                </label>
                <input
                  type="text"
                  placeholder="Full name"
                  value={formData.payment_details.account_holder || ''}
                  onChange={(e) => handlePaymentDetailsChange('account_holder', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500"
                />
              </div>
            </div>
          </div>
        );

      case 'stripe':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                placeholder="example@email.com"
                value={formData.payment_details.email || ''}
                onChange={(e) => handlePaymentDetailsChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500"
              />
            </div>
          </div>
        );

      case 'other':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Method Details
              </label>
              <textarea
                placeholder="Describe how you would like to receive the payment..."
                value={formData.payment_details.details || ''}
                onChange={(e) => handlePaymentDetailsChange('details', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'reversed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'reversed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed':
        return t('affiliate.confirmed');
      case 'reversed':
        return t('affiliate.reversed');
      default:
        return t('affiliate.pending');
    }
  };

  const formatPaymentDetails = (paymentDetails: any, method: string) => {
    if (!paymentDetails) return 'N/A';
    
    switch (method) {
      case 'zelle':
        return paymentDetails.email || paymentDetails.phone || 'N/A';
      case 'bank_transfer':
        return `${paymentDetails.bank_name || 'N/A'} - ${paymentDetails.account_number || 'N/A'}`;
      case 'stripe':
        return paymentDetails.email || 'N/A';
      case 'other':
        return paymentDetails.details || 'N/A';
      default:
        return 'N/A';
    }
  };

  const getWithdrawalStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getWithdrawalStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }


  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <DollarSign className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No data found</h3>
        <p className="text-gray-600">Unable to load your affiliate information.</p>
      </div>
    );
  }

  // Ensure we have the new fields, if not, show loading
  if (stats.pending_balance === undefined || stats.next_withdrawal_date === undefined) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <DollarSign className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Updating system...</h3>
        <p className="text-gray-600">Please refresh the page to see the latest balance information.</p>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{t('affiliate.commissionsAndWithdrawals')}</h2>
          <p className="text-gray-600">{t('affiliate.manageEarningsAndWithdrawals')}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600">{t('affiliate.availableForWithdrawal')}</p>
              <p className="text-xl font-bold text-purple-600">${stats.available_balance.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">Ready to withdraw</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600">{t('affiliate.pendingBalance')}</p>
              <p className="text-xl font-bold text-orange-600">${stats.pending_balance.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.next_withdrawal_date ? (() => {
                  const now = new Date();
                  const withdrawalDate = new Date(stats.next_withdrawal_date);
                  const diffInMs = withdrawalDate.getTime() - now.getTime();
                  
                  if (diffInMs <= 0) {
                    return t('affiliate.availableNow');
                  }
                  
                  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
                  const diffInHours = Math.floor((diffInMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                  const diffInMinutes = Math.floor((diffInMs % (1000 * 60 * 60)) / (1000 * 60));
                  
                  if (diffInDays > 0) {
                    return `${t('affiliate.availableIn')} ${diffInDays} ${t('affiliate.days')}, ${diffInHours}h ${diffInMinutes}m`;
                  } else if (diffInHours > 0) {
                    return `${t('affiliate.availableIn')} ${diffInHours}h ${diffInMinutes}m`;
                  } else {
                    return `${t('affiliate.availableIn')} ${diffInMinutes}m`;
                  }
                })() : 'No pending funds'}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('affiliate.confirmedCommissions')}</p>
              <p className="text-xl font-bold text-green-600">${totals.confirmed.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('affiliate.reversedCommissions')}</p>
              <p className="text-xl font-bold text-red-600">${totals.reversed.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Withdrawal Timer */}
      <WithdrawalTimer 
        firstPageTranslatedAt={stats.first_page_translated_at}
        canRequestWithdrawal={stats.available_balance > 0}
        daysUntilWithdrawalAvailable={stats.next_withdrawal_date ? Math.floor((new Date(stats.next_withdrawal_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : undefined}
      />

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('commissions')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'commissions'
                  ? 'border-tfe-blue-500 text-tfe-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
{t('affiliate.commissionHistory')}
            </button>
            <button
              onClick={() => setActiveTab('withdrawals')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'withdrawals'
                  ? 'border-tfe-blue-500 text-tfe-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
{t('affiliate.withdrawalRequests')}
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'commissions' ? (
            <div className="space-y-6">
              {/* Commission Filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by client..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500"
                  >
                    <option value="all">{t('affiliate.allStatus')}</option>
                    <option value="confirmed">{t('affiliate.confirmed')}</option>
                    <option value="reversed">{t('affiliate.reversed')}</option>
                  </select>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500"
                  >
                    <option value="date">{t('affiliate.sortByDate')}</option>
                    <option value="amount">{t('affiliate.amount')}</option>
                    <option value="client">{t('affiliate.client')}</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500"
                  >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </button>
                </div>
              </div>

              {/* Commissions Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Client
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pages
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rate
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('affiliate.amount')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('affiliate.status')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCommissions.map((commission) => (
                      <tr key={commission.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-gray-600" />
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium text-gray-900">
                                {commission.client_name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center gap-1">
                            <FileText className="w-4 h-4 text-gray-400" />
                            {commission.pages_count}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center gap-1">
                            <span className="font-medium">${commission.commission_rate.toFixed(2)}</span>
                            <span className="text-xs text-gray-500">/page</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            Level {commission.commission_level}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className={`font-medium ${
                            commission.status === 'confirmed' ? 'text-green-600' : 
                            commission.status === 'reversed' ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            ${commission.commission_amount.toFixed(2)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(commission.status)}`}>
                            {getStatusIcon(commission.status)}
                            {getStatusText(commission.status)}
                          </span>
                          {commission.reversal_reason && (
                            <div className="mt-1 text-xs text-red-600">
                              {commission.reversal_reason}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {formatDate(commission.created_at)}
                          </div>
                          {commission.reversed_at && (
                            <div className="text-xs text-red-600 mt-1">
                              Reversed: {formatDate(commission.reversed_at)}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredCommissions.length === 0 && (searchTerm || statusFilter !== 'all') && (
                  <div className="text-center py-8">
                    <Search className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No commissions found with the applied filters</p>
                  </div>
                )}

                {commissions.length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <DollarSign className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No commissions found</h3>
                    <p className="text-gray-600">
                      You don't have commissions yet. When your referred clients make translations, 
                      your commissions will appear here.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Withdrawal Requests Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{t('affiliate.withdrawalRequests')}</h3>
                  <p className="text-gray-600">{t('affiliate.manageEarningsAndWithdrawals')}</p>
                </div>
                <button
                  onClick={() => setShowWithdrawalModal(true)}
                  disabled={stats.available_balance <= 0}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    stats.available_balance > 0
                      ? 'bg-tfe-blue-600 text-white hover:bg-tfe-blue-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                  title={
                    stats.available_balance <= 0
                      ? 'No funds available for withdrawal'
                      : 'Request withdrawal'
                  }
                >
                  <Plus className="w-4 h-4" />
{t('affiliate.requestNewWithdrawal')}
                </button>
              </div>

              {/* Withdrawal Requests Table */}
              {withdrawalRequests.length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No withdrawal requests yet</h3>
                  <p className="text-gray-600 mb-4">
                    You haven't made any withdrawal requests. Click the button above to request your first withdrawal.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('affiliate.amount')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('affiliate.paymentMethod')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('affiliate.paymentDetails')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('affiliate.status')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('affiliate.requestDate')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('affiliate.actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {withdrawalRequests.map((request) => (
                        <tr key={request.request_id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            ${request.amount.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center gap-2">
                              <CreditCard className="w-4 h-4 text-gray-400" />
                              {request.payment_method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="max-w-xs truncate" title={formatPaymentDetails(request.payment_details, request.payment_method)}>
                              {formatPaymentDetails(request.payment_details, request.payment_method)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getWithdrawalStatusColor(request.status)}`}>
                              {getWithdrawalStatusIcon(request.status)}
                              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              {formatDate(request.requested_at)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button 
                              onClick={() => handleViewDetails(request)}
                              className="text-tfe-blue-600 hover:text-tfe-blue-900 flex items-center gap-1"
                            >
                              <Eye className="w-4 h-4" />
{t('affiliate.viewDetails')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
    
    {/* Withdrawal Request Modal - Outside main container */}
    {showWithdrawalModal && (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto z-[9999]"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh'
        }}
      >
        <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 lg:w-1/3 shadow-lg rounded-md bg-white">
          <div className="mt-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Request Withdrawal</h3>
              <button
                onClick={() => {
                  setShowWithdrawalModal(false);
                  setSubmitSuccess(false);
                  setSubmitError(null);
                  setFormData({
                    amount: 0,
                    payment_method: 'zelle',
                    payment_details: {}
                  });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {submitSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Request Sent!</h3>
                <p className="text-gray-600">
                  Your withdrawal request has been sent successfully. You will receive a response within 5 business days.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Balance Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-r from-tfe-blue-50 to-tfe-red-50 rounded-lg p-4 border border-tfe-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">{t('affiliate.availableForWithdrawal')}</h4>
                        <p className="text-2xl font-bold text-tfe-blue-900">${stats.available_balance.toFixed(2)}</p>
                      </div>
                      <div className="w-12 h-12 bg-tfe-blue-100 rounded-full flex items-center justify-center">
                        <DollarSign className="w-6 h-6 text-tfe-blue-600" />
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg p-4 border border-orange-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">{t('affiliate.pendingBalance')}</h4>
                        <p className="text-2xl font-bold text-orange-900">${stats.pending_balance.toFixed(2)}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {stats.next_withdrawal_date ? (() => {
                            const now = new Date();
                            const withdrawalDate = new Date(stats.next_withdrawal_date);
                            const diffInMs = withdrawalDate.getTime() - now.getTime();
                            
                            if (diffInMs <= 0) {
                              return t('affiliate.availableNow');
                            }
                            
                            const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
                            const diffInHours = Math.floor((diffInMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                            const diffInMinutes = Math.floor((diffInMs % (1000 * 60 * 60)) / (1000 * 60));
                            
                            if (diffInDays > 0) {
                              return `${t('affiliate.availableIn')} ${diffInDays} ${t('affiliate.days')}, ${diffInHours}h ${diffInMinutes}m`;
                            } else if (diffInHours > 0) {
                              return `${t('affiliate.availableIn')} ${diffInHours}h ${diffInMinutes}m`;
                            } else {
                              return `${t('affiliate.availableIn')} ${diffInMinutes}m`;
                            }
                          })() : 'No pending funds'}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                        <Clock className="w-6 h-6 text-orange-600" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
{t('affiliate.amountToRequest')} *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <DollarSign className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={stats.available_balance}
                      placeholder="0.00"
                      value={formData.amount || ''}
                      onChange={(e) => handleInputChange('amount', parseFloat(e.target.value) || 0)}
                      className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500 ${
                        formErrors.amount ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  {formErrors.amount && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.amount}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Maximum: ${stats.available_balance.toFixed(2)}
                  </p>
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
{t('affiliate.paymentMethod')} *
                  </label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => handleInputChange('payment_method', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500"
                  >
                    {paymentMethods.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                  {formErrors.payment_method && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.payment_method}</p>
                  )}
                </div>

                {/* Payment Details */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
{t('affiliate.paymentMethodDetails')} *
                  </label>
                  {renderPaymentDetailsForm()}
                  {formErrors.payment_details && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.payment_details}</p>
                  )}
                </div>

                {/* Submit Error */}
                {submitError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-600 text-sm">{submitError}</p>
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowWithdrawalModal(false);
                      setSubmitError(null);
                      setFormData({
                        amount: 0,
                        payment_method: 'zelle',
                        payment_details: {}
                      });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || stats.available_balance <= 0 || !!formErrors.amount}
                    className="px-6 py-2 bg-tfe-blue-600 text-white rounded-lg hover:bg-tfe-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSubmitting ? 'Sending...' : 'Request Withdrawal'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Withdrawal Details Modal */}
    {showDetailsModal && selectedWithdrawal && (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto z-[9999]"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh'
        }}
      >
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {t('affiliate.withdrawalDetails')}
              </h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('affiliate.requestId')}
                  </label>
                  <p className="text-sm text-gray-900 font-mono">
                    {selectedWithdrawal.request_id || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('affiliate.amount')}
                  </label>
                  <p className="text-sm text-gray-900 font-semibold">
                    ${selectedWithdrawal.amount?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('affiliate.paymentMethod')}
                  </label>
                  <p className="text-sm text-gray-900 capitalize">
                    {selectedWithdrawal.payment_method || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('affiliate.status')}
                  </label>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getWithdrawalStatusColor(selectedWithdrawal.status)}`}>
                    {getWithdrawalStatusIcon(selectedWithdrawal.status)}
                    {selectedWithdrawal.status || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Payment Details */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  {t('affiliate.paymentDetails')}
                </label>
                <div className="bg-gray-50 rounded-lg p-4">
                  {selectedWithdrawal.payment_details ? (
                    <div className="space-y-2">
                      {selectedWithdrawal.payment_method === 'zelle' && (
                        <>
                          {selectedWithdrawal.payment_details.email && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">{t('affiliate.email')}:</span>
                              <span className="text-sm text-gray-900">{selectedWithdrawal.payment_details.email}</span>
                            </div>
                          )}
                          {selectedWithdrawal.payment_details.phone && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">{t('affiliate.phone')}:</span>
                              <span className="text-sm text-gray-900">{selectedWithdrawal.payment_details.phone}</span>
                            </div>
                          )}
                        </>
                      )}
                      {selectedWithdrawal.payment_method === 'bank_transfer' && (
                        <>
                          {selectedWithdrawal.payment_details.bank_name && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">{t('affiliate.bankName')}:</span>
                              <span className="text-sm text-gray-900">{selectedWithdrawal.payment_details.bank_name}</span>
                            </div>
                          )}
                          {selectedWithdrawal.payment_details.account_holder && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">{t('affiliate.accountHolder')}:</span>
                              <span className="text-sm text-gray-900">{selectedWithdrawal.payment_details.account_holder}</span>
                            </div>
                          )}
                          {selectedWithdrawal.payment_details.account_number && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">{t('affiliate.accountNumber')}:</span>
                              <span className="text-sm text-gray-900 font-mono">{selectedWithdrawal.payment_details.account_number}</span>
                            </div>
                          )}
                          {selectedWithdrawal.payment_details.routing_number && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">{t('affiliate.routingNumber')}:</span>
                              <span className="text-sm text-gray-900 font-mono">{selectedWithdrawal.payment_details.routing_number}</span>
                            </div>
                          )}
                        </>
                      )}
                      {selectedWithdrawal.payment_method === 'stripe' && selectedWithdrawal.payment_details.email && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">{t('affiliate.email')}:</span>
                          <span className="text-sm text-gray-900">{selectedWithdrawal.payment_details.email}</span>
                        </div>
                      )}
                      {selectedWithdrawal.payment_details.transaction_id && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">{t('affiliate.transactionId')}:</span>
                          <span className="text-sm text-gray-900 font-mono">{selectedWithdrawal.payment_details.transaction_id}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">{t('affiliate.noAdminNotes')}</p>
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('affiliate.requestedAt')}
                  </label>
                  <p className="text-sm text-gray-900">
                    {formatDate(selectedWithdrawal.requested_at)}
                  </p>
                </div>
                {selectedWithdrawal.processed_at && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('affiliate.processedAt')}
                    </label>
                    <p className="text-sm text-gray-900">
                      {formatDate(selectedWithdrawal.processed_at)}
                    </p>
                  </div>
                )}
              </div>

              {/* Admin Notes */}
              {selectedWithdrawal.admin_notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    {t('affiliate.adminNotes')}
                  </label>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-gray-900">{selectedWithdrawal.admin_notes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end p-6 border-t border-gray-200">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                {t('affiliate.close')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
