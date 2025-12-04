import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { FileText, AlertCircle, Upload as UploadIcon, CheckCircle, Loader, User } from 'lucide-react';
import { retryDocumentUpload } from '../../utils/retryUpload';
import { DocumentWithMissingFile } from '../../hooks/useDocumentsWithMissingFiles';
import { Logger } from '../../lib/loggingHelpers';
import { ActionTypes } from '../../types/actionTypes';
import { RetryUploadModal } from '../../components/DocumentUploadRetry/RetryUploadModal';

export default function AuthenticatorFailedUploads() {
  const { user: currentUser } = useAuth();
  const [failedDocuments, setFailedDocuments] = useState<DocumentWithMissingFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentWithMissingFile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Buscar documentos com falha de upload
  useEffect(() => {
    async function fetchFailedDocuments() {
      setLoading(true);
      setError(null);
      try {
        // Buscar todos os documentos com falha (sem filtro de user_id)
        const { data, error: fetchError } = await supabase
          .rpc('get_documents_with_missing_files', {
            user_id_param: null // null = buscar todos
          });

        if (fetchError) {
          console.error('[AuthenticatorFailedUploads] Error fetching failed documents:', fetchError);
          setError(fetchError.message);
          return;
        }

        console.log('[AuthenticatorFailedUploads] Failed documents found:', data?.length || 0);
        
        // Filter hidden documents (backup of SQL filter)
        const filteredData = (data || []).filter(doc => {
          // Hide specific document: RI-DIGITAL-MAT48812.pdf from client jrbmw118@icloud.com
          if (doc.user_email === 'jrbmw118@icloud.com' && 
              (doc.filename?.includes('RI-DIGITAL-MAT48812') || doc.original_filename?.includes('RI-DIGITAL-MAT48812'))) {
            return false;
          }
          return true;
        });
        
        setFailedDocuments(filteredData);
      } catch (err: any) {
        console.error('[AuthenticatorFailedUploads] Exception fetching failed documents:', err);
        setError(err.message || 'Error fetching failed documents');
      } finally {
        setLoading(false);
      }
    }
    fetchFailedDocuments();

    // Configurar subscription para atualizações em tempo real
    const channel = supabase
      .channel('authenticator_failed_uploads_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents'
        },
        () => {
          fetchFailedDocuments();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments'
        },
        () => {
          fetchFailedDocuments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Função para abrir o modal de upload
  const handleOpenModal = (doc: DocumentWithMissingFile) => {
    setSelectedDocument(doc);
    setIsModalOpen(true);
  };

  // Função para fechar o modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedDocument(null);
  };

  // Função chamada quando o upload é bem-sucedido
  const handleUploadSuccess = async (documentId: string) => {
    // Log de ação
    if (selectedDocument) {
      await Logger.log(
        ActionTypes.DOCUMENT.MANUAL_UPLOAD_BY_AUTHENTICATOR,
        `Authenticator re-uploaded failed document: ${selectedDocument.filename}`,
        {
          entityType: 'document',
          entityId: documentId,
          metadata: {
            filename: selectedDocument.filename,
            user_id: selectedDocument.user_id,
            user_name: selectedDocument.user_name,
            user_email: selectedDocument.user_email,
            authenticator_id: currentUser?.id,
            authenticator_name: currentUser?.user_metadata?.name || currentUser?.email,
            reason: 'Re-upload after payment confirmed but file upload failed',
            timestamp: new Date().toISOString()
          },
          affectedUserId: selectedDocument.user_id,
          performerType: 'authenticator'
        }
      );
    }

    // Remover da lista após sucesso
    setFailedDocuments(prev => prev.filter(d => d.document_id !== documentId));
    handleCloseModal();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading documents with upload failures...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Documents with Upload Failure ({failedDocuments.length})
              </h1>
              <p className="text-gray-600 mt-1">
                Documents with confirmed payment but no file in Storage
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-amber-600 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-amber-800 mb-1">
                  {failedDocuments.length} {failedDocuments.length === 1 ? 'document' : 'documents'} with confirmed payment but no file
                </h3>
                <p className="text-sm text-amber-700">
                  These documents were paid but the file upload failed. Please manually upload the corresponding PDF file.
                  The file must have exactly the same number of pages that was paid for.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Documents List */}
        {failedDocuments.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">All Good!</h2>
            <p className="text-gray-600">No documents with upload failures found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {failedDocuments.map((doc) => {
              return (
                <div
                  key={doc.document_id}
                  className="bg-white rounded-lg shadow-md p-6 border border-gray-200"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <FileText className="w-6 h-6 text-gray-500" />
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">
                            {doc.original_filename || doc.filename}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {doc.user_name || doc.user_email}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600 font-medium">Client email:</span>
                          <span className="ml-2 text-gray-900">{doc.user_email}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 font-medium">Amount paid:</span>
                          <span className="ml-2 font-semibold text-green-600">
                            {formatCurrency((doc.payment_gross_amount ?? doc.payment_amount) || 0)}
                          </span>
                          {doc.payment_fee_amount && doc.payment_fee_amount > 0 && (
                            <span className="ml-2 text-xs text-gray-500">
                              (includes fee of ${doc.payment_fee_amount.toFixed(2)})
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-gray-600 font-medium">Expected pages:</span>
                          <span className="ml-2 font-medium text-amber-600">
                            {doc.pages || 1} {doc.pages === 1 ? 'page' : 'pages'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 font-medium">Payment date:</span>
                          <span className="ml-2 text-gray-900">{formatDate(doc.payment_date)}</span>
                        </div>
                        {doc.upload_failed_at && (
                          <div>
                            <span className="text-gray-600 font-medium">Failed on:</span>
                            <span className="ml-2 text-gray-900">{formatDate(doc.upload_failed_at)}</span>
                          </div>
                        )}
                      </div>

                      {doc.pages && doc.pages > 0 && (
                        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="text-xs text-amber-800">
                            <strong>Important:</strong> The PDF file must have exactly <strong>{doc.pages} {doc.pages === 1 ? 'page' : 'pages'}</strong>,
                            as the client paid for {doc.pages} {doc.pages === 1 ? 'page' : 'pages'}.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 lg:min-w-[250px]">
                      <button
                        onClick={() => handleOpenModal(doc)}
                        className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium text-sm transition-colors bg-amber-600 text-white hover:bg-amber-700"
                      >
                        <UploadIcon className="w-4 h-4" />
                        Upload PDF File
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal de Upload */}
        {selectedDocument && (
          <RetryUploadModal
            document={selectedDocument}
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            onSuccess={() => handleUploadSuccess(selectedDocument.document_id)}
          />
        )}
      </div>
    </div>
  );
}

