import React from 'react';
import { XCircle, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';

export interface AffiliateDetail {
  affiliate_id: string;
  user_name: string;
  user_email: string;
  referral_code: string;
  created_at: string;
  current_level: number;
  total_clients: number;
  total_pages: number;
  available_balance: number;
  total_earned: number;
  first_page_translated_at?: string;
  can_request_withdrawal: boolean;
  next_withdrawal_date?: string;
}

export interface AffiliateDetailModalProps {
  affiliate: AffiliateDetail | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AffiliateDetailModal: React.FC<AffiliateDetailModalProps> = ({
  affiliate,
  isOpen,
  onClose
}) => {
  if (!isOpen || !affiliate) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-h-[90vh] overflow-y-auto max-w-2xl">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Affiliate Details</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Basic Information */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Name</label>
                  <p className="text-gray-900">{affiliate.user_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-gray-900">{affiliate.user_email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Referral Code</label>
                  <p className="text-gray-900 font-mono">{affiliate.referral_code}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Registration Date</label>
                  <p className="text-gray-900">{formatDate(affiliate.created_at)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Current Level</label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    affiliate.current_level === 2 
                      ? 'bg-purple-100 text-purple-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    Level {affiliate.current_level}
                  </span>
                </div>
              </div>
              
              {/* Withdrawal Status within Basic Information */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Withdrawal Status</h4>
                {(() => {
                  const firstPageDate = affiliate.first_page_translated_at;
                  const canWithdraw = affiliate.can_request_withdrawal;
                  const nextWithdrawalDate = affiliate.next_withdrawal_date;
                  
                  if (!firstPageDate) {
                    return (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="w-5 h-5 text-gray-500" />
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
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-5 h-5 text-green-600" />
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
                  
                  // Calculate remaining time
                  const now = new Date();
                  const withdrawalDate = new Date(nextWithdrawalDate!);
                  const diffInMs = withdrawalDate.getTime() - now.getTime();
                  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
                  const diffInHours = Math.floor((diffInMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                  const diffInMinutes = Math.floor((diffInMs % (1000 * 60 * 60)) / (1000 * 60));
                  
                  const remainingDays = Math.max(0, diffInDays);
                  const remainingHours = Math.max(0, diffInHours);
                  const remainingMinutes = Math.max(0, diffInMinutes);
                  
                  return (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-orange-600" />
                        <div>
                          <p className="text-sm font-medium text-orange-800">
                            Not available yet
                          </p>
                          <p className="text-xs text-orange-600 mt-1">
                            {remainingDays > 0 ? `${remainingDays} days` : 
                             remainingHours > 0 ? `${remainingHours} hours` : 
                             `${remainingMinutes} minutes`} remaining
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Performance Statistics */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Statistics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Total Clients</label>
                  <p className="text-2xl font-bold text-gray-900">{affiliate.total_clients}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Total Pages</label>
                  <p className="text-2xl font-bold text-gray-900">{affiliate.total_pages}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Available Balance</label>
                  <p className="text-2xl font-bold text-green-600">${affiliate.available_balance.toFixed(2)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Total Earned</label>
                  <p className="text-2xl font-bold text-blue-600">${affiliate.total_earned.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Commission Rate Info */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Commission Information</h3>
              <p className="text-sm text-gray-600">
                Current commission rate: <span className="font-semibold">
                  ${affiliate.current_level === 1 ? '0.50' : '1.00'} per page
                </span>
              </p>
              {affiliate.current_level === 1 && (
                <p className="text-sm text-gray-600 mt-1">
                  Pages to next level: <span className="font-semibold">
                    {Math.max(0, 200 - affiliate.total_pages)}
                  </span>
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
