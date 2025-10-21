import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';

interface WithdrawalTimerProps {
  firstPageTranslatedAt: string | null;
  canRequestWithdrawal: boolean;
  daysUntilWithdrawalAvailable?: number;
}

export function WithdrawalTimer({ 
  firstPageTranslatedAt, 
  canRequestWithdrawal, 
  daysUntilWithdrawalAvailable = 0 
}: WithdrawalTimerProps) {
  const { t } = useI18n();
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isAvailable, setIsAvailable] = useState(canRequestWithdrawal);

  useEffect(() => {
    if (!firstPageTranslatedAt) {
      setTimeLeft(t('affiliate.noTranslatedPages'));
      return;
    }

    const updateTimer = () => {
      const firstPageDate = new Date(firstPageTranslatedAt);
      const now = new Date();
      const diffInMs = now.getTime() - firstPageDate.getTime();
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
      const diffInHours = Math.floor((diffInMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const diffInMinutes = Math.floor((diffInMs % (1000 * 60 * 60)) / (1000 * 60));

      if (diffInDays >= 30) {
        setIsAvailable(true);
        setTimeLeft(t('affiliate.withdrawalAvailableNow'));
      } else {
        setIsAvailable(false);
        const remainingDays = 30 - diffInDays;
        const remainingHours = 23 - diffInHours;
        const remainingMinutes = 59 - diffInMinutes;
        
        if (remainingDays > 0) {
          setTimeLeft(t('affiliate.withdrawalAvailableIn')
            .replace('{days}', remainingDays.toString())
            .replace('{hours}', remainingHours.toString())
            .replace('{minutes}', remainingMinutes.toString()));
        } else {
          setTimeLeft(t('affiliate.withdrawalAvailableInHours')
            .replace('{hours}', remainingHours.toString())
            .replace('{minutes}', remainingMinutes.toString()));
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [firstPageTranslatedAt, canRequestWithdrawal, t]);

  if (!firstPageTranslatedAt) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-600">
              {t('affiliate.noTranslatedPages')}
            </p>
            <p className="text-xs text-gray-500">
              {t('affiliate.startEarningToUnlockWithdrawals')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg p-4 border ${
      isAvailable 
        ? 'bg-green-50 border-green-200' 
        : 'bg-yellow-50 border-yellow-200'
    }`}>
      <div className="flex items-center gap-3">
        {isAvailable ? (
          <CheckCircle className="w-5 h-5 text-green-600" />
        ) : (
          <Clock className="w-5 h-5 text-yellow-600" />
        )}
        <div className="flex-1">
          <p className={`text-sm font-medium ${
            isAvailable ? 'text-green-800' : 'text-yellow-800'
          }`}>
            {isAvailable ? t('affiliate.withdrawalAvailable') : t('affiliate.withdrawalNotAvailable')}
          </p>
          <p className={`text-xs ${
            isAvailable ? 'text-green-600' : 'text-yellow-600'
          }`}>
            {timeLeft}
          </p>
        </div>
        {isAvailable && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-600 font-medium">
              {t('affiliate.ready')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
