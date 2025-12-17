import { Eye } from 'lucide-react';
import { MappedPayment } from '../types/payments.types';
import { getStatusColor, formatPaymentMethod, formatDate } from '../utils/paymentsUtils';

interface PaymentsTableMobileProps {
  payments: MappedPayment[];
  onViewDocument: (payment: MappedPayment) => void;
}

export function PaymentsTableMobile({ payments, onViewDocument }: PaymentsTableMobileProps) {
  if (payments.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-gray-500">
        No payments found matching your criteria.
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 sm:p-4">
      {payments.map((payment) => (
        <div key={payment.id} className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {payment.user_role === 'authenticator' && payment.client_name && payment.client_name !== 'Cliente Padrão'
                  ? `${payment.client_name} (${payment.user_name})`
                  : payment.authenticated_by_name && payment.client_name && payment.client_name !== 'Cliente Padrão'
                  ? `${payment.client_name} (${payment.authenticated_by_name})`
                  : payment.user_name || 'Unknown'}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {payment.user_email || 'No email'}
              </div>
            </div>
            <div className="ml-2 flex-shrink-0">
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(payment.status)}`}>
                {payment.status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-gray-500">Amount:</span>
              <div className="font-medium text-gray-900">${payment.amount.toFixed(2)} {payment.currency}</div>
            </div>
            <div>
              <span className="text-gray-500">Document:</span>
              <div className="font-medium text-gray-900 truncate">{payment.document_filename || 'Unknown'}</div>
            </div>
            <div>
              <span className="text-gray-500">Doc Status:</span>
              <div className="font-medium text-gray-900">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(payment.document_status)}`}>
                  {payment.document_status}
                </span>
              </div>
            </div>
            <div>
              <span className="text-gray-500">Payment Method:</span>
              <div className="font-medium text-gray-900">
                {formatPaymentMethod(payment.payment_method)}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Authenticator:</span>
              <div className="font-medium text-gray-900 truncate">
                {payment.authenticated_by_name || 'N/A'}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Date:</span>
              <div className="font-medium text-gray-900">
                {formatDate(payment.payment_date)}
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-300 flex items-center justify-between">
            <div className="text-xs text-gray-500">
              ID: {payment.id.substring(0, 8)}...
            </div>
            <button
              onClick={() => onViewDocument(payment)}
              className="text-blue-600 hover:text-blue-900"
              aria-label={`Details for document ${payment.document_filename}`}
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
