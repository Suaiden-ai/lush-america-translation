import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Copy, CheckCircle, DollarSign, Mail, Phone, AlertCircle, Clock, ArrowLeft, Upload, X } from 'lucide-react';
import { supabase, STORAGE_BUCKETS } from '../lib/supabase';
import { Logger } from '../lib/loggingHelpers';
import { ActionTypes } from '../types/actionTypes';

export function ZelleCheckout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [step, setStep] = useState<'instructions' | 'confirmation' | 'completed'>('instructions');
  const [copied, setCopied] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [documentData, setDocumentData] = useState<any>(null);
  const [paymentReceipt, setPaymentReceipt] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const shouldCleanupRef = useRef(true); // Controla se deve limpar documento
  const hasLoggedPageOpen = useRef(false); // Controla se já logou a abertura da página

  // Zelle company data
  const ZELLE_INFO = {
    email: 'info@thefutureofenglish.com',
    businessName: 'Lush America Translations'
  };

  // Extract URL parameters
  const documentId = searchParams.get('document_id');
  const amount = searchParams.get('amount');
  const filename = searchParams.get('filename');
  const pages = searchParams.get('pages');

  // Função para limpar documento não pago se usuário sair da página
  const cleanupDocument = async () => {
    if (!documentId || paymentCompleted || !shouldCleanupRef.current) return;

    try {
      // Verificar se já existe um pagamento para este documento
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id')
        .eq('document_id', documentId)
        .single();

      // Se já existe pagamento, não excluir
      if (existingPayment) return;

      console.log('🧹 Limpando documento sem pagamento:', documentId);

      // Buscar dados do documento para exclusão do storage
      const { data: document } = await supabase
        .from('documents')
        .select('user_id, filename, file_url')
        .eq('id', documentId)
        .single();

      if (document) {
        // Excluir arquivo do storage se existir
        if (document.file_url) {
          // Extrair path do storage da URL
          const urlParts = document.file_url.split('/');
          const fileName = urlParts[urlParts.length - 1];
          const filePath = `${document.user_id}/${fileName}`;

          await supabase.storage
            .from(STORAGE_BUCKETS.DOCUMENTS)
            .remove([filePath]);

          console.log('🗑️ Arquivo removido do storage:', filePath);
        }

        // Excluir registro do documento
        await supabase
          .from('documents')
          .delete()
          .eq('id', documentId);

        console.log('🗑️ Documento removido do banco de dados:', documentId);
      }
    } catch (error) {
      console.error('❌ Erro ao limpar documento:', error);
    }
  };

  useEffect(() => {
    if (!documentId || !amount) {
      navigate('/dashboard');
      return;
    }

    // Log da abertura da página Zelle checkout
    if (!hasLoggedPageOpen.current && documentId) {
      hasLoggedPageOpen.current = true;
      Logger.log(
        ActionTypes.PAYMENT.ZELLE_CHECKOUT_OPENED,
        `Zelle checkout page opened`,
        {
          entityType: 'checkout',
          entityId: documentId || undefined,
          metadata: {
            document_id: documentId || undefined,
            amount: amount || undefined,
            pages: pages || undefined,
            filename: filename || undefined,
            timestamp: new Date().toISOString()
          },
          affectedUserId: documentData?.user_id,
          performerType: 'user'
        }
      );
    }

    const fetchDocumentData = async () => {
      try {
        const { data: document, error } = await supabase
          .from('documents')
          .select('*')
          .eq('id', documentId)
          .single();

        if (error) throw error;
        setDocumentData(document);

        // Debug: Verificar campos do documento
        console.log('📄 Document data loaded:', {
          id: document.id,
          filename: document.filename,
          original_filename: document.original_filename,
          file_url: document.file_url
        });

        // Arquivo já deve estar no Storage se chegou até aqui
        if (document.file_url) {
          console.log('✅ Document already has file_url:', document.file_url);
        } else {
          console.warn('⚠️ Document has no file_url - this should not happen in the new flow');
        }
      } catch (err) {
        console.error('Error fetching document:', err);
        setError('Failed to load document information');
      } finally {
        setLoading(false);
      }
    };

    fetchDocumentData();
  }, [documentId, amount, navigate, filename]);

  // Detectar abandono da página - apenas nos casos reais de saída
  useEffect(() => {
    if (!documentId) return;

    let isComponentMounted = true;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!paymentCompleted && shouldCleanupRef.current && isComponentMounted) {
        // Mostrar aviso ao usuário
        e.preventDefault();
        e.returnValue = 'Your document upload will be lost if you leave. Are you sure?';

        // Tentar executar limpeza
        cleanupDocument().catch(console.error);

        return 'Your document upload will be lost if you leave. Are you sure?';
      }
    };

    // Usar apenas beforeunload para casos reais de saída
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      isComponentMounted = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [documentId]);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleReceiptUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a valid image file (JPG, PNG, or WEBP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setPaymentReceipt(file);
    setError(null);

    // Log do anexo do comprovante
    try {
      await Logger.log(
        ActionTypes.PAYMENT.ZELLE_RECEIPT_ATTACHED,
        `Receipt attached: ${file.name}`,
        {
          entityType: 'payment',
          entityId: documentId || undefined,
          metadata: {
            filename: file.name,
            file_size: file.size,
            file_type: file.type,
            document_id: documentId || undefined,
            timestamp: new Date().toISOString()
          },
          affectedUserId: documentData?.user_id,
          performerType: 'user'
        }
      );
    } catch (logError) {
      console.error('Error logging receipt attachment:', logError);
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setReceiptPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeReceipt = () => {
    setPaymentReceipt(null);
    setReceiptPreview(null);
  };

  // Função para navegar com limpeza se necessário
  const navigateWithCleanup = async (path: string) => {
    if (!paymentCompleted && shouldCleanupRef.current && documentId) {
      console.log('🔄 Cleaning up document before navigation...');
      await cleanupDocument();
    }
    navigate(path);
  };

  // Função para voltar um step ou limpar se for para sair
  const handleBackStep = async () => {
    if (step === 'instructions') {
      // Se está na primeira etapa e clica back, vai sair - fazer limpeza
      await navigateWithCleanup('/dashboard');
    } else {
      // Apenas voltando um step, não precisa limpar
      setStep('instructions');
    }
  };

  const uploadReceiptToSupabase = async (file: File): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('User not authenticated');

    const fileExt = file.name.split('.').pop();
    const fileName = `${session.user.id}/${documentId}/receipt_${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKETS.PAYMENT_RECEIPTS)
      .upload(fileName, file);

    if (error) {
      console.error('Error uploading receipt:', error);
      throw new Error('Failed to upload receipt');
    }

    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKETS.PAYMENT_RECEIPTS)
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const sendWebhook = async (receiptUrl: string, userId: string): Promise<string> => {
    try {
      const response = await fetch('https://nwh.thefutureofenglish.com/webhook/zelle-global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          document_id: documentId,
          image_url: receiptUrl,
          value: amount,
          currency: "USD",
          fee_type: "traducao_doc",
          timestamp: new Date().toISOString()
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseText = await response.text();
      console.log('Webhook response:', responseText);
      return responseText;
    } catch (error) {
      console.error('Error sending webhook:', error);
      throw error; // Now we throw the error since we need to handle it
    }
  };

  const isValidPaymentResponse = (responseText: string): boolean => {
    try {
      // Tentar parsear como JSON primeiro
      const responseObj = JSON.parse(responseText);

      // Verificar se tem a propriedade response com valor válido
      if (responseObj && responseObj.response) {
        const validResponses = [
          "The proof of payment is valid.",
          "The proof of payment is valid",
          "Valid payment",
          "Payment is valid"
        ];

        const response = responseObj.response.trim().toLowerCase();
        return validResponses.some(valid => response.includes(valid.toLowerCase()));
      }

      // Fallback para string simples
      const validResponse = "The proof of payment is valid.";
      return responseText.trim().toLowerCase().includes(validResponse.toLowerCase());

    } catch (error) {
      // Se não conseguir parsear JSON, tratar como string simples
      const validResponse = "The proof of payment is valid.";
      return responseText.trim().toLowerCase().includes(validResponse.toLowerCase());
    }
  };

  const sendNotificationToAdmin = async (userProfile: any, needsManualReview: boolean = false) => {
    try {
      // Buscar email dos admins
      const { data: adminProfiles } = await supabase
        .from('profiles')
        .select('email')
        .in('role', ['admin', 'finance', 'lush-admin']);

      // Enviar notificação para cada admin
      for (const admin of adminProfiles || []) {
        const payload = {
          user_name: userProfile?.name || 'Unknown User',
          user_email: admin.email,
          notification_type: needsManualReview ? 'Payment Zelle - Manual Review Required' : 'Payment Zelle',
          timestamp: new Date().toISOString(),
          filename: filename || 'Unknown Document',
          document_id: documentId,
          status: needsManualReview ? 'comprovante requer revisão manual' : 'aguardando aprovação de pagamento',
          needs_manual_review: needsManualReview
        };

        await fetch('https://nwh.thefutureofenglish.com/webhook/notthelush1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
    } catch (error) {
      console.error('Error sending admin notification:', error);
      // Non-critical error, so we don't throw
    }
  };

  const sendDocumentForTranslation = async (documentData: any, userProfile: any) => {
    try {
      console.log('🚀 Enviando documento para processo de tradução:', documentData.filename);

      // Gerar a URL pública do documento
      let publicUrl: string;

      if (documentData.file_url) {
        // Se o documento tem file_url (URL direta do arquivo)
        publicUrl = documentData.file_url;
        console.log('📄 URL do documento (do file_url):', publicUrl);
      } else {
        // Fallback para estrutura de Storage (assumindo estrutura padrão)
        const { data: { publicUrl: fallbackUrl } } = supabase.storage
          .from(STORAGE_BUCKETS.DOCUMENTS)
          .getPublicUrl(`${documentData.user_id}/${documentData.filename}`);
        publicUrl = fallbackUrl;
        console.log('📄 URL do documento (fallback):', publicUrl);
      }

      // Preparar payload para o webhook de tradução
      const translationPayload = {
        filename: documentData.filename,
        url: publicUrl,
        mimetype: 'application/pdf',
        size: documentData.file_size || 0,
        user_id: documentData.user_id,
        pages: documentData.pages || 1,
        document_type: documentData.document_type || 'Certificado',
        total_cost: amount || '0',
        source_language: documentData.source_language || 'Portuguese',
        target_language: documentData.target_language || 'English',
        is_bank_statement: documentData.is_bank_statement || false,
        client_name: documentData.client_name || userProfile?.name,
        source_currency: documentData.source_currency || null,
        target_currency: documentData.target_currency || null,
        document_id: documentId,
        original_document_id: documentId, // ID do documento original
        original_filename: documentData.original_filename, // Nome original do arquivo
        // Campos padronizados para compatibilidade com n8n
        isPdf: true,
        fileExtension: 'pdf',
        tableName: 'profiles',
        schema: 'public'
      };

      console.log('📨 Payload para tradução:', JSON.stringify(translationPayload, null, 2));
      console.log('🔍 Debug original_filename:', {
        'documentData.original_filename': documentData.original_filename,
        'documentData.filename': documentData.filename,
        'filename (from URL)': filename,
        'final original_filename': translationPayload.original_filename
      });

      // Enviar para a edge function send-translation-webhook
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`${supabaseUrl}/functions/v1/send-translation-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify(translationPayload)
      });

      const result = await response.json();

      if (response.ok) {
        console.log('✅ Documento enviado para tradução com sucesso:', result);
      } else {
        console.error('❌ Erro ao enviar documento para tradução:', result);
        throw new Error(result.error || 'Failed to send document for translation');
      }

    } catch (error) {
      console.error('Error sending document for translation:', error);
      throw error;
    }
  };

  const handleConfirmPayment = async () => {
    if (!paymentReceipt) {
      setError('Please attach your payment receipt');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('User not authenticated');

      // Buscar dados do usuário para notificação
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', session.user.id)
        .single();

      setUploadingReceipt(true);
      const receiptUrl = await uploadReceiptToSupabase(paymentReceipt);
      setUploadingReceipt(false);

      // Log do upload bem-sucedido do comprovante
      await Logger.log(
        ActionTypes.PAYMENT.ZELLE_RECEIPT_UPLOADED,
        `Receipt uploaded successfully`,
        {
          entityType: 'payment',
          entityId: documentId,
          metadata: {
            receipt_url: receiptUrl,
            document_id: documentId,
            amount: amount,
            filename: paymentReceipt.name,
            file_size: paymentReceipt.size,
            timestamp: new Date().toISOString()
          },
          affectedUserId: session.user.id,
          performerType: 'user'
        }
      );

      // Documento já deve ter file_url neste ponto
      console.log('📄 Using document with existing file_url:', documentData?.file_url);

      // Enviar webhook primeiro para validação
      console.log('🔄 Enviando comprovante para validação...');

      // Log da tentativa de validação
      await Logger.log(
        ActionTypes.PAYMENT.ZELLE_VALIDATION_ATTEMPTED,
        `Attempting automatic validation of receipt`,
        {
          entityType: 'payment',
          entityId: documentId,
          metadata: {
            receipt_url: receiptUrl,
            document_id: documentId,
            webhook_endpoint: 'zelle-global',
            timestamp: new Date().toISOString()
          },
          affectedUserId: session.user.id,
          performerType: 'user'
        }
      );

      let isValid = false;

      try {
        const webhookResponse = await sendWebhook(receiptUrl, session.user.id);
        isValid = isValidPaymentResponse(webhookResponse);

        console.log('✅ Resposta do webhook:', webhookResponse);
        console.log('🎯 Comprovante válido:', isValid);

        // Log do resultado da validação
        if (isValid) {
          await Logger.log(
            ActionTypes.PAYMENT.ZELLE_VALIDATION_SUCCESS,
            `Receipt validated automatically as valid`,
            {
              entityType: 'payment',
              entityId: documentId || undefined,
              metadata: {
                receipt_url: receiptUrl,
                document_id: documentId || undefined,
                validation_result: webhookResponse,
                timestamp: new Date().toISOString()
              },
              affectedUserId: session.user.id,
              performerType: 'system'
            }
          );
        } else {
          await Logger.log(
            ActionTypes.PAYMENT.ZELLE_VALIDATION_FAILED,
            `Receipt validation failed - manual review required`,
            {
              entityType: 'payment',
              entityId: documentId || undefined,
              metadata: {
                receipt_url: receiptUrl,
                document_id: documentId || undefined,
                validation_result: webhookResponse,
                timestamp: new Date().toISOString()
              },
              affectedUserId: session.user.id,
              performerType: 'system'
            }
          );
        }

      } catch (webhookError) {
        console.error('❌ Erro no webhook de validação:', webhookError);
        // Em caso de erro no webhook, considerar como inválido
        isValid = false;

        // Fallback: criar registro de pagamento pendente para aparecer no painel
        try {
          const { error: paymentInsertError } = await supabase
            .from('payments')
            .insert({
              user_id: session.user.id,
              document_id: documentId,
              amount: Number(amount || 0),
              payment_method: 'zelle',
              status: 'pending_verification',
              receipt_url: receiptUrl,
              created_at: new Date().toISOString()
            });
          if (paymentInsertError) {
            console.error('❌ Fallback insert payment error:', paymentInsertError);
          } else {
            console.log('✅ Fallback payment inserted as pending_verification');
          }
        } catch (fallbackErr) {
          console.error('❌ Fallback payment creation failed:', fallbackErr);
        }
      }

      // O registro do pagamento será criado pelo fluxo n8n após processamento do webhook
      // Não inserimos diretamente na tabela payments aqui

      // Processar baseado na validação
      if (isValid) {
        // Comprovante válido - fluxo normal
        await supabase.from('documents').update({
          status: 'processing',  // Mudando para processing pois vai iniciar tradução
          payment_method: 'zelle'
        }).eq('id', documentId);

        // Log da mudança de status do documento para processing
        try {
          await Logger.log(
            ActionTypes.DOCUMENT.STATUS_CHANGED,
            `Document status changed to processing after Zelle validation`,
            {
              entityType: 'document',
              entityId: documentId || '',
              metadata: {
                document_id: documentId,
                filename: documentData?.filename,
                new_status: 'processing',
                payment_method: 'zelle',
                timestamp: new Date().toISOString()
              },
              affectedUserId: documentData?.user_id,
              performerType: 'system'
            }
          );
        } catch (logErr) {
          console.warn('⚠️ Failed to log document status change:', logErr);
        }

        // Enviar documento automaticamente para tradução
        try {
          await sendDocumentForTranslation(documentData, userProfile);
          console.log('✅ Documento enviado para tradução automaticamente');

          // Log do envio do documento para tradução
          await Logger.log(
            ActionTypes.DOCUMENT.SEND_FOR_AUTHENTICATION,
            `Document sent for translation automatically after Zelle validation`,
            {
              entityType: 'document',
              entityId: documentId || '',
              metadata: {
                document_id: documentId,
                filename: documentData?.filename,
                pages: documentData?.pages,
                amount: amount,
                timestamp: new Date().toISOString()
              },
              affectedUserId: documentData?.user_id,
              performerType: 'system'
            }
          );
        } catch (translationError) {
          console.error('❌ Erro ao enviar documento para tradução:', translationError);
          // Não falhar o pagamento se a tradução falhar - pode ser reenviad manualmente
        }

        // Enviar notificação normal para admin informando pagamento válido
        await sendNotificationToAdmin(userProfile, false);

        console.log('✅ Comprovante validado automaticamente');
      } else {
        // Comprovante inválido - precisa revisão manual
        // Garantir que status é permitido no schema atual: usar 'pending' se 'pending_manual_review' não for aceito
        try {
          const { error: docErr } = await supabase.from('documents').update({
            status: 'pending_manual_review',
            payment_method: 'zelle'
          }).eq('id', documentId);
          if (docErr) {
            console.warn('⚠️ Falling back to status "pending" due to constraint:', docErr?.message);
            await supabase.from('documents').update({
              status: 'pending',
              payment_method: 'zelle'
            }).eq('id', documentId);
          }
        } catch (statusErr) {
          console.error('❌ Error updating document status:', statusErr);
        }

        // Enviar notificação para revisão manual
        await sendNotificationToAdmin(userProfile, true);

        // Log de marcação para revisão manual
        await Logger.log(
          ActionTypes.PAYMENT.ZELLE_PENDING_MANUAL_REVIEW,
          `Payment marked for manual review`,
          {
            entityType: 'payment',
            entityId: documentId || undefined,
            metadata: {
              document_id: documentId || undefined,
              amount: amount,
              receipt_url: receiptUrl,
              reason: 'automatic_validation_failed',
              timestamp: new Date().toISOString()
            },
            affectedUserId: session.user.id,
            performerType: 'system'
          }
        );

        console.log('⚠️ Comprovante precisa de revisão manual');
      }

      // Marcar pagamento como completado para evitar limpeza desnecessária
      setPaymentCompleted(true);
      shouldCleanupRef.current = false; // Desabilitar limpeza permanentemente
      setStep('completed');
    } catch (err: any) {
      console.error('Error confirming Zelle payment:', err);

      // Log do erro no upload/confirmação
      try {
        await Logger.log(
          ActionTypes.PAYMENT.ZELLE_RECEIPT_UPLOAD_FAILED,
          `Receipt upload/confirmation failed: ${err.message}`,
          {
            entityType: 'payment',
            entityId: documentId || undefined,
            metadata: {
              error_message: err.message,
              document_id: documentId || undefined,
              timestamp: new Date().toISOString()
            },
            affectedUserId: documentData?.user_id,
            performerType: 'user'
          }
        );
      } catch (logError) {
        console.error('Error logging upload failure:', logError);
      }

      setError(err.message || 'Failed to confirm payment. Please try again.');
    } finally {
      setIsSubmitting(false);
      setUploadingReceipt(false);
    }
  }; if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-800 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading payment information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-full mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigateWithCleanup('/dashboard')}
              className="flex items-center space-x-2 text-slate-700 hover:text-slate-900 transition-colors px-3 py-2 rounded-xl hover:bg-gray-100"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back to Dashboard</span>
            </button>
            <div className="flex items-center space-x-3 px-4 py-2 bg-slate-800 rounded-xl">
              <DollarSign className="w-5 h-5 text-white" />
              <h1 className="text-lg font-semibold text-white">Zelle Payment</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-full mx-auto px-8 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-200">
            {step === 'instructions' && (
              <>
                <div className="bg-slate-800 text-white p-6 rounded-t-2xl">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-slate-700 rounded-2xl"><DollarSign className="w-8 h-8 text-white" /></div>
                    <div><h2 className="text-2xl font-bold">Pay with Zelle</h2><p className="text-slate-300">Secure bank-to-bank transfer</p></div>
                  </div>
                </div>
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-center">
                    <div className="flex items-center"><div className="w-10 h-10 bg-slate-800 text-white rounded-full flex items-center justify-center font-bold">1</div><span className="ml-3 font-semibold text-slate-800">Send Payment</span></div>
                    <div className="w-20 h-0.5 bg-gray-300 mx-6"></div>
                    <div className="flex items-center"><div className="w-10 h-10 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center font-bold">2</div><span className="ml-3 text-gray-600">Confirm</span></div>
                  </div>
                  <div className="text-center"><h3 className="text-xl font-bold text-gray-900 mb-2">Step 1: Send Payment via Zelle</h3><p className="text-gray-600">Use your banking app to send the payment</p></div>
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                    <div className="flex items-center space-x-3 mb-4"><Phone className="w-5 h-5 text-slate-700" /><p className="font-semibold text-slate-800">Send money via Zelle to:</p></div>
                    <div className="mb-6">
                      <div className="bg-white rounded-2xl p-4 border border-gray-200 max-w-md">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-slate-800 rounded-2xl flex items-center justify-center"><Mail className="w-5 h-5 text-white" /></div>
                            <div><p className="font-medium text-gray-600">Email Address</p><p className="font-mono text-sm font-bold text-gray-900">{ZELLE_INFO.email}</p></div>
                          </div>
                          <button onClick={() => copyToClipboard(ZELLE_INFO.email, 'email')} className={`flex items-center space-x-2 px-3 py-2 rounded-2xl font-medium transition-colors text-sm ${copied === 'email' ? 'bg-green-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>{copied === 'email' ? <><CheckCircle className="w-4 h-4" /><span>Copied!</span></> : <><Copy className="w-4 h-4" /><span>Copy</span></>}</button>
                        </div>
                      </div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                      <div className="flex items-start space-x-3"><AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" /><div><h4 className="font-semibold text-amber-800 mb-2">Important Instructions:</h4><ul className="space-y-1 text-sm text-amber-700"><li>• Send exactly <span className="font-bold">${amount}.00</span></li><li>• Include your full name in the memo/message</li><li>• Keep your confirmation code and receipt</li></ul></div></div>
                    </div>
                  </div>
                  <button onClick={() => setStep('confirmation')} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 px-6 rounded-2xl font-semibold transition-colors">I've Sent the Payment</button>
                  <p className="text-center text-gray-500 text-sm">Make sure to complete your Zelle transfer before clicking above.</p>
                </div>
              </>
            )}
            {step === 'confirmation' && (
              <>
                <div className="bg-slate-800 text-white p-6 rounded-t-2xl">
                  <div className="flex items-center space-x-4"><div className="p-3 bg-slate-700 rounded-2xl"><CheckCircle className="w-8 h-8 text-white" /></div><div><h2 className="text-2xl font-bold">Confirm Your Payment</h2><p className="text-slate-300">Almost done! Just need your confirmation details</p></div></div>
                </div>
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-center">
                    <div className="flex items-center"><div className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center"><CheckCircle className="w-6 h-6" /></div><span className="ml-3 font-semibold text-green-600">Payment Sent</span></div>
                    <div className="w-20 h-0.5 bg-green-600 mx-6"></div>
                    <div className="flex items-center"><div className="w-10 h-10 bg-slate-800 text-white rounded-full flex items-center justify-center font-bold">2</div><span className="ml-3 font-semibold text-slate-800">Confirm</span></div>
                  </div>
                  <div className="text-center"><h3 className="text-xl font-bold text-gray-900 mb-2">Great! Now please confirm your payment</h3><p className="text-gray-600">Upload your payment receipt to complete the verification</p></div>

                  {/* Payment Receipt Requirements */}
                  <div className="bg-blue-50 rounded-xl p-5 mb-6">
                    <h4 className="font-semibold text-gray-900 mb-4">Your payment confirmation must include:</h4>

                    <div className="space-y-3 text-sm mb-4">
                      <div className="flex items-start space-x-3">
                        <span className="w-5 h-5 bg-blue-600 text-white rounded text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                        <div>
                          <span className="font-medium text-gray-900">Confirmation Code</span>
                          <span className="text-gray-600 ml-1">- The unique transaction code from Zelle</span>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <span className="w-5 h-5 bg-blue-600 text-white rounded text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                        <div>
                          <span className="font-medium text-gray-900">Payment Date</span>
                          <span className="text-gray-600 ml-1">- When the transfer was completed</span>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <span className="w-5 h-5 bg-blue-600 text-white rounded text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                        <div>
                          <span className="font-medium text-gray-900">Payment Amount</span>
                          <span className="text-gray-600 ml-1">- The exact amount <strong className="text-green-600">(${amount} USD)</strong></span>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <span className="w-5 h-5 bg-blue-600 text-white rounded text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                        <div>
                          <span className="font-medium text-gray-900">Recipient Information</span>
                          <span className="text-gray-600 ml-1">- Who received the payment</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-green-700 bg-green-100 rounded-lg p-3">
                      <strong>💡 Tip:</strong> Complete screenshots are verified automatically within minutes. Incomplete receipts need manual review (up to 24 hours).
                    </div>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                    <label className="block font-semibold text-gray-800 mb-2">Payment Receipt *</label>
                    {!paymentReceipt ? (
                      <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-slate-400 transition-colors">
                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleReceiptUpload} className="hidden" id="receipt-upload" />
                        <label htmlFor="receipt-upload" className="cursor-pointer">
                          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600 font-medium">Click to upload receipt</p>
                          <p className="text-sm text-gray-500 mt-1">JPG, PNG or WEBP (max 5MB)</p>
                        </label>
                      </div>
                    ) : (
                      <div className="relative bg-white rounded-2xl p-4 border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3 overflow-hidden"><img src={receiptPreview || ''} alt="Preview" className="w-12 h-12 object-cover rounded-xl border border-gray-200 flex-shrink-0" /><div className="overflow-hidden"><p className="font-medium text-gray-900 truncate">{paymentReceipt.name}</p><p className="text-sm text-gray-600">{Math.round(paymentReceipt.size / 1024)} KB</p></div></div>
                          <button onClick={removeReceipt} className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0 ml-2"><X className="w-4 h-4 text-gray-500" /></button>
                        </div>
                      </div>
                    )}
                  </div>
                  {error && (<div className="flex items-center space-x-3 text-red-700 bg-red-50 p-4 rounded-2xl border border-red-200"><AlertCircle className="w-5 h-5 flex-shrink-0" /><span>{error}</span></div>)}
                  <div className="flex space-x-4">
                    <button onClick={handleBackStep} className="flex items-center justify-center space-x-2 flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 px-4 rounded-2xl font-semibold transition-colors"><ArrowLeft className="w-4 h-4" /><span>Back</span></button>
                    <button onClick={handleConfirmPayment} disabled={!paymentReceipt || isSubmitting} className="flex items-center justify-center space-x-2 flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 px-4 rounded-2xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>
                            {uploadingReceipt ? 'Uploading Receipt...' : 'Confirming...'}
                          </span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>Confirm Payment</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
            {step === 'completed' && (
              <>
                <div className="bg-slate-800 text-white p-6 rounded-t-2xl text-center">
                  <div className="inline-flex items-center justify-center p-4 bg-green-600 rounded-3xl mb-4"><CheckCircle className="w-12 h-12 text-white" /></div>
                  <h2 className="text-2xl font-bold mb-2">Payment Submitted!</h2>
                  <p className="text-slate-300">Your payment has been recorded and is now being processed.</p>
                </div>
                <div className="p-6 text-center">
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 mb-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center justify-center space-x-2"><Clock className="w-5 h-5 text-slate-700" /><span>What happens next?</span></h3>
                    <div className="space-y-4 text-left max-w-2xl mx-auto">
                      <div className="flex items-start space-x-4 p-4 bg-white rounded-2xl border border-gray-200"><div className="p-2 bg-slate-100 rounded-2xl flex-shrink-0"><Clock className="w-5 h-5 text-slate-700" /></div><div><p className="font-semibold text-gray-900 mb-1">Payment Verification</p><p className="text-gray-600 text-sm">We'll verify your payment within 1-2 business days.</p></div></div>
                      <div className="flex items-start space-x-4 p-4 bg-white rounded-2xl border border-gray-200"><div className="p-2 bg-slate-100 rounded-2xl flex-shrink-0"><CheckCircle className="w-5 h-5 text-slate-700" /></div><div><p className="font-semibold text-gray-900 mb-1">Document Processing</p><p className="text-gray-600 text-sm">Once verified, we'll start your translation.</p></div></div>
                      <div className="flex items-start space-x-4 p-4 bg-white rounded-2xl border border-gray-200"><div className="p-2 bg-slate-100 rounded-2xl flex-shrink-0"><Mail className="w-5 h-5 text-slate-700" /></div><div><p className="font-semibold text-gray-900 mb-1">Email Updates</p><p className="text-gray-600 text-sm">You'll receive email notifications on your document status.</p></div></div>
                    </div>
                  </div>
                  <button onClick={() => navigate('/dashboard')} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 px-6 rounded-2xl font-semibold transition-colors">Go to Dashboard</button>
                </div>
              </>
            )}
          </div>

          <div className="xl:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 sticky top-8">
              <div className="bg-gray-50 p-4 border-b border-gray-200 rounded-t-2xl"><h3 className="text-lg font-bold text-gray-900">Payment Summary</h3></div>
              <div className="p-4 space-y-6">
                <div className="text-center">
                  <p className="text-gray-600 font-medium mb-2">Total Amount</p>
                  <p className="text-4xl font-bold text-slate-800 mb-4">${amount}.00</p>
                  <div className="bg-gray-50 rounded-2xl p-3 border border-gray-200">
                    <p className="font-bold text-gray-800 truncate">{filename || 'Document'}</p>
                    <p className="text-gray-600 text-sm">{pages} page{parseInt(pages || '1') !== 1 ? 's' : ''}</p>
                    <p className="text-slate-700 font-semibold text-sm">Translation Service</p>
                  </div>
                </div>
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Payment Method</h4>
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-2xl border border-gray-200">
                    <div className="p-2 bg-slate-800 rounded-2xl"><DollarSign className="w-5 h-5 text-white" /></div>
                    <div><p className="font-semibold text-gray-900">Zelle Transfer</p><p className="text-gray-600 text-sm">Bank-to-bank transfer</p></div>
                  </div>
                </div>
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-2xl border border-blue-200">
                    <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div><h5 className="font-semibold text-blue-900 mb-1">Secure Process</h5><p className="text-blue-700 text-sm">Your payment is processed via your bank's Zelle service. We will manually verify your receipt.</p></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}