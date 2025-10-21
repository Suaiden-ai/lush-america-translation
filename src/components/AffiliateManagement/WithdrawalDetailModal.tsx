import React from 'react';
import { XCircle, CheckCircle, XCircle as XCircleIcon, Clock } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';

export interface PaymentDetails {
  email?: string;
  phone?: string;
  bank_name?: string;
  account_holder?: string;
  account_number?: string;
  routing_number?: string;
}

export interface WithdrawalDetail {
  request_id: string;
  affiliate_name: string;
  affiliate_email: string;
  amount: number;
  payment_method: string;
  status: string;
  requested_at: string;
  payment_details?: PaymentDetails;
  admin_notes?: string;
}

export interface WithdrawalDetailModalProps {
  withdrawal: WithdrawalDetail | null;
  isOpen: boolean;
  onClose: () => void;
}

export const WithdrawalDetailModal: React.FC<WithdrawalDetailModalProps> = ({
  withdrawal,
  isOpen,
  onClose
}) => {
  if (!isOpen || !withdrawal) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-3 h-3" />;
      case 'approved':
        return <CheckCircle className="w-3 h-3" />;
      case 'rejected':
        return <XCircleIcon className="w-3 h-3" />;
      case 'completed':
        return <CheckCircle className="w-3 h-3" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Payment Request Details</h2>
            <button
              onClick={onClose}
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
                  <p className="text-gray-900">{withdrawal.affiliate_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Affiliate Email</label>
                  <p className="text-gray-900">{withdrawal.affiliate_email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Amount</label>
                  <p className="text-2xl font-bold text-green-600">${withdrawal.amount.toFixed(2)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(withdrawal.status)}`}>
                    {getStatusIcon(withdrawal.status)}
                    {withdrawal.status === 'pending' ? 'Pending' :
                     withdrawal.status === 'approved' ? 'Approved' :
                     withdrawal.status === 'rejected' ? 'Rejected' :
                     withdrawal.status === 'completed' ? 'Completed' : withdrawal.status}
                  </span>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Request Date</label>
                  <p className="text-gray-900">{formatDate(withdrawal.requested_at)}</p>
                </div>
              </div>
            </div>

            {/* Payment Method Details */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Method Details</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">Payment Method</label>
                  <p className="text-gray-900 capitalize">{withdrawal.payment_method.replace('_', ' ')}</p>
                </div>
                
                {withdrawal.payment_method === 'zelle' && (
                  <div className="space-y-2">
                    {withdrawal.payment_details?.email && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Zelle Email</label>
                        <p className="text-gray-900 font-mono">{withdrawal.payment_details.email}</p>
                      </div>
                    )}
                    {withdrawal.payment_details?.phone && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Zelle Phone</label>
                        <p className="text-gray-900 font-mono">{withdrawal.payment_details.phone}</p>
                      </div>
                    )}
                  </div>
                )}

                {withdrawal.payment_method === 'bank_transfer' && (
                  <div className="space-y-2">
                    {withdrawal.payment_details?.bank_name && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Bank Name</label>
                        <p className="text-gray-900">{withdrawal.payment_details.bank_name}</p>
                      </div>
                    )}
                    {withdrawal.payment_details?.account_holder && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Account Holder</label>
                        <p className="text-gray-900">{withdrawal.payment_details.account_holder}</p>
                      </div>
                    )}
                    {withdrawal.payment_details?.account_number && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Account Number</label>
                        <p className="text-gray-900 font-mono">{withdrawal.payment_details.account_number}</p>
                      </div>
                    )}
                    {withdrawal.payment_details?.routing_number && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Routing Number</label>
                        <p className="text-gray-900 font-mono">{withdrawal.payment_details.routing_number}</p>
                      </div>
                    )}
                  </div>
                )}

                {withdrawal.payment_method === 'stripe' && withdrawal.payment_details?.email && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Stripe Email</label>
                    <p className="text-gray-900 font-mono">{withdrawal.payment_details.email}</p>
                  </div>
                )}

                {withdrawal.payment_method === 'other' && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Other Details</label>
                    <p className="text-gray-900">{JSON.stringify(withdrawal.payment_details, null, 2)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Admin Notes */}
            {withdrawal.admin_notes && (
              <div className="bg-yellow-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Admin Notes</h3>
                <p className="text-gray-700">{withdrawal.admin_notes}</p>
              </div>
            )}
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
