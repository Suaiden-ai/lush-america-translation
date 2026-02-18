import { useState } from 'react';
import { X, Copy, CheckCircle, DollarSign, Mail, Phone, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ZellePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  documentId: string;
  userId: string;
  documentDetails: {
    filename: string;
    pages: number;
    translationType: string;
  };
}

export function ZellePaymentModal({
  isOpen,
  onClose,
  amount,
  documentId,
  userId,
  documentDetails
}: ZellePaymentModalProps) {
  const [step, setStep] = useState<'instructions' | 'confirmation' | 'completed'>('instructions');
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dados Zelle da empresa (você deve configurar estes dados)
  const ZELLE_INFO = {
    email: 'admin@suaiden.com',
    businessName: 'Lush America Translations'
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleConfirmPayment = async () => {
    if (!confirmationCode.trim()) {
      setError('Please enter the confirmation code from your Zelle transaction');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Criar registro de pagamento Zelle
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          user_id: userId,
          document_id: documentId,
          amount: amount,
          payment_method: 'zelle',
          status: 'pending_verification',
          zelle_confirmation_code: confirmationCode.trim(),
          created_at: new Date().toISOString()
        });

      if (paymentError) {
        throw new Error('Failed to record Zelle payment');
      }

      // Atualizar status do documento para "pending_payment_verification"
      const { error: docError } = await supabase
        .from('documents')
        .update({
          status: 'pending_payment_verification',
          payment_method: 'zelle'
        })
        .eq('id', documentId);

      if (docError) {
        throw new Error('Failed to update document status');
      }

      setStep('completed');

    } catch (err: any) {
      console.error('Error confirming Zelle payment:', err);
      setError(err.message || 'Failed to confirm payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (step === 'completed') {
      // Redirecionar para dashboard quando completado
      window.location.href = '/dashboard';
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={step === 'completed' ? undefined : onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 z-10 max-h-[90vh] overflow-y-auto">

        {step === 'instructions' && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-900">Pay with Zelle</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Amount Display */}
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600 mb-1">Payment Amount</p>
                <p className="text-3xl font-bold text-green-700">${amount}.00</p>
                <p className="text-xs text-gray-500 mt-1">
                  {documentDetails.filename} • {documentDetails.pages} page{documentDetails.pages !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Instructions */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Step 1: Send Payment via Zelle
                </h3>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800 mb-3">
                    Use your banking app or online banking to send money via Zelle to:
                  </p>

                  <div className="space-y-3">
                    {/* Email Option */}
                    <div className="bg-white rounded-lg p-3 border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Mail className="w-4 h-4 text-blue-600" />
                          <span className="font-mono text-sm">{ZELLE_INFO.email}</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(ZELLE_INFO.email, 'email')}
                          className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm"
                        >
                          {copied === 'email' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          <span>{copied === 'email' ? 'Copied!' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-yellow-800">
                      <strong>Important:</strong> Make sure to send exactly <strong>${amount}.00</strong> and
                      include your name in the memo/message field.
                    </p>
                  </div>
                </div>

                {/* Next Step Button */}
                <button
                  onClick={() => setStep('confirmation')}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
                >
                  I've Sent the Payment →
                </button>
              </div>
            </div>
          </>
        )}

        {step === 'confirmation' && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Confirm Your Payment</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="text-center">
                <DollarSign className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Great! Now please confirm your payment
                </h3>
                <p className="text-gray-600 text-sm">
                  After sending ${amount}.00 via Zelle, you should receive a confirmation code or transaction ID.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="confirmationCode" className="block text-sm font-medium text-gray-700 mb-2">
                    Zelle Confirmation Code / Transaction ID
                  </label>
                  <input
                    id="confirmationCode"
                    type="text"
                    value={confirmationCode}
                    onChange={(e) => setConfirmationCode(e.target.value)}
                    placeholder="Enter your Zelle confirmation code"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This is usually a combination of letters and numbers (e.g., "ABC123XYZ")
                  </p>
                </div>

                {error && (
                  <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}

                <div className="flex space-x-3">
                  <button
                    onClick={() => setStep('instructions')}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleConfirmPayment}
                    disabled={!confirmationCode.trim() || isSubmitting}
                    className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSubmitting ? 'Confirming...' : 'Confirm Payment'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {step === 'completed' && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Payment Submitted</h2>
            </div>

            <div className="p-6 text-center space-y-6">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Payment Confirmation Received!
                </h3>
                <p className="text-gray-600 text-sm">
                  Thank you for your Zelle payment. We have received your confirmation code and
                  will verify your payment within 1-2 business days.
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <Clock className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-yellow-800 mb-1">
                      What happens next?
                    </p>
                    <ul className="text-xs text-yellow-700 space-y-1">
                      <li>• We'll verify your Zelle payment (1-2 business days)</li>
                      <li>• Once verified, we'll start processing your document</li>
                      <li>• You'll receive email updates on the status</li>
                      <li>• Translation typically takes 2-3 business days</li>
                    </ul>
                  </div>
                </div>
              </div>

              <button
                onClick={handleClose}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
