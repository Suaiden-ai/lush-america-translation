import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { RetryUploadModal } from '../../components/DocumentUploadRetry/RetryUploadModal';
import { useDocumentsWithMissingFiles, DocumentWithMissingFile } from '../../hooks/useDocumentsWithMissingFiles';

export default function DocumentRetryUpload() {
  const { documentId: paramDocumentId } = useParams<{ documentId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const documentId = paramDocumentId || searchParams.get('documentId');
  const from = searchParams.get('from');
  const [document, setDocument] = useState<DocumentWithMissingFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { documents, refetch } = useDocumentsWithMissingFiles();

  useEffect(() => {
    const fetchDocument = async () => {
      if (!documentId) {
        setError('ID do documento não fornecido');
        setLoading(false);
        return;
      }

      try {
        // Buscar documento específico
        const { data, error: fetchError } = await supabase
          .rpc('get_documents_with_missing_files', {
            user_id_param: null
          });

        if (fetchError) {
          throw fetchError;
        }

        const foundDocument = data?.find((doc: DocumentWithMissingFile) => doc.document_id === documentId);
        
        if (!foundDocument) {
          setError('Documento não encontrado ou já foi resolvido');
        } else {
          setDocument(foundDocument);
        }
      } catch (err: any) {
        console.error('Error fetching document:', err);
        setError(err.message || 'Erro ao buscar documento');
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [documentId]);

  const handleClose = () => {
    navigate('/dashboard/documents');
  };

  const handleSuccess = () => {
    refetch();
    // Redirecionar após sucesso
    setTimeout(() => {
      navigate('/dashboard/documents');
    }, 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando informações do documento...</p>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Erro</h1>
          <p className="text-gray-600 mb-6">{error || 'Documento não encontrado'}</p>
          <button
            onClick={() => navigate('/dashboard/documents')}
            className="bg-amber-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-amber-700 transition-colors"
          >
            Voltar para Documentos
          </button>
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
            Voltar para Documentos
          </button>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Reenviar Documento
          </h1>
          
          {from === 'payment' && (
            <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg mt-4">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-amber-600 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-amber-800 mb-1">
                    Payment confirmed, but file not found
                  </h3>
                  <p className="text-sm text-amber-700">
                    Your payment was processed successfully, but the file could not be uploaded automatically. 
                    Please resend the file below so we can process your translation.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal de reenvio */}
        <RetryUploadModal
          document={document}
          isOpen={true}
          onClose={handleClose}
          onSuccess={handleSuccess}
        />
      </div>
    </div>
  );
}

