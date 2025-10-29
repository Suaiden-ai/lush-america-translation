import React, { useState } from 'react';
import { FileText, Download, Eye, Clock, CheckCircle, AlertCircle, Loader2, Grid, List } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslatedDocuments } from '../../hooks/useDocuments';
import { DocumentDetailsModal } from './DocumentDetailsModal';
import ImagePreviewModal from '../../components/ImagePreviewModal';
import { db } from '../../lib/supabase';
import { getValidFileUrl } from '../../utils/fileUtils';
import { Logger } from '../../lib/loggingHelpers';
import { ActionTypes } from '../../types/actionTypes';

export default function DocumentProgress() {
  const { user } = useAuth();
  const { documents: translatedDocs, loading: loadingTranslated } = useTranslatedDocuments(user?.id);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Função para download automático (incluindo PDFs)
  const handleDownload = async (url: string, filename: string, documentId: string) => {
    try {
      // Obter uma URL válida
      const validUrl = await getValidFileUrl(url);
      
      // Log de download do documento
      try {
        await Logger.log(
          ActionTypes.DOCUMENT.DOWNLOADED,
          `Document downloaded: ${filename}`,
          {
            entityType: 'document',
            entityId: documentId,
            metadata: {
              document_id: documentId,
              filename: filename,
              file_url: validUrl,
              file_type: filename.split('.').pop()?.toLowerCase(),
              user_id: user?.id,
              timestamp: new Date().toISOString(),
              download_type: 'progress_page_download'
            },
            affectedUserId: user?.id,
            performerType: 'user'
          }
        );
        console.log('✅ Document download logged successfully');
      } catch (logError) {
        console.error('Error logging document download:', logError);
      }
      
      // Fazer o download
      const response = await fetch(validUrl);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      
      const link = window.document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      
      // Limpar o URL do blob
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Erro ao baixar arquivo:', error);
      // Fallback para download direto
      const link = window.document.createElement('a');
      link.href = url;
      link.download = filename;
      link.target = '_blank';
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'finished':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'processing':
      case 'in_progress':
        return <Loader2 className="w-5 h-5 text-tfe-blue-500 animate-spin" />;
      case 'pending':
      case 'waiting':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'error':
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-tfe-red-500" />;
      case 'refunded':
        return <AlertCircle className="w-5 h-5 text-orange-500" />;
      case 'cancelled':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (doc: any) => {
    // Para documentos da tabela documents_to_be_verified, usar o status real da coluna status
    if (doc.source === 'documents_to_be_verified') {
      switch (doc.status?.toLowerCase()) {
        case 'completed':
        case 'finished':
          return 'bg-green-100 text-green-800';
        case 'processing':
        case 'in_progress':
          return 'bg-tfe-blue-100 text-tfe-blue-800';
        case 'pending':
        case 'waiting':
          return 'bg-yellow-100 text-yellow-800';
        case 'error':
        case 'failed':
          return 'bg-tfe-red-100 text-tfe-red-800';
        case 'refunded':
          return 'bg-orange-100 text-orange-800';
        case 'cancelled':
          return 'bg-red-100 text-red-800';
        default:
          return 'bg-gray-100 text-gray-800';
      }
    }
    
    // Para documentos da tabela translated_documents, se tem translated_file_url, significa que foi traduzido
    if (doc.source === 'translated_documents' && doc.translated_file_url) {
      return 'bg-green-100 text-green-800';
    }
    
    // Para documentos da tabela documents (base) e outros casos
    switch (doc.status?.toLowerCase()) {
      case 'completed':
      case 'finished':
        return 'bg-green-100 text-green-800';
      case 'processing':
      case 'in_progress':
        return 'bg-tfe-blue-100 text-tfe-blue-800';
      case 'pending':
      case 'waiting':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
      case 'failed':
        return 'bg-tfe-red-100 text-tfe-red-800';
      case 'refunded':
        return 'bg-orange-100 text-orange-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (doc: any) => {
    // Para documentos da tabela documents_to_be_verified, usar o status real da coluna status
    if (doc.source === 'documents_to_be_verified') {
      switch (doc.status?.toLowerCase()) {
        case 'completed':
        case 'finished':
          return 'Completed';
        case 'processing':
        case 'in_progress':
          return 'Processing';
        case 'pending':
        case 'waiting':
          return 'Pending';
        case 'error':
        case 'failed':
          return 'Error';
        case 'refunded':
          return 'Refunded';
        case 'cancelled':
          return 'Cancelled';
        default:
          return 'Pending';
      }
    }
    
    // Para documentos da tabela translated_documents, se tem translated_file_url, significa que foi traduzido
    if (doc.source === 'translated_documents' && doc.translated_file_url) {
      return 'Completed';
    }
    
    // Para documentos da tabela documents (base) e outros casos
    switch (doc.status?.toLowerCase()) {
      case 'completed':
      case 'finished':
        return 'Completed';
      case 'processing':
      case 'in_progress':
        return 'Processing';
      case 'pending':
      case 'waiting':
        return 'Pending';
      case 'error':
      case 'failed':
        return 'Error';
      case 'refunded':
        return 'Refunded';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Pending';
    }
  };

  const DocumentCard = ({ doc }: { doc: any }) => (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-3 sm:mb-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-tfe-blue-500" />
            <div>
            <h3 className="font-semibold text-gray-900 truncate max-w-32 sm:max-w-48 text-sm sm:text-base" title={doc.original_filename || doc.filename}>
              {doc.original_filename || doc.filename}
            </h3>
              <p className="text-xs sm:text-sm text-gray-500">
                {doc.created_at ? new Date(doc.created_at).toLocaleDateString('en-US') : 'Date not available'}
              </p>
            </div>
          </div>
          {getStatusIcon(doc.status || 'pending')}
        </div>

      <div className="mb-3 sm:mb-4">
        <span className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(doc)}`}>
          {getStatusText(doc)}
        </span>
      </div>

      <div className="space-y-1 sm:space-y-2 mb-3 sm:mb-4 text-xs sm:text-sm text-gray-600">
        <div className="flex justify-between">
          <span>Language:</span>
          <span className="font-medium truncate ml-2">{doc.source_language || 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span>Pages:</span>
          <span className="font-medium">{doc.pages || 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span>Price:</span>
          <span className="font-medium">${doc.total_cost || 'N/A'}</span>
        </div>
      </div>

      {doc.source === 'translated_documents' && doc.translated_file_url && (
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            className="flex-1 inline-flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 bg-tfe-blue-600 text-white rounded-lg font-medium hover:bg-tfe-blue-700 transition-colors text-xs sm:text-sm"
            onClick={async (e) => {
              e.preventDefault();
              await handleDownload(doc.translated_file_url, doc.original_filename || doc.filename || 'translated_document', doc.id);
            }}
            title="Download file"
          >
            <Download className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Download</span>
          </button>
          <button
            onClick={async () => {
              try {
                // Log de visualização do documento
                  try {
                    await Logger.log(
                      ActionTypes.DOCUMENT.VIEWED,
                      `Document viewed: ${doc.original_filename || doc.filename}`,
                      {
                        entityType: 'document',
                        entityId: doc.id,
                        metadata: {
                          document_id: doc.id,
                          filename: doc.original_filename || doc.filename,
                          file_url: doc.translated_file_url,
                          file_type: (doc.original_filename || doc.filename)?.split('.').pop()?.toLowerCase(),
                          user_id: user?.id,
                          timestamp: new Date().toISOString(),
                          view_type: 'progress_page_view'
                        },
                        affectedUserId: user?.id,
                        performerType: 'user'
                      }
                    );
                  console.log('✅ Document view logged successfully');
                } catch (logError) {
                  console.error('Error logging document view:', logError);
                }

                if (doc.translated_file_url && (doc.translated_file_url.endsWith('.pdf') || doc.filename?.toLowerCase().endsWith('.pdf'))) {
                  const validUrl = await getValidFileUrl(doc.translated_file_url);
                  window.open(validUrl, '_blank', 'noopener,noreferrer');
                } else if (doc.translated_file_url && (doc.translated_file_url.match(/\.(jpg|jpeg|png)$/i) || doc.filename?.toLowerCase().match(/\.(jpg|jpeg|png)$/i))) {
                  const validUrl = await getValidFileUrl(doc.translated_file_url);
                  setImageModalUrl(validUrl);
                } else {
                  const validUrl = await getValidFileUrl(doc.translated_file_url);
                  window.open(validUrl, '_blank', 'noopener,noreferrer');
                }
              } catch (error) {
                console.error('Error opening file:', error);
                alert(error.message || 'Failed to open file.');
              }
            }}
            className="inline-flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-xs sm:text-sm"
            title="View file"
          >
            <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">View</span>
          </button>
        </div>
      )}

      {!(doc.source === 'translated_documents' && doc.translated_file_url) && 
       doc.status !== 'refunded' && 
       doc.status !== 'cancelled' && (
        <div className="text-center py-3 sm:py-4">
          <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400 mx-auto mb-1 sm:mb-2" />
          <p className="text-xs sm:text-sm text-gray-500">Document in processing</p>
        </div>
      )}
    </div>
  );

  const DocumentRow = ({ doc }: { doc: any }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        {/* File Info - Stacked on mobile */}
        <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
          <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-tfe-blue-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate text-sm sm:text-base" title={doc.original_filename || doc.filename}>
              {doc.original_filename || doc.filename}
            </h3>
            <p className="text-xs sm:text-sm text-gray-500">
              {doc.created_at ? new Date(doc.created_at).toLocaleDateString('en-US') : 'Date not available'}
            </p>
          </div>
        </div>
        
        {/* Status and Details - Responsive layout */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          {/* Status Badge */}
          <div className="flex justify-center sm:justify-start">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(doc)}`}>
              {getStatusText(doc)}
            </span>
          </div>
          
          {/* Document Details - Compact on mobile */}
          <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-right">
            <div className="grid grid-cols-3 gap-2 sm:block sm:space-y-1">
              <div className="truncate" title={doc.source_language || 'N/A'}>
                <span className="sm:hidden text-gray-400">Lang:</span> {doc.source_language || 'N/A'}
              </div>
              <div className="truncate">
                <span className="sm:hidden text-gray-400">Pages:</span> {doc.pages || 'N/A'}
              </div>
              <div className="truncate font-medium">
                <span className="sm:hidden text-gray-400">Price:</span> ${doc.total_cost || 'N/A'}
              </div>
            </div>
          </div>

          {/* Action Buttons - Stacked on mobile */}
          {doc.source === 'translated_documents' && doc.translated_file_url && (
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                className="inline-flex items-center justify-center gap-1 px-3 py-2 sm:py-1.5 bg-tfe-blue-600 text-white rounded-lg font-medium hover:bg-tfe-blue-700 transition-colors text-xs"
                onClick={async (e) => {
                  e.preventDefault();
                  await handleDownload(doc.translated_file_url, doc.original_filename || doc.filename || 'translated_document', doc.id);
                }}
                title="Download file"
              >
                <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Download</span>
              </button>
              <button
                onClick={async () => {
                  try {
                    // Log de visualização do documento
                    try {
                      await Logger.log(
                        ActionTypes.DOCUMENT.VIEWED,
                        `Document viewed: ${doc.original_filename || doc.filename}`,
                        {
                          entityType: 'document',
                          entityId: doc.id,
                        metadata: {
                          document_id: doc.id,
                          filename: doc.original_filename || doc.filename,
                          file_url: doc.translated_file_url,
                          file_type: (doc.original_filename || doc.filename)?.split('.').pop()?.toLowerCase(),
                          user_id: user?.id,
                          timestamp: new Date().toISOString(),
                          view_type: 'progress_page_list_view'
                        },
                          affectedUserId: user?.id,
                          performerType: 'user'
                        }
                      );
                      console.log('✅ Document view logged successfully');
                    } catch (logError) {
                      console.error('Error logging document view:', logError);
                    }

                    if (doc.translated_file_url && (doc.translated_file_url.endsWith('.pdf') || doc.filename?.toLowerCase().endsWith('.pdf'))) {
                      const validUrl = await getValidFileUrl(doc.translated_file_url);
                      window.open(validUrl, '_blank', 'noopener,noreferrer');
                    } else if (doc.translated_file_url && (doc.translated_file_url.match(/\.(jpg|jpeg|png)$/i) || doc.filename?.toLowerCase().match(/\.(jpg|jpeg|png)$/i))) {
                      const validUrl = await getValidFileUrl(doc.translated_file_url);
                      setImageModalUrl(validUrl);
                    } else {
                      const validUrl = await getValidFileUrl(doc.translated_file_url);
                      window.open(validUrl, '_blank', 'noopener,noreferrer');
                    }
                  } catch (error) {
                    console.error('Error opening file:', error);
                    alert((error as Error).message || 'Failed to open file.');
                  }
                }}
                className="inline-flex items-center justify-center gap-1 px-3 py-2 sm:py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-xs"
                title="View file"
              >
                <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">View</span>
              </button>
            </div>
          )}

          {!(doc.source === 'translated_documents' && doc.translated_file_url) && 
           doc.status !== 'refunded' && 
           doc.status !== 'cancelled' && (
            <div className="text-center">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mx-auto mb-1" />
              <p className="text-xs text-gray-500">Processing</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-10 px-3 sm:px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">My Translations</h1>
          <p className="text-sm sm:text-base text-gray-600">Track the status of your document translations</p>
        </div>

        {loadingTranslated ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 text-tfe-blue-500 animate-spin mr-2 sm:mr-3" />
            <span className="text-sm sm:text-base text-gray-600">Loading documents...</span>
          </div>
        ) : translatedDocs && translatedDocs.length > 0 ? (
          <>
            {/* View Mode Toggle */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 sm:gap-0 mb-4 sm:mb-6">
              <div className="flex items-center gap-2 bg-white rounded-lg p-1 shadow-sm border border-gray-200 w-fit">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'grid' 
                      ? 'bg-tfe-blue-100 text-tfe-blue-600' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title="Grid view"
                >
                  <Grid className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'list' 
                      ? 'bg-tfe-blue-100 text-tfe-blue-600' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title="List view"
                >
                  <List className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
              <div className="text-xs sm:text-sm text-gray-500">
                {translatedDocs.length} document{translatedDocs.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Documents Display */}
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {translatedDocs.map(doc => (
                  <DocumentCard key={doc.id} doc={doc} />
                ))}
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {translatedDocs.map(doc => (
                  <DocumentRow key={doc.id} doc={doc} />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-1 sm:mb-2">No documents found</h3>
            <p className="text-sm sm:text-base text-gray-500 mb-4 sm:mb-6">You don't have any translated documents yet. Make your first upload in the Translations page.</p>
            <button
              onClick={() => window.location.href = '/dashboard/upload'}
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-tfe-blue-600 text-white rounded-lg font-medium hover:bg-tfe-blue-700 transition-colors text-sm sm:text-base"
            >
              <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
              Go to Translations
            </button>
          </div>
        )}

        <DocumentDetailsModal document={selectedDoc} onClose={() => setSelectedDoc(null)} />
        {imageModalUrl && (
          <ImagePreviewModal imageUrl={imageModalUrl} onClose={() => setImageModalUrl(null)} />
        )}
      </div>
    </div>
  );
} 