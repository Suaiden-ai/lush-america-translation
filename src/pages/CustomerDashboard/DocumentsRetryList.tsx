import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Upload, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { useDocumentsWithMissingFiles, DocumentWithMissingFile } from '../../hooks/useDocumentsWithMissingFiles';
import { RetryUploadModal } from '../../components/DocumentUploadRetry/RetryUploadModal';
import { useAuth } from '../../hooks/useAuth';

export default function DocumentsRetryList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { documents, loading, refetch, count } = useDocumentsWithMissingFiles(user?.id);
  const [selectedDocument, setSelectedDocument] = useState<DocumentWithMissingFile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<Set<string>>(new Set());

  const handleOpenModal = (document: DocumentWithMissingFile) => {
    setSelectedDocument(document);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedDocument(null);
  };

  const handleUploadSuccess = (documentId: string) => {
    // Marcar documento como enviado
    setUploadedDocuments(prev => new Set([...prev, documentId]));
    // Recarregar lista de documentos
    refetch();
    // Fechar modal após um delay
    setTimeout(() => {
      handleCloseModal();
    }, 1500);
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
          <p className="text-gray-600">Loading documents...</p>
        </div>
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <button
              onClick={() => navigate('/dashboard/documents')}
              className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Documents
            </button>
            
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                All documents have been sent!
              </h1>
              <p className="text-gray-600 mb-6">
                There are no documents pending resend.
              </p>
              <button
                onClick={() => navigate('/dashboard/documents')}
                className="bg-amber-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-amber-700 transition-colors"
              >
                Back to Documents
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <button
            onClick={() => navigate('/dashboard/documents')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Documents
          </button>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Resend Documents ({count})
          </h1>
          
          <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg mt-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-amber-600 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-amber-800 mb-1">
                  {count} {count === 1 ? 'document' : 'documents'} with confirmed payment but no file
                </h3>
                <p className="text-sm text-amber-700">
                  Your payments were processed successfully, but the files could not be uploaded automatically. 
                  Please resend each file below so we can process your translations.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Documentos */}
        <div className="space-y-4">
          {documents.map((doc, index) => {
            const isUploaded = uploadedDocuments.has(doc.document_id);
            
            return (
              <div
                key={doc.document_id}
                className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200 hover:border-amber-400 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 text-amber-600 font-bold mr-3">
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {doc.original_filename || doc.filename}
                        </h3>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                      <div>
                        <span className="text-gray-600">Amount paid:</span>
                        <span className="ml-2 font-semibold text-green-600">
                          {formatCurrency(doc.payment_gross_amount || doc.payment_amount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Payment date:</span>
                        <span className="ml-2 font-medium text-gray-900">
                          {formatDate(doc.payment_date)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Status:</span>
                        <span className="ml-2 font-medium text-gray-900 capitalize">
                          {doc.status}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Pages:</span>
                        <span className="ml-2 font-medium text-gray-900">
                          {doc.pages || 1}
                        </span>
                      </div>
                    </div>

                    {isUploaded && (
                      <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-center">
                          <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                          <p className="text-sm font-medium text-green-800">
                            File uploaded successfully! Awaiting processing.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="ml-6">
                    {!isUploaded ? (
                      <button
                        onClick={() => handleOpenModal(doc)}
                        className="flex items-center px-6 py-3 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 transition-colors shadow-md hover:shadow-lg"
                      >
                        <Upload className="h-5 w-5 mr-2" />
                        Resend File
                      </button>
                    ) : (
                      <div className="flex items-center px-6 py-3 bg-green-100 text-green-700 font-semibold rounded-lg">
                        <CheckCircle className="h-5 w-5 mr-2" />
                        Uploaded
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

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

