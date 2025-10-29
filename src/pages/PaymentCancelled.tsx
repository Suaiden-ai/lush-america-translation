import React, { useState, useEffect, useRef } from 'react';
import { XCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Logger } from '../lib/loggingHelpers';
import { ActionTypes } from '../types/actionTypes';

export function PaymentCancelled() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cleanupComplete, setCleanupComplete] = useState(false);
  const hasExecutedRef = useRef(false); // Usar useRef para evitar problemas com StrictMode
  const executionIdRef = useRef<string | null>(null); // ID único para cada execução

  useEffect(() => {
    // Chamar a função de limpeza apenas uma vez quando a página carregar
    if (!hasExecutedRef.current && !cleanupComplete && !isLoading) {
      hasExecutedRef.current = true;
      executionIdRef.current = `cleanup_${Date.now()}_${Math.random()}`;
      console.log('DEBUG: Executando cleanup com ID:', executionIdRef.current);
      cleanupDraftDocuments();
    }
  }, []); // Array vazio para executar apenas uma vez

  // Função para chamar a Edge Function que limpa o documento
  const cleanupDraftDocuments = async () => {
    // Evitar chamadas duplas - múltiplas proteções
    if (isLoading || hasExecutedRef.current === false) {
      console.log('DEBUG: cleanupDraftDocuments já está executando ou não foi autorizado, ignorando');
      return;
    }

    console.log('DEBUG: Iniciando cleanupDraftDocuments - ID:', executionIdRef.current);
    setIsLoading(true);
    setError(null);
    setCleanupComplete(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('Usuário não autenticado. Faça login para continuar.');
      }

      const userId = session.user.id;
      console.log('DEBUG: Iniciando limpeza para usuário:', {
        userId: userId,
        userEmail: session.user.email,
        timestamp: new Date().toISOString()
      });

      const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cleanup-draft-documents`;

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          userId: userId,  // Garantir que estamos usando o userId correto
          executionId: executionIdRef.current // ID único para rastrear execução
        }),
      });

      const result = await response.json();
      console.log('DEBUG: Resposta da edge function:', {
        status: response.status,
        ok: response.ok,
        userId: userId, // Log do userId que foi enviado
        result
      });

      if (!response.ok) {
        console.error('ERROR: Falha ao chamar edge function:', {
          status: response.status,
          statusText: response.statusText,
          userId: userId, // Log do userId que foi enviado
          result
        });
        throw new Error(result.error || 'Falha ao chamar a função de limpeza.');
      }

      console.log('DEBUG: Documento de rascunho limpo com sucesso para usuário:', {
        userId: userId,
        result
      });
      
      // Log de cancelamento de checkout
      try {
        await Logger.log(
          ActionTypes.PAYMENT.CANCELLED,
          `User cancelled checkout session`,
          {
            entityType: 'checkout',
            entityId: userId,
            metadata: {
              user_id: userId,
              user_email: session.user.email,
              reason: 'user_cancelled',
              cleanup_result: result,
              timestamp: new Date().toISOString()
            },
            affectedUserId: userId,
            performerType: 'user'
          }
        );
        console.log('✅ Checkout cancellation logged successfully');
      } catch (logError) {
        console.error('Error logging checkout cancellation:', logError);
      }
      
      setCleanupComplete(true);

    } catch (err: any) {
      console.error('DEBUG: Erro detalhado ao limpar documento:', {
        error: err,
        message: err.message,
        timestamp: new Date().toISOString()
      });
      setError(err.message || 'Ocorreu um erro ao limpar o documento. Por favor, contate o suporte.');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusMessage = () => {
    if (isLoading) {
      return "Cleaning up your temporary document...";
    }
    if (error) {
      return "An error occurred while cleaning up your document.";
    }
    if (cleanupComplete) {
      return "The payment was cancelled and your document has been removed.";
    }
    return "The payment was cancelled.";
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 max-w-md w-full text-center">
        {/* Icone e Título */}
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <XCircle className="w-10 h-10 text-red-600" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
          Payment Cancelled
        </h1>
        <p className="text-gray-500 mt-2">
          {getStatusMessage()}
        </p>
        {error && !isLoading && (
          <p className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded-md">{error}</p>
        )}

        {/* O que aconteceu */}
        <div className="bg-gray-50/70 rounded-lg p-4 my-6 text-left">
          <h2 className="font-semibold text-gray-800 mb-3">What happened?</h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start"><span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>You cancelled the payment process.</li>
            <li className="flex items-start"><span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>Your document was not sent for translation.</li>
            <li className="flex items-start"><span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>No charge was made to your account.</li>
          </ul>
        </div>

        {/* Botão de Ação */}
        <div className="mb-6">
          <button
            onClick={async () => {
              // Se já executou o cleanup, apenas navegar
              if (cleanupComplete) {
                navigate('/customer-dashboard');
                return;
              }
              
              // Se não executou, executar e depois navegar
              await cleanupDraftDocuments();
              navigate('/customer-dashboard');
            }}
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <ArrowLeft className="w-5 h-5 mr-2" />
            )}
            <span>
              {isLoading ? 'Cleaning...' : 'Back to Dashboard'}
            </span>
          </button>
        </div>

        {/* Informações de Contato */}
        <div className="pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Need help? Contact us at <a href="mailto:support@lushamerica.com" className="font-medium text-blue-600 hover:underline">support@lushamerica.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}