import { useState, useEffect, useMemo } from 'react';
import { 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  FileText, 
  DollarSign,
  AlertCircle,
  ExternalLink,
  Search,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  SortAsc,
  SortDesc,
  BarChart3,
  DollarSign as DollarIcon
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import PostgreSQLService from '../lib/postgresql-edge';
import { notifyAuthenticatorsPendingDocuments } from '../utils/webhookNotifications';
import { Logger } from '../lib/loggingHelpers';
import { ActionTypes } from '../types/actionTypes';

interface ZellePayment {
  id: string;
  user_id: string;
  document_id: string;
  amount: number;
  payment_method: string;
  status: string;
  receipt_url: string;
  zelle_confirmation_code: string | null;
  zelle_verified_at: string | null;
  zelle_verified_by: string | null;
  created_at: string;
  updated_at: string;
  // Dados relacionados
  profiles: {
    name: string;
    email: string;
  };
  documents: {
    filename: string;
    status: string;
    client_name: string;
  };
  verifier?: {
    name: string;
    email: string;
  };
}

export function ZelleReceiptsAdmin() {
  const [payments, setPayments] = useState<ZellePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<ZellePayment | null>(null);
  const [processingPaymentId, setProcessingPaymentId] = useState<string | null>(null);
  const [sendingToTranslation, setSendingToTranslation] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending_verification' | 'pending_manual_review' | 'completed' | 'failed'>('pending_verification');
  
  // Novos estados para filtros avançados
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<{
    startDate: string;
    endDate: string;
  }>({ startDate: '', endDate: '' });
  const [amountFilter, setAmountFilter] = useState<{
    min: string;
    max: string;
  }>({ min: '', max: '' });
  const [sortBy, setSortBy] = useState<'created_at' | 'amount' | 'user_name' | 'status'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Estados para modal de rejeição
  const [rejectionModal, setRejectionModal] = useState<{
    isOpen: boolean;
    payment: ZellePayment | null;
  }>({ isOpen: false, payment: null });
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [sendingRejection, setSendingRejection] = useState(false);

  // Estados para modal de código de confirmação Zelle
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    payment: ZellePayment | null;
  }>({ isOpen: false, payment: null });
  const [confirmationCode, setConfirmationCode] = useState<string>('');
  const [savingConfirmationCode, setSavingConfirmationCode] = useState(false);

  useEffect(() => {
    loadPayments();
    initializePostgreSQL();
  }, [filter]); // Roda apenas quando o filtro principal (abas) muda. Os outros filtros são client-side.


  // Calcular dados filtrados e ordenados
  const filteredAndSortedPayments = useMemo(() => {
    let filtered = payments;

    // Filtro por status (abas)
    filtered = filtered.filter(payment => payment.status === filter);

    // Filtro por termo de busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(payment => 
        payment.profiles?.name?.toLowerCase().includes(term) ||
        payment.profiles?.email?.toLowerCase().includes(term) ||
        payment.documents?.filename?.toLowerCase().includes(term) ||
        payment.zelle_confirmation_code?.toLowerCase().includes(term)
      );
    }

    // Filtro por data
    if (dateFilter.startDate) {
      filtered = filtered.filter(payment => 
        new Date(payment.created_at) >= new Date(dateFilter.startDate)
      );
    }
    if (dateFilter.endDate) {
      filtered = filtered.filter(payment => 
        new Date(payment.created_at) <= new Date(dateFilter.endDate)
      );
    }

    // Filtro por valor
    if (amountFilter.min) {
      filtered = filtered.filter(payment => 
        payment.amount >= parseFloat(amountFilter.min)
      );
    }
    if (amountFilter.max) {
      filtered = filtered.filter(payment => 
        payment.amount <= parseFloat(amountFilter.max)
      );
    }

    // Ordenação
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'created_at':
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
          break;
        case 'amount':
          aValue = a.amount;
          bValue = b.amount;
          break;
        case 'user_name':
          aValue = a.profiles?.name || '';
          bValue = b.profiles?.name || '';
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [payments, searchTerm, dateFilter, amountFilter, sortBy, sortOrder]);

  // Calcular paginação
  const totalPages = Math.ceil(filteredAndSortedPayments.length / itemsPerPage);
  const paginatedPayments = filteredAndSortedPayments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Calcular estatísticas
  const stats = useMemo(() => {
    const total = payments.length;
    const pending = payments.filter(p => p.status === 'pending_verification').length;
    const manualReview = payments.filter(p => p.status === 'pending_manual_review').length;
    const completed = payments.filter(p => p.status === 'completed').length;
    const failed = payments.filter(p => p.status === 'failed').length;
    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const avgAmount = total > 0 ? totalAmount / total : 0;

    return {
      total,
      pending,
      manualReview,
      completed,
      failed,
      totalAmount,
      avgAmount
    };
  }, [payments]);

  const initializePostgreSQL = async () => {
    try {
      // Testar conexão
      const connectionOk = await PostgreSQLService.testConnection();
      if (connectionOk) {
        // Criar tabela se não existir
        await PostgreSQLService.createTableIfNotExists();
      }
    } catch (error) {
      console.error('⚠️ PostgreSQL initialization failed (non-critical):', error);
      // Não bloqueia o funcionamento da aplicação
    }
  };

  const loadPayments = async () => {
    try {
      setLoading(true);
      setError(null);

      // Sempre carregar TODOS os pagamentos para calcular estatísticas corretas
      const { data: allPayments, error: allPaymentsError } = await supabase
        .from('payments')
        .select(`
          *,
          profiles:user_id (name, email),
          documents:document_id (filename, status, client_name)
        `)
        .eq('payment_method', 'zelle')
        .order('created_at', { ascending: false });

      if (allPaymentsError) throw allPaymentsError;

      // Buscar dados dos verificadores para todos os pagamentos
      const paymentsWithVerifiers = await Promise.all(
        allPayments.map(async (payment) => {
          if (payment.zelle_verified_by) {
            const { data: verifier } = await supabase
              .from('profiles')
              .select('name, email')
              .eq('id', payment.zelle_verified_by)
              .single();
            
            return { ...payment, verifier };
          }
          return payment;
        })
      );

      // Definir os pagamentos para exibição (filtrados) e para estatísticas (todos)
      setPayments(paymentsWithVerifiers);
    } catch (err: any) {
      console.error('Error loading Zelle payments:', err);
      setError(err.message || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  const openRejectionModal = (payment: ZellePayment) => {
    setRejectionModal({ isOpen: true, payment });
    setRejectionReason('');
    setCustomReason('');
  };

  const closeRejectionModal = () => {
    setRejectionModal({ isOpen: false, payment: null });
    setRejectionReason('');
    setCustomReason('');
  };

  const openConfirmationModal = (payment: ZellePayment) => {
    setConfirmationModal({ isOpen: true, payment });
    setConfirmationCode('');
  };

  const closeConfirmationModal = () => {
    setConfirmationModal({ isOpen: false, payment: null });
    setConfirmationCode('');
  };

  const handleSaveConfirmationCode = async () => {
    if (!confirmationModal.payment || !confirmationCode.trim()) {
      setError('Please enter a valid confirmation code');
      return;
    }

    setSavingConfirmationCode(true);
    setError(null);
    setProcessingPaymentId(confirmationModal.payment.id);

    try {
      // 1. Atualizar o código de confirmação no pagamento Supabase
      const { error } = await supabase
        .from('payments')
        .update({ 
          zelle_confirmation_code: confirmationCode.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', confirmationModal.payment.id);

      if (error) throw error;

      // 2. Inserir no histórico PostgreSQL (não-crítico)
      try {
        await PostgreSQLService.insertZellePaymentHistory({
          payment_id: confirmationModal.payment.id,
          user_id: confirmationModal.payment.user_id,
          zelle_confirmation_code: confirmationCode.trim(),
          amount: confirmationModal.payment.amount,
          user_name: confirmationModal.payment.profiles?.name || 'Unknown',
          user_email: confirmationModal.payment.profiles?.email || 'Unknown',
          document_filename: confirmationModal.payment.documents?.filename
        });
        console.log('✅ Zelle confirmation code saved to PostgreSQL history');
      } catch (pgError) {
        console.error('⚠️ Failed to save to PostgreSQL (non-critical):', pgError);
      }

      // 3. Processar aprovação diretamente usando a função RPC
      const { error: verifyError } = await supabase.rpc('verify_zelle_payment', { 
        payment_id: confirmationModal.payment.id 
      });

      if (verifyError) throw verifyError;

      // Log combinado de código de confirmação + aprovação
      await Logger.log(
        ActionTypes.PAYMENT.ZELLE_CONFIRMATION_CODE_SAVED,
        `Zelle payment approved with confirmation code: ${confirmationCode}`,
        {
          entityType: 'payment',
          entityId: confirmationModal.payment.id,
          metadata: {
            amount: confirmationModal.payment.amount,
            confirmation_code: confirmationCode,
            document_id: confirmationModal.payment.document_id,
            document_filename: confirmationModal.payment.documents?.filename,
            previous_status: confirmationModal.payment.status,
            new_status: 'completed',
            timestamp: new Date().toISOString()
          },
          affectedUserId: confirmationModal.payment.user_id,
          performerType: 'finance'
        }
      );

      // Log do pagamento Zelle verificado (equivalente ao payment_received do Stripe)
      await Logger.log(
        ActionTypes.PAYMENT.ZELLE_VERIFIED,
        `Zelle payment verified successfully`,
        {
          entityType: 'payment',
          entityId: confirmationModal.payment.id,
          metadata: {
            amount: confirmationModal.payment.amount,
            confirmation_code: confirmationCode,
            document_id: confirmationModal.payment.document_id,
            document_filename: confirmationModal.payment.documents?.filename,
            payment_method: 'zelle',
            timestamp: new Date().toISOString()
          },
          affectedUserId: confirmationModal.payment.user_id,
          performerType: 'system'
        }
      );

      // 4. Após aprovar o pagamento, enviar documento para processo de tradução
      setSendingToTranslation(confirmationModal.payment.id);
      try {
        await sendDocumentForTranslation(confirmationModal.payment);
        console.log('✅ Document successfully sent for translation');
        
        // Log do documento enviado para tradução
        await Logger.log(
          ActionTypes.DOCUMENT.SEND_FOR_AUTHENTICATION,
          `Document sent for translation after Zelle payment approval with confirmation code`,
          {
            entityType: 'document',
            entityId: confirmationModal.payment.document_id,
            metadata: {
              document_id: confirmationModal.payment.document_id,
              filename: confirmationModal.payment.documents?.filename,
              payment_id: confirmationModal.payment.id,
              payment_method: 'zelle',
              confirmation_code: confirmationCode,
              amount: confirmationModal.payment.amount,
              timestamp: new Date().toISOString()
            },
            affectedUserId: confirmationModal.payment.user_id,
            performerType: 'finance'
          }
        );
      } catch (translationError) {
        console.error('❌ Failed to send document for translation:', translationError);
      } finally {
        setSendingToTranslation(null);
      }

      // 5. Enviar notificações
      await sendApprovalNotification(confirmationModal.payment);
      const clientName = confirmationModal.payment.profiles?.name || 'Cliente';
      const documentFilename = confirmationModal.payment.documents?.filename || 'Documento';
      
      await notifyAuthenticatorsPendingDocuments(confirmationModal.payment.user_id, {
        filename: documentFilename,
        document_id: confirmationModal.payment.document_id,
        client_name: clientName
      });

      // 6. Apenas após o sucesso, fechar o modal e recarregar a lista
      closeConfirmationModal();
      setSelectedReceipt(null);
      await loadPayments();
      
    } catch (err: any) {
      console.error('Error saving confirmation code and approving:', err);
      setError(err.message || 'Failed to save confirmation code and approve payment');
    } finally {
      setSavingConfirmationCode(false);
      setProcessingPaymentId(null);
    }
  };

  const sendRejectionNotification = async (payment: ZellePayment, reason: string) => {
    try {
      // Buscar email do usuário
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', payment.user_id)
        .single();

      if (!userProfile) {
        throw new Error('User profile not found');
      }

      const payload = {
        user_email: userProfile.email,
        message: reason,
        notification_type: 'Zelle Payment Rejected',
        user_name: userProfile.name,
        document_name: payment.documents?.filename,
        amount: payment.amount,
        timestamp: new Date().toISOString()
      };

      console.log('📧 Enviando notificação de rejeição:', payload);

      await fetch('https://nwh.thefutureofenglish.com/webhook/notthelush1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      console.log('✅ Notificação de rejeição enviada com sucesso');
    } catch (error) {
      console.error('Error sending rejection notification:', error);
      // Non-critical error, so we don't throw
    }
  };

  const sendApprovalNotification = async (payment: ZellePayment) => {
    try {
      // Buscar email do usuário
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', payment.user_id)
        .single();

      if (!userProfile) {
        throw new Error('User profile not found');
      }

      const payload = {
        user_email: userProfile.email,
        message: 'Your Zelle payment has been approved and your document is now being processed.',
        notification_type: 'Zelle Payment Approved',
        user_name: userProfile.name,
        document_name: payment.documents?.filename,
        amount: payment.amount,
        timestamp: new Date().toISOString()
      };

      console.log('📧 Enviando notificação de aprovação:', payload);

      await fetch('https://nwh.thefutureofenglish.com/webhook/notthelush1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      console.log('✅ Notificação de aprovação enviada com sucesso');
    } catch (error) {
      console.error('Error sending approval notification:', error);
      // Non-critical error, so we don't throw
    }
  };

  const handleRejectPayment = async () => {
    if (!rejectionModal.payment) return;

    const finalReason = rejectionReason === 'custom' 
      ? customReason.trim() 
      : rejectionReason;

    if (!finalReason) {
      setError('Please select or enter a rejection reason');
      return;
    }

    setSendingRejection(true);
    setError(null);

    try {
      // Atualizar status do pagamento
      await supabase
        .from('payments')
        .update({ 
          status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', rejectionModal.payment.id);

      // Log de rejeição de pagamento Zelle
      await Logger.log(
        ActionTypes.ZELLE_PAYMENT_REJECTED,
        `Zelle payment rejected: ${rejectionModal.payment.zelle_confirmation_code || rejectionModal.payment.id}`,
        {
          entityType: 'payment',
          entityId: rejectionModal.payment.id,
          metadata: {
            amount: rejectionModal.payment.amount,
            confirmation_code: rejectionModal.payment.zelle_confirmation_code,
            rejection_reason: finalReason,
            document_id: rejectionModal.payment.document_id,
            timestamp: new Date().toISOString()
          },
          affectedUserId: rejectionModal.payment.user_id,
          performerType: 'finance'
        }
      );

      // Enviar notificação de rejeição para o usuário
      await sendRejectionNotification(rejectionModal.payment, finalReason);

      await loadPayments();
      closeRejectionModal();
      setSelectedReceipt(null);
      
    } catch (err: any) {
      console.error('Error rejecting payment:', err);
      setError(err.message || 'Failed to reject payment');
    } finally {
      setSendingRejection(false);
    }
  };

  const verifyPayment = async (paymentId: string, approve: boolean) => {
      const payment = payments.find(p => p.id === paymentId);
    if (!payment) {
      setError('Payment not found');
      return;
    }

    if (!approve) {
      // Se for rejeição, abrir modal para selecionar motivo
      openRejectionModal(payment);
      return;
    }

    // Se não há código de confirmação, abrir modal para entrada
    if (!payment.zelle_confirmation_code || payment.zelle_confirmation_code.trim() === '') {
      openConfirmationModal(payment);
      return;
    }

    try {
      setProcessingPaymentId(paymentId);
      
      // Se aprovado, usar a função RPC
      const { error } = await supabase.rpc('verify_zelle_payment', { 
        payment_id: paymentId 
      });

      if (error) throw error;

      // Log combinado de código de confirmação + aprovação
      await Logger.log(
        ActionTypes.PAYMENT.ZELLE_CONFIRMATION_CODE_SAVED,
        `Zelle payment approved with confirmation code: ${payment.zelle_confirmation_code}`,
        {
          entityType: 'payment',
          entityId: paymentId,
          metadata: {
            amount: payment.amount,
            confirmation_code: payment.zelle_confirmation_code,
            document_id: payment.document_id,
            document_filename: payment.documents?.filename,
            previous_status: payment.status,
            new_status: 'completed',
            timestamp: new Date().toISOString()
          },
          affectedUserId: payment.user_id,
          performerType: 'finance'
        }
      );

      // Log do pagamento Zelle verificado (equivalente ao payment_received do Stripe)
      await Logger.log(
        ActionTypes.PAYMENT.ZELLE_VERIFIED,
        `Zelle payment verified successfully`,
        {
          entityType: 'payment',
          entityId: paymentId,
          metadata: {
            amount: payment.amount,
            confirmation_code: payment.zelle_confirmation_code,
            document_id: payment.document_id,
            document_filename: payment.documents?.filename,
            payment_method: 'zelle',
            timestamp: new Date().toISOString()
          },
          affectedUserId: payment.user_id,
          performerType: 'system'
        }
      );

      // Após aprovar o pagamento, enviar documento para processo de tradução
        setSendingToTranslation(paymentId);
        try {
          await sendDocumentForTranslation(payment);
          console.log('✅ Document successfully sent for translation');
          
          // Log do documento enviado para tradução
          await Logger.log(
            ActionTypes.DOCUMENT.SEND_FOR_AUTHENTICATION,
            `Document sent for translation after Zelle payment approval`,
            {
              entityType: 'document',
              entityId: payment.document_id,
              metadata: {
                document_id: payment.document_id,
                filename: payment.documents?.filename,
                payment_id: paymentId,
                payment_method: 'zelle',
                amount: payment.amount,
                timestamp: new Date().toISOString()
              },
              affectedUserId: payment.user_id,
              performerType: 'finance'
            }
          );
        } catch (translationError) {
          console.error('❌ Failed to send document for translation:', translationError);
        // Nota: A aprovação do pagamento não falha se a tradução falhar.
        // O pagamento já está aprovado, a tradução pode ser tentada novamente mais tarde.
        } finally {
          setSendingToTranslation(null);
      }

      // Enviar notificações
        await sendApprovalNotification(payment);
        const clientName = payment.profiles?.name || 'Cliente';
        const documentFilename = payment.documents?.filename || 'Documento';
        
        await notifyAuthenticatorsPendingDocuments(payment.user_id, {
          filename: documentFilename,
        document_id: payment.document_id,
          client_name: clientName
        });

      await loadPayments();
      setSelectedReceipt(null);
      
    } catch (err: any) {
      console.error('Error verifying payment:', err);
      setError(err.message || 'Failed to verify payment');
    } finally {
      setProcessingPaymentId(null);
    }
  };

  // Funções para ações em lote
  const handleSelectPayment = (paymentId: string) => {
    setSelectedPayments(prev => 
      prev.includes(paymentId) 
        ? prev.filter(id => id !== paymentId)
        : [...prev, paymentId]
    );
  };

  const handleSelectAll = () => {
    if (selectedPayments.length === paginatedPayments.length) {
      setSelectedPayments([]);
    } else {
      setSelectedPayments(paginatedPayments.map(p => p.id));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedPayments.length === 0) return;
    
    // NOTA: A aprovação em lote assume que os pagamentos selecionados já têm um código de confirmação.
    // Uma melhoria futura poderia ser ignorar aqueles sem código ou abrir modais em sequência.
    setProcessingPaymentId('bulk');
    try {
      for (const paymentId of selectedPayments) {
        const payment = payments.find(p => p.id === paymentId);
        if (payment && (payment.status === 'pending_verification' || payment.status === 'pending_manual_review')) {
          await supabase.rpc('verify_zelle_payment', { payment_id: paymentId });
          await sendDocumentForTranslation(payment);
          await sendApprovalNotification(payment);
        }
      }
      await loadPayments();
      setSelectedPayments([]);
    } catch (err: any) {
      console.error('Error in bulk approval:', err);
      setError(err.message || 'Failed to approve payments');
    } finally {
      setProcessingPaymentId(null);
    }
  };

  const handleBulkReject = async () => {
    if (selectedPayments.length === 0) return;
    
    // NOTA: A rejeição em lote não envia notificações individuais por email.
    // Isso pode ser implementado se necessário.
    setProcessingPaymentId('bulk');
    try {
      for (const paymentId of selectedPayments) {
        await supabase
          .from('payments')
          .update({ 
            status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', paymentId);
      }
      await loadPayments();
      setSelectedPayments([]);
    } catch (err: any) {
      console.error('Error in bulk rejection:', err);
      setError(err.message || 'Failed to reject payments');
    } finally {
      setProcessingPaymentId(null);
    }
  };

  // Função para exportar dados
  const handleExportCSV = () => {
    const csvData = filteredAndSortedPayments.map(payment => ({
      'Payment ID': payment.id,
      'User Name': payment.profiles?.name || '',
      'User Email': payment.profiles?.email || '',
      'Document': payment.documents?.filename || '',
      'Amount': payment.amount,
      'Status': payment.status,
      'Confirmation Code': payment.zelle_confirmation_code || '',
      'Created At': new Date(payment.created_at).toLocaleString(),
      'Verified At': payment.zelle_verified_at ? new Date(payment.zelle_verified_at).toLocaleString() : '',
      'Verified By': payment.verifier?.name || ''
    }));

    if (csvData.length === 0) {
      setError("No data to export.");
      return;
    }

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zelle-payments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const sendDocumentForTranslation = async (payment: ZellePayment) => {
    try {
      console.log('🚀 Enviando documento para processo de tradução:', payment.documents?.filename);
      
      // Buscar dados completos do documento na tabela documents
      const { data: documentData, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', payment.document_id)
        .single();

      if (docError || !documentData) {
        console.error('Erro ao buscar dados do documento:', docError);
        throw new Error('Document not found');
      }

      // Buscar dados do usuário
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', payment.user_id)
        .single();

      if (userError || !userData) {
        console.error('Erro ao buscar dados do usuário:', userError);
        throw new Error('User not found');
      }

      // Gerar a URL pública do documento
      let publicUrl: string;
      
      if (documentData.file_url) {
        // Se o documento tem file_url (URL direta do arquivo)
        publicUrl = documentData.file_url;
        console.log('📄 URL do documento (do file_url):', publicUrl);
      } else {
        // Fallback para estrutura de Storage (assumindo estrutura padrão)
        const { data: { publicUrl: fallbackUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(`${payment.user_id}/${documentData.filename}`);
        publicUrl = fallbackUrl;
        console.log('📄 URL do documento (fallback):', publicUrl);
      }

      // Preparar payload para o webhook de tradução
      const translationPayload = {
        filename: documentData.filename,
        url: publicUrl,
        mimetype: 'application/pdf',
        size: documentData.file_size || 0,
        user_id: payment.user_id,
        pages: documentData.pages || 1,
        document_type: documentData.document_type || 'Certificado',
        total_cost: payment.amount.toString(),
        source_language: documentData.source_language || 'Portuguese',
        target_language: documentData.target_language || 'English',
        is_bank_statement: documentData.is_bank_statement || false,
        client_name: documentData.client_name || userData.name,
        source_currency: documentData.source_currency || null,
        target_currency: documentData.target_currency || null,
        document_id: payment.document_id,
        // Campos padronizados para compatibilidade com n8n
        isPdf: true,
        fileExtension: 'pdf',
        tableName: 'profiles',
        schema: 'public'
      };

      console.log('📨 Payload para tradução:', JSON.stringify(translationPayload, null, 2));

      // Enviar para a edge function send-translation-webhook
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();

      console.log('🚀 Enviando webhook para n8n...');
      console.log('📤 Payload sendo enviado:', JSON.stringify(translationPayload, null, 2));
      
      const response = await fetch(`${supabaseUrl}/functions/v1/send-translation-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify(translationPayload)
      });

      const result = await response.json();
      
      console.log('📥 Resposta do webhook:', {
        status: response.status,
        ok: response.ok,
        result: result
      });

      if (response.ok) {
        console.log('✅ Documento enviado para tradução com sucesso:', result);
        console.log('📋 O n8n deve processar e inserir em documents_to_be_verified');
      } else {
        console.error('❌ Erro ao enviar documento para tradução:', result);
        throw new Error(result.error || 'Failed to send document for translation');
      }

    } catch (error) {
      console.error('Error sending document for translation:', error);
      throw error; // Re-throw para ser tratado pela função que a chamou (ex: verifyPayment)
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending_verification: { 
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200', 
        icon: Clock,
        text: 'Pending Verification'
      },
      pending_manual_review: { 
        color: 'bg-orange-100 text-orange-800 border-orange-200', 
        icon: AlertCircle,
        text: 'Manual Review Required'
      },
      completed: { 
        color: 'bg-green-100 text-green-800 border-green-200', 
        icon: CheckCircle,
        text: 'Verified'
      },
      failed: { 
        color: 'bg-red-100 text-red-800 border-red-200', 
        icon: XCircle,
        text: 'Rejected'
      },
      pending: { 
        color: 'bg-gray-100 text-gray-800 border-gray-200', 
        icon: Clock,
        text: 'Pending'
      }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const IconComponent = config.icon;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${config.color}`}>
        <IconComponent className="w-4 h-4 mr-1" />
        {config.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-6 w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="h-24 bg-gray-200 rounded-lg"></div>
            <div className="h-24 bg-gray-200 rounded-lg"></div>
            <div className="h-24 bg-gray-200 rounded-lg"></div>
            <div className="h-24 bg-gray-200 rounded-lg"></div>
          </div>
          <div className="h-16 bg-gray-200 rounded-lg mb-6"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Zelle Payment Verification</h1>
        <p className="text-gray-600">Review and verify Zelle payment receipts</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Payments</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarIcon className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900">${stats.totalAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-4">
          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name, email, file, code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Filter Controls */}
          <div className="flex items-center space-x-2">
          <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Filter className="w-4 h-4 mr-2" />
              Advanced Filters
              {showAdvancedFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
            </button>
            
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={dateFilter.startDate}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={dateFilter.endDate}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              {/* Amount Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder='0.00'
                  value={amountFilter.min}
                  onChange={(e) => setAmountFilter(prev => ({ ...prev, min: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder='1000.00'
                  value={amountFilter.max}
                  onChange={(e) => setAmountFilter(prev => ({ ...prev, max: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              {/* Sort */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                <div className="flex space-x-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="created_at">Date</option>
                    <option value="amount">Amount</option>
                    <option value="user_name">User</option>
                    <option value="status">Status</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status Filter Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {[
          { key: 'pending_verification', label: 'Pending Verification', count: stats.pending },
          { key: 'pending_manual_review', label: 'Manual Review', count: stats.manualReview },
          { key: 'completed', label: 'Verified', count: stats.completed },
          { key: 'failed', label: 'Rejected', count: stats.failed }
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key as any)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              filter === key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="text-red-800">{error}</span>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedPayments.length > 0 && filter !== 'completed' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-blue-800">
                {selectedPayments.length} payment{selectedPayments.length > 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleBulkApprove}
                disabled={processingPaymentId === 'bulk'}
                className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                {processingPaymentId === 'bulk' ? 'Processing...' : 'Approve Selected'}
              </button>
              <button
                onClick={handleBulkReject}
                disabled={processingPaymentId === 'bulk'}
                className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4 mr-1" />
                {processingPaymentId === 'bulk' ? 'Processing...' : 'Reject Selected'}
              </button>
              <button
                onClick={() => setSelectedPayments([])}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payments List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filteredAndSortedPayments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className='text-lg font-medium'>No payments found</p>
            <p>Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <>
            {/* Table Header - Desktop Only */}
            <div className="hidden md:block bg-gray-50 px-6 py-3 border-b border-gray-200">
              <div className="flex items-center">
                {filter !== 'completed' && (
                  <div className="w-1/12 flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedPayments.length === paginatedPayments.length && paginatedPayments.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>
                )}
                <div className={`${filter !== 'completed' ? 'w-11/12' : 'w-full'} grid grid-cols-5 gap-4 items-center`}>
                  <span className="col-span-2 text-sm font-medium text-gray-700">User & Document</span>
                  <span className="text-sm font-medium text-gray-700">Amount</span>
                  <span className="text-sm font-medium text-gray-700">Status</span>
                  <span className="text-sm font-medium text-gray-700 text-right">Actions</span>
                </div>
              </div>
            </div>

            {/* Table Body */}
          <div className="divide-y divide-gray-200">
              {paginatedPayments.map((payment) => (
                <div key={payment.id} className="p-4 hover:bg-gray-50">
                  {/* Mobile Layout */}
                  <div className="md:hidden space-y-3">
                    {/* Header with checkbox and status */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        {filter !== 'completed' && (
                          <input
                            type="checkbox"
                            checked={selectedPayments.includes(payment.id)}
                            onChange={() => handleSelectPayment(payment.id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        )}
                        <div>
                          <div className="font-medium text-gray-900">
                            {payment.profiles?.name || 'Unknown User'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {payment.profiles?.email}
                          </div>
                        </div>
                      </div>
                      {getStatusBadge(payment.status)}
                    </div>

                    {/* Document and Amount */}
                    <div className={`${filter !== 'completed' ? 'ml-7' : 'ml-0'} space-y-2`}>
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600 truncate" title={payment.documents?.filename}>
                          {payment.documents?.filename || 'Unknown File'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">
                          ${payment.amount.toFixed(2)} USD
                        </span>
                      </div>
                      {payment.zelle_confirmation_code && (
                        <div className="text-xs text-green-600 font-mono">
                          Code: {payment.zelle_confirmation_code}
                      </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="ml-7 flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedReceipt(payment)}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </button>
                      
                      {(payment.status === 'pending_verification' || payment.status === 'pending_manual_review') && (
                        <>
                          <button
                            onClick={() => verifyPayment(payment.id, true)}
                            disabled={processingPaymentId === payment.id || sendingToTranslation === payment.id}
                            className="inline-flex items-center px-3 py-2 border border-transparent rounded text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </button>
                          <button
                            onClick={() => openRejectionModal(payment)}
                            disabled={processingPaymentId === payment.id || sendingToTranslation === payment.id}
                            className="inline-flex items-center px-3 py-2 border border-transparent rounded text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Desktop Layout */}
                  <div className="hidden md:flex items-center">
                    {/* Checkbox */}
                    {filter !== 'completed' && (
                      <div className="w-1/12">
                        <input
                          type="checkbox"
                          checked={selectedPayments.includes(payment.id)}
                          onChange={() => handleSelectPayment(payment.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </div>
                    )}

                    {/* Payment Details */}
                    <div className={`${filter !== 'completed' ? 'w-11/12' : 'w-full'} grid grid-cols-5 gap-4 items-center`}>
                      {/* User & Document Info */}
                      <div className="col-span-2 flex items-center space-x-3">
                        <User className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-gray-900">
                            {payment.profiles?.name || 'Unknown User'}
                        </div>
                          <div className="text-sm text-gray-500 truncate" title={payment.documents?.filename}>
                            {payment.documents?.filename || 'Unknown File'}
                          </div>
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="flex items-center space-x-2">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            ${payment.amount.toFixed(2)} USD
                          </div>
                          {payment.zelle_confirmation_code && (
                            <div className="text-xs text-green-600 font-mono" title={`Confirmation Code: ${payment.zelle_confirmation_code}`}>
                              Code: {payment.zelle_confirmation_code}
                        </div>
                      )}
                    </div>
                  </div>

                      {/* Status */}
                      <div className="flex items-center">
                        {getStatusBadge(payment.status)}
                  </div>

                  {/* Actions */}
                      <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => setSelectedReceipt(payment)}
                          className="inline-flex items-center p-2 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                          <Eye className="w-4 h-4" />
                    </button>
                    
                    {(payment.status === 'pending_verification' || payment.status === 'pending_manual_review') && (
                          <>
                        <button
                          onClick={() => verifyPayment(payment.id, true)}
                          disabled={processingPaymentId === payment.id || sendingToTranslation === payment.id}
                              className="inline-flex items-center p-2 border border-transparent rounded text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                        >
                              <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openRejectionModal(payment)}
                          disabled={processingPaymentId === payment.id || sendingToTranslation === payment.id}
                              className="inline-flex items-center p-2 border border-transparent rounded text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                        >
                              <XCircle className="w-4 h-4" />
                        </button>
                          </>
                    )}
                      </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>

      {/* CORREÇÃO: Movi a paginação para fora do bloco de filtros avançados */}
      {totalPages > 1 && (
        <div className="bg-white px-6 py-3 border-t border-gray-200 flex items-center justify-between mt-4 rounded-lg">
          <div className="flex items-center text-sm text-gray-700">
            <span>
              Showing <strong>{((currentPage - 1) * itemsPerPage) + 1}</strong> to <strong>{Math.min(currentPage * itemsPerPage, filteredAndSortedPayments.length)}</strong> of <strong>{filteredAndSortedPayments.length}</strong> results
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <span className='text-sm text-gray-500'>Page {currentPage} of {totalPages}</span>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}


      {/* Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Payment Receipt</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedReceipt.profiles?.name} • ${selectedReceipt.amount.toFixed(2)} USD
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <a
                  href={selectedReceipt.receipt_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  Open in New Tab
                </a>
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 flex-grow overflow-auto">
              <div className="text-center">
                <img
                  src={selectedReceipt.receipt_url}
                  alt="Payment Receipt"
                  className="max-w-full max-h-full mx-auto rounded-lg shadow-lg"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = `
                        <div class="flex flex-col items-center justify-center p-8 text-gray-500">
                          <FileText class="w-12 h-12 mb-4" />
                          <p>Unable to display receipt image</p>
                          <a href="${selectedReceipt.receipt_url}" target="_blank" class="text-blue-600 hover:underline mt-2">
                            View Original File
                          </a>
                        </div>
                      `;
                    }
                  }}
                />
              </div>
            </div>

            {/* Modal Actions */}
            {(selectedReceipt.status === 'pending_verification' || selectedReceipt.status === 'pending_manual_review') && (
              <div className="p-6 border-t border-gray-200 flex justify-end space-x-3 bg-gray-50">
                <button
                  onClick={() => openRejectionModal(selectedReceipt)}
                  disabled={processingPaymentId === selectedReceipt.id}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </button>
                <button
                  onClick={() => verifyPayment(selectedReceipt.id, true)}
                  disabled={processingPaymentId === selectedReceipt.id || sendingToTranslation === selectedReceipt.id}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {sendingToTranslation === selectedReceipt.id ? 'Sending...' : 
                   processingPaymentId === selectedReceipt.id ? 'Approving...' : 'Approve'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectionModal.isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeRejectionModal}></div>
            <div className="relative bg-white rounded-lg max-w-md w-full">
              <div className="px-6 pt-6">
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-medium text-gray-900">
                    Reject Payment
                  </h3>
                  <button
                    onClick={closeRejectionModal}
                    className="ml-3 flex h-7 w-7 items-center justify-center rounded-full bg-transparent text-gray-400 hover:bg-gray-100 hover:text-gray-500"
                  >
                    <XCircle className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="mt-4">
                  <p className="text-sm text-gray-500 mb-4">
                    Please select a reason for rejecting this payment. The user will be notified.
                  </p>
                  
                  <div className="space-y-2">
                    {[
                      'Incorrect amount',
                      'Invalid payment method',
                      'Duplicate payment',
                      'Suspicious activity',
                      'Incomplete information',
                      'Document quality issues'
                    ].map((reason) => (
                      <label key={reason} className="flex items-center">
                        <input
                          type="radio"
                          name="rejectionReason"
                          value={reason}
                          checked={rejectionReason === reason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                        />
                        <span className="ml-2 text-sm text-gray-700">{reason}</span>
                      </label>
                    ))}
                    
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="rejectionReason"
                        value="custom"
                        checked={rejectionReason === 'custom'}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">Other (specify below)</span>
                    </label>
                  </div>

                  {rejectionReason === 'custom' && (
                    <div className="mt-3">
                      <textarea
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        placeholder="Please specify the reason for rejection..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end space-x-3">
                <button
                  onClick={closeRejectionModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectPayment}
                  disabled={sendingRejection || !rejectionReason || (rejectionReason === 'custom' && !customReason.trim())}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingRejection ? 'Rejecting...' : 'Reject Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Code Modal */}
      {confirmationModal.isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeConfirmationModal}></div>
            <div className="relative bg-white rounded-lg max-w-md w-full">
              <div className="px-6 pt-6">
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-medium text-gray-900">
                    Zelle Confirmation Code
                  </h3>
                  <button
                    onClick={closeConfirmationModal}
                    className="ml-3 flex h-7 w-7 items-center justify-center rounded-full bg-transparent text-gray-400 hover:bg-gray-100 hover:text-gray-500"
                  >
                    <XCircle className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div className="px-6 py-4">
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-3">
                    This Zelle payment requires a confirmation code before it can be approved. 
                    Please enter the confirmation code provided by the user.
                  </p>
                  
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <AlertCircle className="h-5 w-5 text-yellow-400" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-yellow-700">
                          <strong>User:</strong> {confirmationModal.payment?.profiles?.name}<br/>
                          <strong>Email:</strong> {confirmationModal.payment?.profiles?.email}<br/>
                          <strong>Amount:</strong> ${confirmationModal.payment?.amount}
                        </p>
                      </div>
                    </div>
                  </div>

                  <label htmlFor="confirmation-code" className="block text-sm font-medium text-gray-700 mb-2">
                    Zelle Confirmation Code
                  </label>
                  <input
                    type="text"
                    id="confirmation-code"
                    value={confirmationCode}
                    onChange={(e) => setConfirmationCode(e.target.value)}
                    placeholder="Enter confirmation code..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                  />
                </div>

                {error && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative text-sm">
                    {error}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end space-x-3">
                <button
                  onClick={closeConfirmationModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveConfirmationCode}
                  disabled={savingConfirmationCode || !confirmationCode.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingConfirmationCode ? 'Saving & Approving...' : 'Save and Approve'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}