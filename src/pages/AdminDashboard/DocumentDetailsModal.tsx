import React, { useState, useEffect } from 'react';
import { XCircle, FileText, User, Calendar, Hash, Eye, Download, Phone, CreditCard, AlertTriangle, Edit, Save, X } from 'lucide-react';
import { getStatusColor, getStatusIcon } from '../../utils/documentUtils';
import { Document } from '../../App';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../contexts/I18nContext';
import { Logger } from '../../lib/loggingHelpers';
import { ActionTypes } from '../../types/actionTypes';

// A interface para as propriedades do componente permanece a mesma.

type TranslatedDocument = {
  id: string;
  filename: string;
  user_id: string;
  pages: number;
  status: string;
  total_cost: number;
  source_language: string;
  target_language: string;
  translated_file_url: string;
  created_at: string;
  is_authenticated: boolean;
  verification_code: string;
  original_document_id?: string;
};

type PaymentInfo = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  payment_date: string;
  stripe_session_id: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  refund_id: string | null;
  refund_amount: number | null;
};

type DocumentDetailsModalProps = {
  document: Document | TranslatedDocument | null;
  onClose: () => void;
};

// A definição do componente funcional é adicionada aqui.
// Toda a lógica do componente deve estar dentro desta função.
export const DocumentDetailsModal: React.FC<DocumentDetailsModalProps> = ({ document, onClose }) => {
  const { t } = useI18n();
  
  // Hooks de estado 
  const [userProfile, setUserProfile] = useState<{ name: string; email: string; phone: string | null } | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [translatedDoc, setTranslatedDoc] = useState<TranslatedDocument | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  
  // Modal de Visualização de Documento
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'pdf' | 'image' | 'unknown'>('unknown');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState(false);
  const [userEditData, setUserEditData] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [savingUser, setSavingUser] = useState(false);
  const [userEditError, setUserEditError] = useState<string | null>(null);
  const [editingFile, setEditingFile] = useState(false);
  const [fileEditData, setFileEditData] = useState({
    filename: '',
    pages: 0,
    total_cost: 0,
    source_language: '',
    target_language: '',
    is_bank_statement: false,
    is_authenticated: false
  });
  const [savingFile, setSavingFile] = useState(false);
  const [fileEditError, setFileEditError] = useState<string | null>(null);

  // Hook useEffect para buscar dados quando o documento muda
  useEffect(() => {
    if (document) {
      fetchUserProfile();
      fetchPaymentInfo();
      // Se o documento não tem translated_file_url, busca o documento traduzido pelo user_id
      if (!(document as any).translated_file_url) {
        fetchTranslatedDocument();
      }
    }
  }, [document]);

  const fetchTranslatedDocument = async () => {
    if (!document) return;
    console.log('🔍 Buscando documento traduzido para user_id:', document.user_id);
    try {
      const { data, error } = await supabase
        .from('translated_documents')
        .select('*')
        .eq('user_id', document.user_id)
        .single();
      
      console.log('✅ Resultado da busca - data:', data);
      console.log('❌ Resultado da busca - error:', error);
      
      if (!error && data) {
        console.log('🎯 Documento traduzido encontrado:', data);
        console.log('🔗 URL do arquivo traduzido:', data.translated_file_url);
        setTranslatedDoc(data);
      } else {
        console.log('❌ Nenhum documento traduzido encontrado para este user_id');
        setTranslatedDoc(null);
      }
    } catch (err) {
      console.log('💥 Erro na busca:', err);
      setTranslatedDoc(null);
    } finally {
      // Loading state removed
    }
  };

  const fetchUserProfile = async () => {
    if (!document) return;
    
    setLoadingProfile(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, email, phone')
        .eq('id', document.user_id)
        .single();
      
      if (error) {
        console.error('Error fetching user profile:', error);
      } else {
        setUserProfile(data);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchPaymentInfo = async () => {
    if (!document) return;
    
    setLoadingPayment(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('document_id', document.id)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching payment info:', error);
      } else if (data) {
        setPaymentInfo(data);
      }
    } catch (err) {
      console.error('Error fetching payment info:', err);
    } finally {
      setLoadingPayment(false);
    }
  };
  
  const handleDownload = async () => {
    // Verifica se o documento foi aprovado pelo autenticador
    const isApproved = (document as any)?.is_authenticated === true || 
                      (document as any)?.status === 'approved' || 
                      (document as any)?.status === 'completed';
    
    let url: string | null = null;
    let filename: string = '';
    
    if (isApproved) {
      // Se aprovado, prioriza o arquivo traduzido
      url = translatedDoc?.translated_file_url || (document as any)?.translated_file_url;
      filename = translatedDoc?.filename || (document as any)?.filename || 'document.pdf';
      
      // Se não encontrou arquivo traduzido, usa o arquivo original como fallback
      if (!url) {
        url = (document as any)?.file_url;
        filename = (document as any)?.filename || 'document.pdf';
      }
    } else {
      // Se não aprovado, faz download apenas do arquivo original
      url = (document as any)?.file_url;
      filename = (document as any)?.filename || 'document.pdf';
    }
    
    if (url && filename) {
      try {
        // Extrair filePath e bucket da URL
        const { extractFilePathFromUrl } = await import('../../utils/fileUtils');
        const pathInfo = extractFilePathFromUrl(url);
        
        if (!pathInfo) {
          // Se não conseguir extrair, tentar download direto da URL (para S3 externo)
          try {
            const response = await fetch(url);
            if (response.ok) {
              const blob = await response.blob();
              const objUrl = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = objUrl;
              link.download = filename;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.URL.revokeObjectURL(objUrl);
              return;
            }
          } catch (error) {
            alert('Não foi possível acessar o arquivo. Verifique sua conexão.');
            return;
          }
        }
        
        // Usar download direto
        const { db } = await import('../../lib/supabase');
        const success = await db.downloadFileAndTrigger(pathInfo.filePath, filename, pathInfo.bucket);
        
        if (!success) {
          alert('Não foi possível baixar o arquivo. Por favor, tente novamente.');
        }
      } catch (error) {
        console.error('Error downloading file:', error);
        alert(`Erro ao fazer download do arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    } else {
      alert('Arquivo não disponível para download');
    }
  };

  function detectPreviewType(url: string, filename?: string | null): 'pdf' | 'image' | 'unknown' {
    const name = (filename || url).toLowerCase();
    if (name.endsWith('.pdf')) return 'pdf';
    if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.gif') || name.endsWith('.webp')) return 'image';
    // Heurística para URLs sem extensão
    if (url.includes('content-type=application%2Fpdf')) return 'pdf';
    return 'unknown';
  }

  const handleViewFile = async () => {
    console.log('👁️ handleViewFile chamado');
    console.log('📄 document:', document);
    console.log('📑 translatedDoc:', translatedDoc);
    
    try {
      setPreviewLoading(true);
      setPreviewError(null);
      
      // Verifica se o documento foi aprovado pelo autenticador
      const isApproved = (document as any)?.is_authenticated === true || 
                        (document as any)?.status === 'approved' || 
                        (document as any)?.status === 'completed';
      
      console.log('✅ Documento aprovado:', isApproved);
      
      let url: string | null = null;
      
      if (isApproved) {
        // Se aprovado, prioriza o arquivo traduzido
        url = translatedDoc?.translated_file_url || (document as any)?.translated_file_url;
        
        // Se não encontrou arquivo traduzido, usa o arquivo original como fallback
        if (!url) {
          url = (document as any)?.file_url;
        }
      } else {
        // Se não aprovado, mostra apenas o arquivo original
        url = (document as any)?.file_url;
      }
      
      if (!url) {
        setPreviewError('No document available to view.');
        setPreviewOpen(true);
        return;
      }
      
      console.log(`🔗 Abrindo arquivo:`, url);
      
      // SEMPRE gerar um novo signed URL para visualização
      const { db } = await import('../../lib/supabase');
      const viewUrl = await db.generateViewUrl(url);
      
      if (!viewUrl) {
        throw new Error('Não foi possível gerar link para visualização. Por favor, tente novamente.');
      }
      
      setPreviewUrl(viewUrl);
      setPreviewType(detectPreviewType(viewUrl, (document as any)?.filename));
      setPreviewOpen(true);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to open document.');
      setPreviewOpen(true);
    } finally {
      setPreviewLoading(false);
    }
  };

  async function downloadPreview(filename?: string | null) {
    if (!previewUrl) return;
    
    // Usar URL original do documento para download, não o previewUrl (signed URL)
    const isApproved = (document as any)?.is_authenticated === true || 
                      (document as any)?.status === 'approved' || 
                      (document as any)?.status === 'completed';
    
    let originalUrl: string | null = null;
    if (isApproved) {
      originalUrl = translatedDoc?.translated_file_url || (document as any)?.translated_file_url;
      if (!originalUrl) {
        originalUrl = (document as any)?.file_url;
      }
    } else {
      originalUrl = (document as any)?.file_url;
    }
    
    if (!originalUrl) {
      alert('URL do arquivo não disponível.');
      return;
    }
    
    try {
      const downloadFilename = filename || (document as any)?.filename || 'document';
      const { extractFilePathFromUrl } = await import('../../utils/fileUtils');
      
      // Extrair filePath da URL ORIGINAL, não do signed URL
      const pathInfo = extractFilePathFromUrl(originalUrl);
      
      if (!pathInfo) {
        // Se não conseguir extrair, tentar download direto da URL original
        try {
          const response = await fetch(originalUrl);
          if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = downloadFilename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            return;
          }
        } catch (fetchError) {
          console.error('Erro no download direto:', fetchError);
          alert('Não foi possível acessar o arquivo. Verifique sua conexão.');
          return;
        }
      }
      
      // Usar download autenticado direto usando a URL original
      const { db } = await import('../../lib/supabase');
      const success = await db.downloadFileAndTrigger(pathInfo.filePath, downloadFilename, pathInfo.bucket);
      
      if (!success) {
        alert('Não foi possível baixar o arquivo. Verifique se você está autenticado.');
      }
    } catch (err) {
      console.error('Error downloading preview:', err);
      alert(`Erro ao baixar arquivo: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    }
  }

  const cancellationReasons = [
    { value: 'fraud', label: 'Suspected Fraud' },
    { value: 'duplicate', label: 'Duplicate Payment' },
    { value: 'customer_request', label: 'Customer Request' },
    { value: 'processing_error', label: 'Processing Error' },
    { value: 'refund_request', label: 'Refund Request' },
    { value: 'custom', label: 'Other (specify)' }
  ];

  const handleCancelPayment = async () => {
    if (!paymentInfo || !cancellationReason) return;

    const finalReason = cancellationReason === 'custom' 
      ? customReason.trim() 
      : cancellationReason;

    if (!finalReason) {
      setError('Please select or enter a cancellation reason');
      return;
    }

    setCancelling(true);
    setError(null);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Call the cancel payment function
      const { data, error } = await supabase.functions.invoke('cancel-stripe-payment', {
        body: {
          paymentId: paymentInfo.id,
          reason: finalReason,
          adminUserId: user.id
        }
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        // Reload payment info
        await fetchPaymentInfo();
        
        // Close modal
        setShowCancelModal(false);
        setCancellationReason('');
        setCustomReason('');
      } else {
        throw new Error(data?.error || 'Failed to cancel payment');
      }
    } catch (err: any) {
      console.error('Error cancelling payment:', err);
      setError(err.message || 'Failed to cancel payment');
    } finally {
      setCancelling(false);
    }
  };

  const openCancelModal = () => {
    setShowCancelModal(true);
    setCancellationReason('');
    setCustomReason('');
    setError(null);
  };

  const closeCancelModal = () => {
    setShowCancelModal(false);
    setCancellationReason('');
    setCustomReason('');
    setError(null);
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const startEditingUser = () => {
    if (userProfile) {
      setUserEditData({
        name: userProfile.name || '',
        email: userProfile.email || '',
        phone: userProfile.phone || ''
      });
      setEditingUser(true);
      setUserEditError(null);
    }
  };

  const cancelEditingUser = () => {
    setEditingUser(false);
    setUserEditData({
      name: '',
      email: '',
      phone: ''
    });
    setUserEditError(null);
  };

  const saveUserChanges = async () => {
    if (!document || !userProfile) return;

    setSavingUser(true);
    setUserEditError(null);

    try {
      // Validate required fields
      if (!userEditData.name.trim()) {
        throw new Error('Name is required');
      }
      if (!userEditData.email.trim()) {
        throw new Error('Email is required');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userEditData.email)) {
        throw new Error('Please enter a valid email address');
      }

      // Update user profile
      const { error } = await supabase
        .from('profiles')
        .update({
          name: userEditData.name.trim(),
          email: userEditData.email.trim(),
          phone: userEditData.phone.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', document.user_id);

      if (error) {
        throw error;
      }

      // Update local state
      setUserProfile({
        name: userEditData.name.trim(),
        email: userEditData.email.trim(),
        phone: userEditData.phone.trim() || null
      });

      // Log de edição de usuário
      const changedFields = [];
      if (userProfile.name !== userEditData.name.trim()) changedFields.push('name');
      if (userProfile.email !== userEditData.email.trim()) changedFields.push('email');
      if (userProfile.phone !== (userEditData.phone.trim() || null)) changedFields.push('phone');

      if (changedFields.length > 0) {
        await Logger.log(
          ActionTypes.USER_ROLE_UPDATED,
          `User profile updated for ${userEditData.name}`,
          {
            entityType: 'user',
            entityId: document.user_id,
            metadata: {
              changed_fields: changedFields,
              user_name: userEditData.name.trim(),
              user_email: userEditData.email.trim(),
              timestamp: new Date().toISOString()
            },
            affectedUserId: document.user_id,
            performerType: 'admin'
          }
        );
      }

      setEditingUser(false);
    } catch (err: any) {
      console.error('Error updating user profile:', err);
      setUserEditError(err.message || 'Failed to update user information');
    } finally {
      setSavingUser(false);
    }
  };

  const startEditingFile = () => {
    if (document) {
      setFileEditData({
        filename: (document as any).filename || '',
        pages: (document as any).pages || 0,
        total_cost: (document as any).total_cost || 0,
        source_language: (document as any).source_language || (document as any).idioma_raiz || '',
        target_language: (document as any).target_language || '',
        is_bank_statement: (document as any).is_bank_statement || false,
        is_authenticated: (document as any).is_authenticated || false
      });
      setEditingFile(true);
      setFileEditError(null);
    }
  };

  const cancelEditingFile = () => {
    setEditingFile(false);
    setFileEditData({
      filename: '',
      pages: 0,
      total_cost: 0,
      source_language: '',
      target_language: '',
      is_bank_statement: false,
      is_authenticated: false
    });
    setFileEditError(null);
  };

  const saveFileChanges = async () => {
    if (!document) return;

    setSavingFile(true);
    setFileEditError(null);

    try {
      // Validate required fields
      if (!fileEditData.filename.trim()) {
        throw new Error('Filename is required');
      }
      if (fileEditData.pages <= 0) {
        throw new Error('Number of pages must be greater than 0');
      }
      if (fileEditData.total_cost < 0) {
        throw new Error('Total cost cannot be negative');
      }

      // Update document information
      const updateData: any = {
        filename: fileEditData.filename.trim(),
        pages: fileEditData.pages,
        total_cost: fileEditData.total_cost,
        source_language: fileEditData.source_language.trim() || null,
        target_language: fileEditData.target_language.trim() || null,
        is_bank_statement: fileEditData.is_bank_statement,
        is_authenticated: fileEditData.is_authenticated,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('documents')
        .update(updateData)
        .eq('id', document.id);

      if (error) {
        throw error;
      }

      // Log de edição de documento
      const changedFields = [];
      const doc = document as any;
      if (doc.filename !== fileEditData.filename.trim()) changedFields.push('filename');
      if (doc.pages !== fileEditData.pages) changedFields.push('pages');
      if (doc.total_cost !== fileEditData.total_cost) changedFields.push('total_cost');
      if (doc.source_language !== fileEditData.source_language.trim()) changedFields.push('source_language');
      if (doc.target_language !== fileEditData.target_language.trim()) changedFields.push('target_language');
      if (doc.is_bank_statement !== fileEditData.is_bank_statement) changedFields.push('is_bank_statement');
      if (doc.is_authenticated !== fileEditData.is_authenticated) changedFields.push('is_authenticated');

      if (changedFields.length > 0) {
        await Logger.log(
          ActionTypes.DOCUMENT_EDITED,
          `Document edited: ${fileEditData.filename}`,
          {
            entityType: 'document',
            entityId: document.id,
            metadata: {
              changed_fields: changedFields,
              filename: fileEditData.filename.trim(),
              pages: fileEditData.pages,
              total_cost: fileEditData.total_cost,
              timestamp: new Date().toISOString()
            },
            affectedUserId: document.user_id,
            performerType: 'admin'
          }
        );
      }

      // Update local state - we need to trigger a re-render
      // The parent component should handle refreshing the document data
      setEditingFile(false);
      
      // Show success message or trigger parent refresh
      alert('File information updated successfully!');
      
    } catch (err: any) {
      console.error('Error updating file information:', err);
      setFileEditError(err.message || 'Failed to update file information');
    } finally {
      setSavingFile(false);
    }
  };

  // Verificação para renderização nula, se não houver documento.
  if (!document) return null;

  // A declaração de retorno (JSX) permanece no final.
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">{t('admin.documents.table.modal.title')}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="Close modal"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          {/* File Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-blue-600" />
                <h4 className="text-lg font-semibold text-gray-900">{t('admin.documents.table.modal.fileInformation')}</h4>
              </div>
              {!editingFile && (
                <button
                  onClick={startEditingFile}
                  className="flex items-center gap-2 px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  {t('admin.documents.table.modal.edit')}
                </button>
              )}
            </div>
            
            {editingFile ? (
              <div className="space-y-4">
                {fileEditError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{fileEditError}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.documents.table.modal.filename')} *</label>
                    <input
                      type="text"
                      value={fileEditData.filename}
                      onChange={(e) => setFileEditData(prev => ({ ...prev, filename: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t('admin.documents.table.modal.enterFilename')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.documents.table.modal.pages')} *</label>
                    <input
                      type="number"
                      min="1"
                      value={fileEditData.pages}
                      onChange={(e) => setFileEditData(prev => ({ ...prev, pages: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t('admin.documents.table.modal.enterPages')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.documents.table.modal.totalCost')} *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={fileEditData.total_cost}
                        onChange={(e) => setFileEditData(prev => ({ ...prev, total_cost: parseFloat(e.target.value) || 0 }))}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.documents.table.modal.status')}</label>
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(document as any)}`}>
                        {getStatusIcon(document as any)}
                        <span className="ml-1 capitalize">
                          {(document as any).translated_file_url ? 'Completed' : (document as any).status}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.documents.table.modal.sourceLanguage')}</label>
                    <input
                      type="text"
                      value={fileEditData.source_language}
                      onChange={(e) => setFileEditData(prev => ({ ...prev, source_language: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t('admin.documents.table.modal.enterSourceLanguage')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.documents.table.modal.targetLanguage')}</label>
                    <input
                      type="text"
                      value={fileEditData.target_language}
                      onChange={(e) => setFileEditData(prev => ({ ...prev, target_language: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t('admin.documents.table.modal.enterTargetLanguage')}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="is_bank_statement"
                      checked={fileEditData.is_bank_statement}
                      onChange={(e) => setFileEditData(prev => ({ ...prev, is_bank_statement: e.target.checked }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="is_bank_statement" className="text-sm font-medium text-gray-700">
{t('admin.documents.table.modal.bankStatement')}
                    </label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="is_authenticated"
                      checked={fileEditData.is_authenticated}
                      onChange={(e) => setFileEditData(prev => ({ ...prev, is_authenticated: e.target.checked }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="is_authenticated" className="text-sm font-medium text-gray-700">
{t('admin.documents.table.modal.authenticated')}
                    </label>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={cancelEditingFile}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                    {t('admin.documents.table.modal.cancel')}
                  </button>
                  <button
                    onClick={saveFileChanges}
                    disabled={savingFile || !fileEditData.filename.trim() || fileEditData.pages <= 0 || fileEditData.total_cost < 0}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    <Save className="w-4 h-4" />
{savingFile ? t('admin.documents.table.modal.saving') : t('admin.documents.table.modal.saveChanges')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">{t('admin.documents.table.modal.filename')}</label>
                  <p className="text-gray-900 break-all">{(document as any).filename}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">{t('admin.documents.table.modal.pages')}</label>
                  <p className="text-gray-900">{(document as any).pages}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">{t('admin.documents.table.modal.totalCost')}</label>
                  <p className="text-gray-900 font-semibold">${(document as any).total_cost}.00</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">{t('admin.documents.table.modal.status')}</label>
                  <div className="mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(document as any)}`}>
                      {getStatusIcon(document as any)}
                      <span className="ml-1 capitalize">
                        {(document as any).translated_file_url ? 'Completed' : (document as any).status}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <User className="w-6 h-6 text-green-600" />
                <h4 className="text-lg font-semibold text-gray-900">{t('admin.documents.table.modal.userInformation')}</h4>
              </div>
              {userProfile && !editingUser && (
                <button
                  onClick={startEditingUser}
                  className="flex items-center gap-2 px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <Edit className="w-4 h-4" />
{t('admin.documents.table.modal.edit')}
                </button>
              )}
            </div>
            
            {loadingProfile ? (
              <div className="text-gray-500">{t('admin.documents.table.modal.loadingUserInfo')}</div>
            ) : userProfile ? (
              <>
                {editingUser ? (
                <div className="space-y-4">
                  {userEditError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800">{userEditError}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.documents.table.modal.name')} *</label>
                      <input
                        type="text"
                        value={userEditData.name}
                        onChange={(e) => setUserEditData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t('admin.documents.table.modal.enterFullName')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.documents.table.modal.email')} *</label>
                      <input
                        type="email"
                        value={userEditData.email}
                        onChange={(e) => setUserEditData(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t('admin.documents.table.modal.enterEmail')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                        <Phone className="w-4 h-4" />
{t('admin.documents.table.modal.phoneNumber')}
                      </label>
                      <input
                        type="tel"
                        value={userEditData.phone}
                        onChange={(e) => setUserEditData(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t('admin.documents.table.modal.enterPhoneOptional')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.documents.table.modal.userId')}</label>
                      <p className="text-gray-900 font-mono text-sm break-all bg-gray-100 px-3 py-2 rounded-md">{document.user_id}</p>
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={cancelEditingUser}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                      {t('admin.documents.table.modal.cancel')}
                    </button>
                    <button
                      onClick={saveUserChanges}
                      disabled={savingUser || !userEditData.name.trim() || !userEditData.email.trim()}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      <Save className="w-4 h-4" />
{savingUser ? t('admin.documents.table.modal.saving') : t('admin.documents.table.modal.saveChanges')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">{t('admin.documents.table.modal.name')}</label>
                    <p className="text-gray-900">{userProfile.name || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">{t('admin.documents.table.modal.email')}</label>
                    <p className="text-gray-900 break-all">{userProfile.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                      <Phone className="w-4 h-4" />
{t('admin.documents.table.modal.phoneNumber')}
                    </label>
                    <p className="text-gray-900">{userProfile.phone || t('admin.documents.table.modal.notProvided')}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">{t('admin.documents.table.modal.userId')}</label>
                    <p className="text-gray-900 font-mono text-sm break-all">{document.user_id}</p>
                  </div>
                </div>
              )}
            </>
            ) : (
              <div className="text-gray-500">{t('admin.documents.table.modal.userInfoNotAvailable')}</div>
            )}
          </div>
          
          {/* Document Details */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <Hash className="w-6 h-6 text-purple-600" />
              <h4 className="text-lg font-semibold text-gray-900">{t('admin.documents.table.modal.documentDetails')}</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">{t('admin.documents.table.modal.translationType')}</label>
                <p className="text-gray-900">{'tipo_trad' in (document || {}) ? (document as any).tipo_trad : t('admin.documents.table.modal.notSpecified')}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('admin.documents.table.modal.sourceLanguage')}</label>
                <p className="text-gray-900">{
                  (document as any).source_language || 
                  (document as any).idioma_raiz || 
                  t('admin.documents.table.modal.notSpecified')
                }</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('admin.documents.table.modal.bankStatement')}</label>
                <p className="text-gray-900">{(document as any).is_bank_statement ? t('admin.documents.table.modal.yes') : t('admin.documents.table.modal.no')}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('admin.documents.table.modal.authenticated')}</label>
                <p className="text-gray-900">{(document as any).is_authenticated ? t('admin.documents.table.modal.yes') : t('admin.documents.table.modal.no')}</p>
              </div>
            </div>
          </div>
          
          {/* Dates */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <Calendar className="w-6 h-6 text-orange-600" />
              <h4 className="text-lg font-semibold text-gray-900">{t('admin.documents.table.modal.timeline')}</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">{t('admin.documents.table.modal.created')}</label>
                <p className="text-gray-900">{(document as any).created_at ? new Date((document as any).created_at).toLocaleString() : 'Not available'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('admin.documents.table.modal.lastUpdated')}</label>
                <p className="text-gray-900">{(document as any).updated_at ? new Date((document as any).updated_at).toLocaleString() : 'Not available'}</p>
              </div>
            </div>
          </div>
          
          {/* Verification */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <Hash className="w-6 h-6 text-red-600" />
              <h4 className="text-lg font-semibold text-gray-900">{t('admin.documents.table.modal.verification')}</h4>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">{t('admin.documents.table.modal.verificationCode')}</label>
              <p className="text-gray-900 font-mono text-sm break-all">{document.verification_code}</p>
            </div>
          </div>

          {/* {t('admin.documents.table.modal.paymentInformation')} */}
          {loadingPayment ? (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <CreditCard className="w-6 h-6 text-blue-600" />
                <h4 className="text-lg font-semibold text-gray-900">{t('admin.documents.table.modal.paymentInformation')}</h4>
              </div>
              <div className="text-gray-500">{t('admin.documents.table.modal.loadingPaymentInfo')}</div>
            </div>
          ) : paymentInfo ? (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <CreditCard className="w-6 h-6 text-blue-600" />
                <h4 className="text-lg font-semibold text-gray-900">{t('admin.documents.table.modal.paymentInformation')}</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">{t('admin.documents.table.modal.amount')}</label>
                  <p className="text-gray-900 font-semibold">{formatCurrency(paymentInfo.amount, paymentInfo.currency)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">{t('admin.documents.table.modal.status')}</label>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    paymentInfo.status === 'completed' 
                      ? 'bg-green-100 text-green-800'
                      : paymentInfo.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : paymentInfo.status === 'cancelled'
                      ? 'bg-red-100 text-red-800'
                      : paymentInfo.status === 'refunded'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {paymentInfo.status}
                  </span>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">{t('admin.documents.table.modal.paymentMethod')}</label>
                  <p className="text-gray-900">{paymentInfo.payment_method || 'Stripe'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">{t('admin.documents.table.modal.paymentDate')}</label>
                  <p className="text-gray-900">{formatDate(paymentInfo.payment_date)}</p>
                </div>
                {paymentInfo.stripe_session_id && (
                  <div className="sm:col-span-2">
                    <label className="text-sm font-medium text-gray-700">{t('admin.documents.table.modal.stripeSessionId')}</label>
                    <p className="text-gray-900 font-mono text-sm break-all">{paymentInfo.stripe_session_id}</p>
                  </div>
                )}
                {paymentInfo.cancelled_at && (
                  <>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Cancelled At</label>
                      <p className="text-gray-900">{formatDate(paymentInfo.cancelled_at)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Cancellation Reason</label>
                      <p className="text-gray-900">{paymentInfo.cancellation_reason}</p>
                    </div>
                  </>
                )}
                {paymentInfo.refund_id && (
                  <>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Refund ID</label>
                      <p className="text-gray-900 font-mono text-sm break-all">{paymentInfo.refund_id}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Refund Amount</label>
                      <p className="text-gray-900">{formatCurrency(paymentInfo.refund_amount || paymentInfo.amount, paymentInfo.currency)}</p>
                    </div>
                  </>
                )}
              </div>
              
              {/* Payment Actions */}
              {paymentInfo.stripe_session_id && 
               (paymentInfo.status === 'completed' || paymentInfo.status === 'pending') && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-sm font-medium text-gray-900">{t('admin.documents.table.modal.paymentActions')}</h5>
                      <p className="text-sm text-gray-500">{t('admin.documents.table.modal.cancelAndRefund')}</p>
                    </div>
                    <button
                      onClick={openCancelModal}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                    >
{t('admin.documents.table.modal.cancelPayment')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <CreditCard className="w-6 h-6 text-blue-600" />
                <h4 className="text-lg font-semibold text-gray-900">{t('admin.documents.table.modal.paymentInformation')}</h4>
              </div>
              <div className="text-gray-500">{t('admin.documents.table.modal.noPaymentInfo')}</div>
            </div>
          )}

          {/* Actions */}
          {((document as any).translated_file_url || (document as any).file_url) && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-blue-900 mb-3">{t('admin.documents.table.modal.fileActions')}</h4>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleViewFile}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  {(() => {
                    const isApproved = (document as any)?.is_authenticated === true || 
                                      (document as any)?.status === 'approved' || 
                                      (document as any)?.status === 'completed';
                    const hasTranslated = translatedDoc?.translated_file_url || (document as any)?.translated_file_url;
                    
                    if (isApproved && hasTranslated) {
                      return t('admin.documents.table.modal.viewTranslated');
                    } else {
                      return t('admin.documents.table.modal.viewOriginal');
                    }
                  })()}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {(() => {
                    const isApproved = (document as any)?.is_authenticated === true || 
                                      (document as any)?.status === 'approved' || 
                                      (document as any)?.status === 'completed';
                    const hasTranslated = translatedDoc?.translated_file_url || (document as any)?.translated_file_url;
                    
                    if (isApproved && hasTranslated) {
                      return t('admin.documents.table.modal.downloadTranslated');
                    } else {
                      return t('admin.documents.table.modal.downloadOriginal');
                    }
                  })()}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
{t('admin.documents.table.modal.close')}
          </button>
        </div>
      </div>

      {/* Cancel Payment Modal */}
      {showCancelModal && paymentInfo && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">{t('admin.documents.table.modal.cancelPayment')}</h3>
                <button
                  onClick={closeCancelModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-yellow-400 mr-2" />
                  <div>
                    <h4 className="text-sm font-medium text-yellow-800">Warning</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      This action will cancel the payment and may issue a refund. This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Payment Details</h4>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <strong>Amount:</strong> {formatCurrency(paymentInfo.amount, paymentInfo.currency)}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Status:</strong> {paymentInfo.status}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Payment Date:</strong> {formatDate(paymentInfo.payment_date)}
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cancellation Reason
                </label>
                <select
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-tfe-blue-500"
                >
                  <option value="">Select a reason</option>
                  {cancellationReasons.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
              </div>

              {cancellationReason === 'custom' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custom Reason
                  </label>
                  <textarea
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Please specify the reason for cancellation..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-tfe-blue-500"
                    rows={3}
                  />
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={closeCancelModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCancelPayment}
                  disabled={cancelling || !cancellationReason || (cancellationReason === 'custom' && !customReason.trim())}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors"
                >
                  {cancelling ? 'Cancelling...' : 'Cancel Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Preview do Documento */}
      {previewOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[10000]">
          <div className="absolute inset-0 bg-white flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-tfe-blue-600" />
                <span className="font-semibold text-gray-900">
                  {(document as any)?.filename || 'Document Preview'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
                  disabled={previewLoading || !previewUrl}
                  onClick={() => downloadPreview((document as any)?.filename)}
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
                  onClick={() => {
                    setPreviewOpen(false);
                    setPreviewUrl(null);
                    setPreviewError(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-50 overflow-auto">
              {previewLoading && (
                <div className="flex items-center justify-center h-full text-gray-600">
                  <div className="text-center">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p>Loading document...</p>
                  </div>
                </div>
              )}
              {!previewLoading && previewError && (
                <div className="p-6 text-center text-red-600">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                  <p>{previewError}</p>
                </div>
              )}
              {!previewLoading && !previewError && previewUrl && (
                <>
                  {previewType === 'image' ? (
                    <div className="flex items-center justify-center h-full p-4">
                      <img 
                        src={previewUrl} 
                        alt={(document as any)?.filename || 'Document'} 
                        className="max-w-full max-h-full object-contain"
                        style={{ maxHeight: 'calc(100vh - 80px)' }}
                      />
                    </div>
                  ) : (
                    <iframe src={previewUrl} className="w-full h-full border-0" title="Document Preview" />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Adicionado export default para consistência.
export default DocumentDetailsModal;