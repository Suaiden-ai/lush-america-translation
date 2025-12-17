import { Eye } from 'lucide-react';
import { MappedPayment } from '../types/payments.types';
import { getStatusColor, formatPaymentMethod, formatDate } from '../utils/paymentsUtils';

interface PaymentsTableDesktopProps {
  payments: MappedPayment[];
  onViewDocument: (payment: MappedPayment) => void;
}

export function PaymentsTableDesktop({ payments, onViewDocument }: PaymentsTableDesktopProps) {
  const getUserDisplayName = (payment: MappedPayment): string => {
    if (payment.user_role === 'authenticator' && payment.client_name && payment.client_name !== 'Cliente Padrão') {
      return `${payment.client_name} (${payment.user_name})`;
    }
    if (payment.authenticated_by_name && payment.client_name && payment.client_name !== 'Cliente Padrão') {
      return `${payment.client_name} (${payment.authenticated_by_name})`;
    }
    return payment.user_name || 'Unknown';
  };

  const getDateToShow = (payment: MappedPayment): string => {
    const dateToShow = payment.payment_date || payment.authentication_date || payment.created_at;
    if (dateToShow) {
      try {
        return formatDate(dateToShow);
      } catch (error) {
        console.error('Error formatting date:', error);
        return '-';
      }
    }
    return '-';
  };

  return (
    <div className="hidden sm:block overflow-x-auto w-full relative">
      <div className="absolute top-0 right-0 bg-gradient-to-l from-white to-transparent w-8 h-full pointer-events-none z-10"></div>
      <table 
        className="min-w-full divide-y divide-gray-200" 
        style={{ 
          minWidth: '100%', 
          tableLayout: 'fixed',
          width: '100%'
        }}
      >
        <colgroup>
          <col style={{ width: '25%', minWidth: '25%', maxWidth: '25%' }} />
          <col style={{ width: '23%', minWidth: '23%', maxWidth: '23%' }} />
          <col style={{ width: '6%', minWidth: '6%', maxWidth: '6%' }} />
          <col style={{ width: '7%', minWidth: '7%', maxWidth: '7%' }} />
          <col style={{ width: '6%', minWidth: '6%', maxWidth: '6%' }} />
          <col style={{ width: '7%', minWidth: '7%', maxWidth: '7%' }} />
          <col style={{ width: '16%', minWidth: '16%', maxWidth: '16%' }} />
          <col style={{ width: '5%', minWidth: '5%', maxWidth: '5%' }} />
          <col style={{ width: '5%', minWidth: '5%', maxWidth: '5%' }} />
        </colgroup>
        <thead className="bg-gray-50">
          <tr>
            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              USER/CLIENT
            </th>
            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Document
            </th>
            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Amount
            </th>
            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Payment Method
            </th>
            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Translations
            </th>
            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Authenticator
            </th>
            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Details
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {payments.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                No payments found matching your criteria.
              </td>
            </tr>
          ) : (
            payments.map((payment) => {
              const displayName = getUserDisplayName(payment);
              return (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-2 py-4">
                    <div className="text-sm font-medium text-gray-900 truncate" title={displayName}>
                      {displayName}
                    </div>
                    <div className="text-xs text-gray-500 truncate" title={payment.user_email || 'No email'}>
                      {payment.user_email || 'No email'}
                    </div>
                  </td>
                  <td className="px-2 py-4">
                    <div className="text-sm text-gray-900 truncate" title={payment.document_filename || 'Unknown'}>
                      {payment.document_filename || 'Unknown'}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {payment.document_id ? `${payment.document_id.substring(0, 8)}...` : 'No ID'}
                    </div>
                  </td>
                  <td className="px-2 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      ${payment.amount.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {payment.currency}
                    </div>
                  </td>
                  <td className="px-2 py-4">
                    <div className="text-xs text-gray-900">
                      {payment.payment_method ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          {formatPaymentMethod(payment.payment_method)}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">N/A</span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-4">
                    <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(payment.status)}`}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-2 py-4">
                    <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(payment.document_status)}`}>
                      {payment.document_status}
                    </span>
                  </td>
                  <td className="px-2 py-4">
                    <div className="text-sm text-gray-900 truncate" title={payment.authenticated_by_name || 'N/A'}>
                      {payment.authenticated_by_name || 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {payment.authenticated_by_email || 'No auth'}
                    </div>
                  </td>
                  <td className="px-2 py-4 text-sm text-gray-900">
                    {getDateToShow(payment)}
                  </td>
                  <td className="px-2 py-4 text-sm font-medium">
                    <button
                      onClick={() => onViewDocument(payment)}
                      className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                      title={`Details for document ${payment.document_filename}`}
                      aria-label={`Details for document ${payment.document_filename}`}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
