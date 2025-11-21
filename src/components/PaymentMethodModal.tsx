import { X, CreditCard, DollarSign } from 'lucide-react';
import { calculateCardAmountWithFees, calculateCardFee, formatAmount } from '../utils/stripeFeeCalculator';

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStripe: () => void;
  onSelectZelle: (amount: number, documentId?: string, filename?: string, pages?: number) => void;
  amount: number;
  documentId?: string;
  filename?: string;
  pages?: number;
}

export function PaymentMethodModal({ 
  isOpen, 
  onClose, 
  onSelectStripe, 
  onSelectZelle, 
  amount,
  documentId,
  filename,
  pages 
}: PaymentMethodModalProps) {
  if (!isOpen) return null;

  // Calcular valor com taxa do Stripe
  const stripeAmount = calculateCardAmountWithFees(amount);
  const stripeFee = calculateCardFee(stripeAmount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Choose Payment Method</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Amount Display */}
        <div className="bg-blue-50 rounded-lg p-4 mb-6 text-center">
          <p className="text-sm text-gray-600 mb-1">Total Amount</p>
          <p className="text-3xl font-bold text-blue-900">${formatAmount(amount)}</p>
        </div>

        {/* Payment Options */}
        <div className="space-y-4">
          {/* Stripe Option */}
          <button
            onClick={onSelectStripe}
            className="w-full p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-900">Stripe</h3>
                  <span className="text-sm font-semibold text-blue-600">${formatAmount(stripeAmount)}</span>
                </div>
                <p className="text-xs text-gray-500 mb-1">
                  Base: ${formatAmount(amount)} + Processing fee: ${formatAmount(stripeFee)}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-green-600 font-medium">✓ Instant processing</p>
                </div>
              </div>
              <div className="text-blue-600 group-hover:text-blue-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>

          {/* Zelle Option */}
          <button
            onClick={() => onSelectZelle(amount, documentId, filename, pages)}
            className="w-full p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-600 to-blue-600 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-semibold text-gray-900 group-hover:text-green-900">Zelle</h3>
                <p className="text-sm text-gray-600">Direct bank transfer via email/phone</p>
              </div>
              <div className="text-green-600 group-hover:text-green-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>
        </div>

        {/* Footer Info */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600 text-center">
            Both payment methods are secure. Stripe includes processing fees and offers instant processing. 
            Zelle requires manual verification (1-2 business days).
          </p>
        </div>
      </div>
    </div>
  );
}
