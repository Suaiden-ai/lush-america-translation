import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { CheckCircle, XCircle, Clock, FileText, User, Calendar, FileImage, Phone, Eye } from 'lucide-react';

interface Document {
  id: string;
  filename: string;
  user_id: string;
  client_name?: string | null;
  tipo_trad?: string;
  valor?: number;
  idioma_raiz?: string;
  pages?: number | null;
  status?: string;
  translated_file_url?: string | null;
  file_url?: string | null;
  created_at?: string | null;
  rejection_reason?: string | null;
  rejection_comment?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
}

interface Props {
  user: { id: string; role: string; user_metadata?: { name?: string }; email?: string };
}

// Opções de motivo de rejeição
const REJECTION_REASONS = [
  { value: 'translation_error', label: 'Tradução incorreta ou imprecisa' },
  { value: 'illegible_document', label: 'Documento ilegível ou de baixa qualidade' },
  { value: 'missing_information', label: 'Informações faltando ou incompletas' },
  { value: 'inappropriate_format', label: 'Formato inadequado ou não aceito' },
  { value: 'quality_issues', label: 'Problemas de qualidade geral' },
  { value: 'duplicate_submission', label: 'Submissão duplicada' },
  { value: 'other', label: 'Outro motivo' }
];

export default function DocumentsToAuthenticate({ user }: Props) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingDoc, setProcessingDoc] = useState<string | null>(null);
  
  // Estados do modal de rejeição
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedDocForRejection, setSelectedDocForRejection] = useState<Document | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionComment, setRejectionComment] = useState('');
  const [rejectionOtherReason, setRejectionOtherReason] = useState('');
  const [rejectionLoading, setRejectionLoading] = useState(false);
  
  // Estados para informações do usuário
  const [userProfile, setUserProfile] = useState<{ name: string; email: string; phone: string | null } | null>(null);
  const [showUserInfo, setShowUserInfo] = useState(false);
  const [loadingUserInfo, setLoadingUserInfo] = useState(false);

  useEffect(() => {
    async function fetchPendingDocuments() {
      try {
        setLoading(true);
        console.log('[DocumentsToAuthenticate] Buscando documentos pendentes...');
        
        // 1. Buscar documentos pendentes
        const { data, error } = await supabase
          .from('documents_to_be_verified')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: true });
        
        if (error) {
          console.error('[DocumentsToAuthenticate] Erro ao buscar documentos:', error);
          setError('Erro ao carregar documentos');
          return;
        }
        
        console.log('[DocumentsToAuthenticate] Documentos encontrados:', data?.length || 0);
        
        // 2. Buscar status de pagamentos para filtrar documentos refunded/cancelled
        // Primeiro, buscar todos os pagamentos para encontrar correspondências
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('payments')
          .select('document_id, status, user_id, amount');
        
        if (paymentsError) {
          console.warn('[DocumentsToAuthenticate] Erro ao buscar pagamentos:', paymentsError);
        }
        
        console.log('[DocumentsToAuthenticate] Pagamentos encontrados:', paymentsData?.length || 0);
        
        // 3. Criar mapa de status de pagamentos
        // Mapear por document_id primeiro, depois por user_id + amount se necessário
        const paymentStatusMap = new Map<string, string>();
        paymentsData?.forEach(payment => {
          if (payment.document_id) {
            paymentStatusMap.set(payment.document_id, payment.status);
          }
        });
        
        // 4. Para documentos sem document_id direto, tentar mapear por user_id + amount
        const documentsWithoutDirectPayment = (data || []).filter(doc => {
          const directPayment = paymentStatusMap.get(doc.id);
          return !directPayment;
        });
        
        console.log('[DocumentsToAuthenticate] Documentos sem pagamento direto:', documentsWithoutDirectPayment.length);
        
        // Mapear por user_id + amount para documentos sem document_id direto
        documentsWithoutDirectPayment.forEach(doc => {
          const matchingPayment = paymentsData?.find(payment => 
            payment.user_id === doc.user_id && 
            payment.amount === doc.valor
          );
          
          if (matchingPayment) {
            paymentStatusMap.set(doc.id, matchingPayment.status);
            console.log('[DocumentsToAuthenticate] Mapeamento por user_id + amount:', {
              doc_id: doc.id,
              user_id: doc.user_id,
              amount: doc.valor,
              payment_status: matchingPayment.status
            });
          }
        });
        
        // 5. Filtrar documentos que NÃO têm status refunded ou cancelled
        const validDocuments = (data || []).filter(doc => {
          const paymentStatus = paymentStatusMap.get(doc.id);
          const shouldExclude = paymentStatus === 'refunded' || paymentStatus === 'cancelled';
          
          if (shouldExclude) {
            console.log('[DocumentsToAuthenticate] Excluindo documento:', {
              id: doc.id,
              filename: doc.filename,
              payment_status: paymentStatus
            });
          }
          
          return !shouldExclude;
        });
        
        console.log('[DocumentsToAuthenticate] Documentos válidos (após filtro de pagamento):', validDocuments.length);
        console.log('[DocumentsToAuthenticate] Documentos filtrados (refunded/cancelled):', (data || []).length - validDocuments.length);
        
        setDocuments(validDocuments);
        setError(null);
      } catch (err) {
        console.error('[DocumentsToAuthenticate] Erro inesperado:', err);
        setError('Erro inesperado ao carregar documentos');
      } finally {
        setLoading(false);
      }
    }
    
    fetchPendingDocuments();
  }, []);

  const handleApprove = async (docId: string) => {
    setProcessingDoc(docId);
    try {
      console.log('[DocumentsToAuthenticate] Aprovando documento:', docId);
      
      // Primeiro, buscar o documento para obter todos os dados necessários
      const { data: doc, error: fetchError } = await supabase
        .from('documents_to_be_verified')
        .select('*')
        .eq('id', docId)
        .single();
      
      if (fetchError || !doc) {
        console.error('[DocumentsToAuthenticate] Erro ao buscar documento:', fetchError);
        alert('Erro ao buscar documento. Tente novamente.');
        return;
      }

      // Atualizar status para 'completed' (seguindo o padrão do AuthenticatorDashboard)
      const { error: updateError } = await supabase
        .from('documents_to_be_verified')
        .update({ 
          status: 'completed',
          authenticated_by: user?.id,
          authenticated_by_name: user?.user_metadata?.name || user?.email,
          authenticated_by_email: user?.email,
          authentication_date: new Date().toISOString()
        })
        .eq('id', docId);
      
      if (updateError) {
        console.error('[DocumentsToAuthenticate] Erro ao aprovar:', updateError);
        alert('Erro ao aprovar documento. Tente novamente.');
        return;
      }

      // ✅ CORREÇÃO: Atualizar também a tabela documents original se existir
      if (doc.original_document_id) {
        const { error: updateOriginalError } = await supabase
          .from('documents')
          .update({ 
            status: 'completed',
            authenticated_by: user?.id,
            authenticated_by_name: user?.user_metadata?.name || user?.email,
            authenticated_by_email: user?.email,
            authentication_date: new Date().toISOString()
          })
          .eq('id', doc.original_document_id);
        
        if (updateOriginalError) {
          console.error('[DocumentsToAuthenticate] Erro ao atualizar documento original:', updateOriginalError);
          // Não interrompemos o processo, apenas logamos o erro
        }
      }

      // Inserir em translated_documents com dados do autenticador
      const authData = {
        authenticated_by: user?.id,
        authenticated_by_name: user?.user_metadata?.name || user?.email,
        authenticated_by_email: user?.email,
        authentication_date: new Date().toISOString()
      };

      const { error: insertError } = await supabase.from('translated_documents').insert({
        original_document_id: doc.id,
        user_id: doc.user_id,
        filename: doc.filename,
        translated_file_url: doc.translated_file_url || doc.file_url || '',
        source_language: doc.source_language || 'portuguese',
        target_language: doc.target_language || 'english',
        pages: doc.pages,
        status: 'completed',
        total_cost: doc.total_cost,
        is_authenticated: true,
        verification_code: doc.verification_code,
        ...authData
      } as any);
      
      if (insertError) {
        console.error('[DocumentsToAuthenticate] Erro ao inserir em translated_documents:', insertError);
        // Não interrompemos o processo, mas logamos o erro
      }

      // Atualizar o documento original na tabela documents para completed
      // Isso garante que ele não apareça mais no dashboard do usuário como processing
      // Primeiro, vamos buscar o documento original na tabela documents usando o verification_code
      const { data: originalDoc, error: findOriginalError } = await supabase
        .from('documents')
        .select('id')
        .eq('verification_code', doc.verification_code)
        .single();
      
      if (findOriginalError) {
        console.error('[DocumentsToAuthenticate] Erro ao buscar documento original:', findOriginalError);
      } else if (originalDoc) {
        const { error: updateOriginalError } = await supabase
          .from('documents')
          .update({ status: 'completed' })
          .eq('id', originalDoc.id);
        
        if (updateOriginalError) {
          console.error('[DocumentsToAuthenticate] Erro ao atualizar documento original:', updateOriginalError);
        } else {
          console.log('[DocumentsToAuthenticate] Documento original atualizado para completed');
        }
      }

      setDocuments(prev => prev.filter(doc => doc.id !== docId));
      console.log('[DocumentsToAuthenticate] Documento aprovado com sucesso');
      
    } catch (err) {
      console.error('[DocumentsToAuthenticate] Erro inesperado ao aprovar:', err);
      alert('Erro inesperado ao aprovar documento.');
    } finally {
      setProcessingDoc(null);
    }
  };

  const handleRejectClick = (doc: Document) => {
    setSelectedDocForRejection(doc);
    setShowRejectModal(true);
    // Reset form
    setRejectionReason('');
    setRejectionComment('');
    setRejectionOtherReason('');
  };

  const handleRejectConfirm = async () => {
    if (!selectedDocForRejection) return;
    
    // Validação
    if (!rejectionReason) {
      alert('Por favor, selecione um motivo para a rejeição.');
      return;
    }
    
    if (!rejectionComment.trim()) {
      alert('Por favor, adicione um comentário detalhado sobre a rejeição.');
      return;
    }
    
    if (rejectionReason === 'other' && !rejectionOtherReason.trim()) {
      alert('Por favor, especifique o motivo da rejeição.');
      return;
    }

    setRejectionLoading(true);
    try {
      console.log('[DocumentsToAuthenticate] Rejeitando documento:', selectedDocForRejection.id);
      
      const finalReason = rejectionReason === 'other' ? rejectionOtherReason : rejectionReason;
      const finalComment = rejectionComment.trim();
      
      // Atualizar status para rejected com motivo e comentário
      const { error } = await supabase
        .from('documents_to_be_verified')
        .update({ 
          status: 'rejected',
          rejection_reason: finalReason,
          rejection_comment: finalComment,
          rejected_by: user.id,
          rejected_at: new Date().toISOString()
        })
        .eq('id', selectedDocForRejection.id);
      
      if (error) {
        console.error('[DocumentsToAuthenticate] Erro ao rejeitar:', error);
        alert('Erro ao rejeitar documento. Tente novamente.');
        return;
      }

      // Remover documento da lista
      setDocuments(prev => prev.filter(doc => doc.id !== selectedDocForRejection.id));
      console.log('[DocumentsToAuthenticate] Documento rejeitado com sucesso');
      
      // Fechar modal
      setShowRejectModal(false);
      setSelectedDocForRejection(null);
      
    } catch (err) {
      console.error('[DocumentsToAuthenticate] Erro inesperado ao rejeitar:', err);
      alert('Erro inesperado ao rejeitar documento.');
    } finally {
      setRejectionLoading(false);
    }
  };

  const handleRejectCancel = () => {
    setShowRejectModal(false);
    setSelectedDocForRejection(null);
    setRejectionReason('');
    setRejectionComment('');
    setRejectionOtherReason('');
    setUserProfile(null);
    setShowUserInfo(false);
  };

  const fetchUserProfile = async (userId: string) => {
    setLoadingUserInfo(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, email, phone')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching user profile:', error);
      } else {
        setUserProfile(data);
        setShowUserInfo(true);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    } finally {
      setLoadingUserInfo(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-4 sm:py-10 px-3 sm:px-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-3 mb-6 sm:mb-8 p-4 sm:p-6 bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100">
          <Clock className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-600" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Documents to Authenticate</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">All documents pending your review, ordered by arrival.</p>
          </div>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
          {loading && <p className="text-tfe-blue-700 text-base sm:text-lg">Loading documents...</p>}
          {error && <p className="text-tfe-red-500 text-base sm:text-lg">Error: {error}</p>}
          {!loading && documents.length === 0 && (
            <p className="text-gray-500 text-base sm:text-lg text-center py-8">No pending documents for authentication.</p>
          )}
          
          {/* Mobile Cards View */}
          <div className="block sm:hidden space-y-4">
            {documents.map(doc => (
              <div key={doc.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="space-y-3">
                  {/* Document Name */}
                  <div>
                    <a href={doc.file_url || '#'} target="_blank" rel="noopener noreferrer" className="text-tfe-blue-700 underline font-medium text-sm">{doc.filename}</a>
                  </div>

                  {/* Document Details */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="font-medium text-gray-600">Type:</span>
                      <span className="ml-1">{doc.tipo_trad || '-'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Value:</span>
                      <span className="ml-1">{doc.valor ? `$${doc.valor}` : '-'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Language:</span>
                      <span className="ml-1">{doc.idioma_raiz || '-'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Pages:</span>
                      <span className="ml-1">{doc.pages || '-'}</span>
                    </div>
                  </div>

                  {/* Client/User and Date */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                    <div className="flex items-center gap-2">
                      {doc.client_name ? (
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-gray-900">{doc.client_name}</span>
                          <span className="text-xs font-mono text-gray-600 truncate max-w-20" title={doc.user_id}>
                            {doc.user_id.slice(0, 8)}...
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs font-mono text-gray-600 truncate max-w-20" title={doc.user_id}>
                          {doc.user_id.slice(0, 8)}...
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : '-'}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2 border-t border-gray-200">
                    <button
                      onClick={() => handleApprove(doc.id)}
                      disabled={processingDoc === doc.id}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg font-medium text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {processingDoc === doc.id ? 'Processing...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleRejectClick(doc)}
                      disabled={processingDoc === doc.id}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-tfe-red-600 text-white rounded-lg font-medium text-sm hover:bg-tfe-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full bg-white border rounded-lg shadow">
              <thead className="bg-tfe-blue-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-900">Original File</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-900">Client / User</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-900">Type</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-900">Value</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-900">Language</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-900">Pages</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-900">Submitted At</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => (
                  <tr key={doc.id} className="border-t hover:bg-tfe-blue-50 transition-colors">
                    <td className="px-4 py-2">
                      <a href={doc.file_url || '#'} target="_blank" rel="noopener noreferrer" className="text-tfe-blue-700 underline font-medium text-sm">{doc.filename}</a>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {doc.client_name ? (
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">{doc.client_name}</span>
                          <span className="text-xs text-gray-500 font-mono truncate max-w-24" title={doc.user_id}>
                            {doc.user_id.slice(0, 8)}...
                          </span>
                        </div>
                      ) : (
                        <span className="font-mono text-gray-600 truncate max-w-24" title={doc.user_id}>
                          {doc.user_id.slice(0, 8)}...
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm">{doc.tipo_trad || '-'}</td>
                    <td className="px-4 py-2 text-sm">{doc.valor ? `$${doc.valor}` : '-'}</td>
                    <td className="px-4 py-2 text-sm">{doc.idioma_raiz || '-'}</td>
                    <td className="px-4 py-2 text-sm">{doc.pages || '-'}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(doc.id)}
                          disabled={processingDoc === doc.id}
                          className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <CheckCircle className="w-3 h-3" />
                          {processingDoc === doc.id ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleRejectClick(doc)}
                          disabled={processingDoc === doc.id}
                          className="flex items-center gap-1 px-3 py-1 bg-tfe-red-600 text-white rounded text-sm hover:bg-tfe-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <XCircle className="w-3 h-3" />
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

             {/* Modal de Rejeição */}
       {showRejectModal && selectedDocForRejection && (
         <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50 p-4">
           <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
             {/* Header */}
             <div className="flex items-center justify-between p-6 border-b border-gray-200">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-tfe-red-100 rounded-lg flex items-center justify-center">
                   <XCircle className="w-6 h-6 text-tfe-red-600" />
                 </div>
                 <div>
                   <h3 className="text-xl font-bold text-gray-900">Rejeitar Documento</h3>
                   <p className="text-sm text-gray-600">Forneça detalhes sobre a rejeição</p>
                 </div>
               </div>
               <button
                 type="button"
                 onClick={handleRejectCancel}
                 className="text-gray-400 hover:text-gray-600 transition-colors"
                 title="Fechar modal"
               >
                 <XCircle className="w-6 h-6" />
               </button>
             </div>

             {/* Document Info */}
             <div className="p-6 bg-gray-50 border-b border-gray-200">
               <div className="flex items-center justify-between mb-3">
                 <div className="flex items-center gap-3">
                   <FileText className="w-5 h-5 text-tfe-blue-600" />
                   <span className="font-medium text-gray-900">{selectedDocForRejection.filename}</span>
                 </div>
                 <button
                   onClick={() => fetchUserProfile(selectedDocForRejection.user_id)}
                   disabled={loadingUserInfo}
                   className="flex items-center gap-2 px-3 py-1.5 bg-tfe-blue-100 text-tfe-blue-700 rounded-lg hover:bg-tfe-blue-200 transition-colors text-sm font-medium"
                 >
                   <Eye className="w-4 h-4" />
                   {loadingUserInfo ? 'Loading...' : 'View User Info'}
                 </button>
               </div>
               
               {/* User Information Display */}
               {showUserInfo && userProfile && (
                 <div className="mb-4 p-4 bg-white rounded-lg border border-tfe-blue-200">
                   <div className="flex items-center gap-2 mb-3">
                     <User className="w-4 h-4 text-tfe-blue-600" />
                     <span className="font-medium text-gray-900">Client Information</span>
                   </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                     <div>
                       <label className="text-xs font-medium text-gray-600">Name</label>
                       <p className="text-gray-900">{userProfile.name || 'Not provided'}</p>
                     </div>
                     <div>
                       <label className="text-xs font-medium text-gray-600">Email</label>
                       <p className="text-gray-900 break-all">{userProfile.email}</p>
                     </div>
                     <div>
                       <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                         <Phone className="w-3 h-3" />
                         Phone Number
                       </label>
                       <p className="text-gray-900">{userProfile.phone || 'Not provided'}</p>
                     </div>
                     <div>
                       <label className="text-xs font-medium text-gray-600">User ID</label>
                       <p className="text-gray-900 font-mono text-xs break-all">{selectedDocForRejection.user_id}</p>
                     </div>
                   </div>
                 </div>
               )}
               
               <div className="grid grid-cols-2 gap-4 text-sm">
                 <div className="flex items-center gap-2">
                   <User className="w-4 h-4 text-gray-500" />
                   <span className="text-gray-600">ID: {selectedDocForRejection.user_id.slice(0, 8)}...</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <Calendar className="w-4 h-4 text-gray-500" />
                   <span className="text-gray-600">
                     {selectedDocForRejection.created_at ? new Date(selectedDocForRejection.created_at).toLocaleDateString() : '-'}
                   </span>
                 </div>
                 {selectedDocForRejection.tipo_trad && (
                   <div className="flex items-center gap-2">
                     <FileImage className="w-4 h-4 text-gray-500" />
                     <span className="text-gray-600">{selectedDocForRejection.tipo_trad}</span>
                   </div>
                 )}
                 {selectedDocForRejection.pages && (
                   <div className="flex items-center gap-2">
                     <FileText className="w-4 h-4 text-gray-500" />
                     <span className="text-gray-600">{selectedDocForRejection.pages} páginas</span>
                   </div>
                 )}
               </div>
             </div>

             {/* Form */}
             <div className="p-6 space-y-6">
               {/* Motivo da Rejeição */}
               <div>
                 <label htmlFor="rejectionReason" className="block mb-3 text-sm font-semibold text-gray-900">
                   Motivo da Rejeição <span className="text-tfe-red-500">*</span>
                 </label>
                 <select
                   id="rejectionReason"
                   value={rejectionReason}
                   onChange={(e) => setRejectionReason(e.target.value)}
                   className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-tfe-red-500 transition-colors"
                 >
                   <option value="">Selecione um motivo</option>
                   {REJECTION_REASONS.map(option => (
                     <option key={option.value} value={option.value}>{option.label}</option>
                   ))}
                 </select>
               </div>

               {/* Outro Motivo */}
               {rejectionReason === 'other' && (
                 <div>
                   <label htmlFor="rejectionOtherReason" className="block mb-3 text-sm font-semibold text-gray-900">
                     Especifique o Motivo <span className="text-tfe-red-500">*</span>
                   </label>
                   <input
                     type="text"
                     id="rejectionOtherReason"
                     value={rejectionOtherReason}
                     onChange={(e) => setRejectionOtherReason(e.target.value)}
                     className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-tfe-red-500 transition-colors"
                     placeholder="Descreva o motivo específico da rejeição..."
                   />
                 </div>
               )}

               {/* Comentário Detalhado */}
               <div>
                 <label htmlFor="rejectionComment" className="block mb-3 text-sm font-semibold text-gray-900">
                   Comentário Detalhado <span className="text-tfe-red-500">*</span>
                 </label>
                 <textarea
                   id="rejectionComment"
                   value={rejectionComment}
                   onChange={(e) => setRejectionComment(e.target.value)}
                   rows={4}
                   className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-tfe-red-500 transition-colors resize-none"
                   placeholder="Forneça detalhes específicos sobre os problemas encontrados e sugestões para correção..."
                 />
                 <p className="mt-2 text-xs text-gray-500">
                   Este comentário será visível para o usuário que enviou o documento.
                 </p>
               </div>
             </div>

             {/* Actions */}
             <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
               <button
                 onClick={handleRejectCancel}
                 className="px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
               >
                 Cancelar
               </button>
               <button
                 onClick={handleRejectConfirm}
                 disabled={rejectionLoading || !rejectionReason || !rejectionComment.trim() || (rejectionReason === 'other' && !rejectionOtherReason.trim())}
                 className="px-6 py-3 bg-tfe-red-600 text-white rounded-lg hover:bg-tfe-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
               >
                 {rejectionLoading ? (
                   <>
                     <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                     Rejeitando...
                   </>
                 ) : (
                   <>
                     <XCircle className="w-4 h-4" />
                     Confirmar Rejeição
                   </>
                 )}
               </button>
             </div>
           </div>
         </div>
       )}
    </div>
  );
} 