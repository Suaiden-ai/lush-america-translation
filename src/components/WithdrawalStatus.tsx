import React from 'react';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';

interface WithdrawalStatusProps {
  canRequestWithdrawal: boolean;
  daysUntilAvailable: number | null | undefined;
  availableBalance: number;
}

export function WithdrawalStatus({ 
  canRequestWithdrawal, 
  daysUntilAvailable, 
  availableBalance 
}: WithdrawalStatusProps) {
  const { t } = useI18n();

  if (canRequestWithdrawal) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-green-900">
              {t('affiliate.withdrawalAvailable')}
            </h3>
            <p className="text-sm text-green-700">
              {t('affiliate.youCanRequestWithdrawal')} ${availableBalance.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (daysUntilAvailable === null) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-blue-900">
              {t('affiliate.withdrawalNotAvailable')}
            </h3>
            <p className="text-sm text-blue-700">
              {t('affiliate.commissionsPendingMaturation')}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              {t('affiliate.availableBalance')}: ${availableBalance.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
          <Clock className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-blue-900">
            {t('affiliate.withdrawalNotAvailable')}
          </h3>
          <p className="text-sm text-blue-700">
            {daysUntilAvailable === 1 
              ? t('affiliate.oneDayRemaining')
              : t('affiliate.daysRemaining').replace('{days}', (daysUntilAvailable || 0).toString())
            }
          </p>
          <p className="text-xs text-blue-600 mt-1">
            {t('affiliate.availableBalance')}: ${availableBalance.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}
