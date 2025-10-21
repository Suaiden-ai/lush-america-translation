import { DollarSign, Users, FileText, TrendingUp, Star, HelpCircle, Clock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAffiliate } from '../../hooks/useAffiliate';
import { useI18n } from '../../contexts/I18nContext';
import { ArcProgressBar } from '../../components/ArcProgressBar';
import { CommissionBadge } from '../../components/CommissionBadge';

export function AffiliateOverview() {
  const { user } = useAuth();
  const { stats, loading, error } = useAffiliate(user?.id);
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <Users className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">{t('affiliate.noDataFound')}</h3>
        <p className="text-gray-600">{t('affiliate.noAffiliateData')}</p>
      </div>
    );
  }


  const cards = [
    {
      title: t('affiliate.availableBalance'),
      value: `$${stats.available_balance.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      description: t('affiliate.availableForWithdrawalDesc')
    },
    {
      title: t('affiliate.pendingBalance'),
      value: `$${stats.pending_balance.toFixed(2)}`,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      description: stats.next_withdrawal_date ? (() => {
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
      })() : 'No pending funds'
    },
    {
      title: t('affiliate.totalEarned'),
      value: `$${stats.total_earned.toFixed(2)}`,
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      description: t('affiliate.completeHistory')
    },
    {
      title: t('affiliate.referredClients'),
      value: stats.total_clients.toString(),
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      description: t('affiliate.totalClientsCount')
    },
    {
      title: t('affiliate.totalPages'),
      value: stats.total_pages.toString(),
      icon: FileText,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      description: t('affiliate.byYourClients')
    }
  ];

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={index} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-600 mb-1">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{card.description}</p>
                </div>
                <div className={`w-12 h-12 ${card.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-6 h-6 ${card.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main content - Reorganized with better spacing */}
      <div className="space-y-8">
        {/* Level Progress - Vertical and centered */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-semibold text-gray-900">{t('affiliate.levelProgress')}</h3>
            </div>
            <CommissionBadge 
              level={stats.current_level} 
              rate={stats.current_level === 1 ? 0.50 : 1.00}
              levelText={`${t('affiliate.level')} ${stats.current_level}`}
              perPageText={t('affiliate.perPage')}
            />
          </div>
          
          <div className="flex flex-col items-center space-y-4">
            {/* Arc Progress Bar - Centered */}
            <div className="flex justify-center">
              <ArcProgressBar 
                current={stats.total_pages} 
                target={200} 
                color="blue"
                currentLevel={stats.current_level}
                maxLevelText={t('affiliate.maxLevel')}
                maxLevelReachedText={t('affiliate.maximumLevelReached')}
                pagesToNextLevelText={t('affiliate.pagesToNextLevel')}
              />
            </div>
            
            {/* Progress Info - Centered */}
            <div className="text-center">
              {stats.current_level === 1 ? (
                <div className="space-y-2">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">{200 - stats.total_pages}</span> {t('affiliate.pagesToReachLevel2')}
                  </div>
                  <div className="text-xs text-gray-500">
                    {t('affiliate.earnXPerPage').replace('{rate}', '$1.00')} {t('affiliate.insteadOf')} $0.50
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <Star className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium text-gray-900">{t('affiliate.level2Achieved')} 🎉</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {t('affiliate.earningXPerPage').replace('{rate}', '$1.00')}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>


      {/* How it Works - Always Visible */}
      <div className="bg-gradient-to-r from-tfe-blue-50 to-tfe-red-50 rounded-lg p-6 border border-tfe-blue-200">
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="w-5 h-5 text-tfe-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">{t('affiliate.howItWorks')}</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">{t('affiliate.howToEarnCommissions')}</h4>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• {t('affiliate.shareYourReferralCode')}</li>
              <li>• {t('affiliate.clientsRegisterUsingCode')}</li>
              <li>• {t('affiliate.earnCommissionPerPage')}</li>
              <li>• {t('affiliate.commissionsAfterPayment')}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">{t('affiliate.withdrawalRequestRules')}</h4>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• {t('affiliate.balanceAvailableAfter30Days')}</li>
              <li>• {t('affiliate.requestEvery30Days')}</li>
              <li>• {t('affiliate.multiplePaymentMethods')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
