import React, { useState, useEffect, useMemo } from 'react';
import { Clock, FileText, Download, AlertCircle } from 'lucide-react';
import { Document } from '../../App';
import { db } from '../../lib/supabase'; // Supondo que 'db' seja um wrapper com helpers
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../contexts/I18nContext';
import { Logger } from '../../lib/loggingHelpers';
import { ActionTypes } from '../../types/actionTypes';
import { useAuth } from '../../hooks/useAuth';

interface RecentActivityProps {
  documents: Document[];
  onViewDocument: (document: Document) => void;
}

interface DocumentStatus {
  [documentId: string]: string;
}

export function RecentActivity({ documents, onViewDocument }: RecentActivityProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [documentStatuses, setDocumentStatuses] = useState<DocumentStatus>({});
  const [loading, setLoading] = useState(true);
  
  // Modal de visualização de documento (preview)
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'pdf' | 'image' | 'unknown'>('unknown');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);

  // 1. Otimizar o cálculo dos documentos recentes com useMemo
  // Isso garante que a ordenação e o corte só aconteçam quando a lista 'documents' mudar.
  const recentDocuments = useMemo(() => {
    return documents
      .sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [documents]);

  // 2. Usar os status que já vêm do useTranslatedDocuments
  // Este efeito será executado sempre que 'recentDocuments' mudar.
  useEffect(() => {
    if (recentDocuments.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Usar os status que já vêm do useTranslatedDocuments
    const statusMap: DocumentStatus = {};
    recentDocuments.forEach(doc => {
      statusMap[doc.id] = doc.status || 'unknown';
    });

    setDocumentStatuses(statusMap);
    setLoading(false);
  }, [recentDocuments]); // A dependência agora é estável graças ao useMemo

  // Função para download automático (lógica mantida, pois estava correta)
  const handleDownload = async (url: string, filename: string, documentId?: string) => {
    try {
      // Log de download do documento
      if (documentId) {
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
                file_url: url,
                file_type: filename?.split('.').pop()?.toLowerCase(),
                user_id: user?.id,
                timestamp: new Date().toISOString(),
                download_type: 'recent_activity_download'
              },
              affectedUserId: user?.id,
              performerType: 'user'
            }
          );
        } catch (logError) {
          console.error('Error logging document download:', logError);
        }
      }

      // Extrair filePath e bucket da URL
      const { extractFilePathFromUrl } = await import('../../utils/fileUtils');
      const pathInfo = extractFilePathFromUrl(url);
      
      if (!pathInfo) {
        // Se não conseguir extrair, tentar download direto da URL (para S3 externo)
        try {
          const response = await fetch(url);
          if (response.ok) {
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
            return;
          }
        } catch (error) {
          throw new Error('Não foi possível acessar o arquivo. Verifique sua conexão.');
        }
      }
      
      // Usar download autenticado direto
      const success = await db.downloadFileAndTrigger(pathInfo.filePath, filename, pathInfo.bucket);
      
      if (!success) {
        throw new Error('Não foi possível baixar o arquivo. Verifique se você está autenticado.');
      }
    } catch (error) {
      console.error('Erro no download:', error);
      alert(`Erro ao baixar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  // Função para detectar tipo de preview
  function detectPreviewType(url: string, filename?: string | null): 'pdf' | 'image' | 'unknown' {
    const cleanUrl = url.split('?')[0].toLowerCase();
    const name = (filename || cleanUrl).toLowerCase();
    
    if (filename) {
      const ext = filename.toLowerCase().split('.').pop();
      if (ext === 'pdf') return 'pdf';
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext || '')) return 'image';
    }
    
    if (name.endsWith('.pdf')) return 'pdf';
    if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.gif') || name.endsWith('.webp') || name.endsWith('.bmp')) return 'image';
    
    return 'unknown';
  }

  // Função para visualizar documento (abre modal de preview)
  const handleViewDocument = async (doc: Document) => {
    const currentStatus = documentStatuses[doc.id] || doc.status;
    

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
            file_url: doc.translated_file_url || doc.file_url,
            file_type: (doc.original_filename || doc.filename)?.split('.').pop()?.toLowerCase(),
            user_id: user?.id,
            timestamp: new Date().toISOString(),
            view_type: 'recent_activity_preview',
            document_status: currentStatus
          },
          affectedUserId: user?.id,
          performerType: 'user'
        }
      );
    } catch (logError) {
      console.error('Error logging document view:', logError);
    }
    
    try {
      setPreviewLoading(true);
      setPreviewError(null);
      setPreviewDocument(doc);
      
      // Determinar URL para visualizar
      let urlToView = doc.translated_file_url || doc.file_url;
      
      // Se o documento está completed mas não tem translated_file_url, buscar na translated_documents
      if (!urlToView && currentStatus === 'completed') {
        try {
          const { data: translatedDocs } = await supabase
            .from('translated_documents')
            .select('translated_file_url, filename')
            .eq('user_id', doc.user_id)
            .eq('filename', doc.filename);
          
          if (translatedDocs && translatedDocs.length > 0 && translatedDocs[0].translated_file_url) {
            urlToView = translatedDocs[0].translated_file_url;
          }
        } catch (error) {
          console.error('Erro ao buscar documento traduzido:', error);
        }
      }
      
      if (!urlToView) {
        setPreviewError('No document available to view.');
        setPreviewOpen(true);
        return;
      }
      
      // IMPORTANTE: Usar blob URL para evitar expor URL original no DOM
      // 1. Extrair filePath da URL original
      const { extractFilePathFromUrl } = await import('../../utils/fileUtils');
      const pathInfo = extractFilePathFromUrl(urlToView);
      
      if (!pathInfo) {
        throw new Error('Não foi possível extrair informações do arquivo da URL.');
      }
      
      // 2. Fazer download autenticado do arquivo
      const { db } = await import('../../lib/supabase');
      const blob = await db.downloadFile(pathInfo.filePath, pathInfo.bucket);
      
      if (!blob) {
        throw new Error('Não foi possível baixar o arquivo. Verifique se você está autenticado.');
      }
      
      // 3. Criar blob URL (URL local, não expõe URL original)
      const blobUrl = window.URL.createObjectURL(blob);
      
      // 4. Detectar tipo do arquivo
      const urlFileName = urlToView.split('/').pop()?.split('?')[0] || doc.filename;
      const detectedType = detectPreviewType(blobUrl, urlFileName);
      
      // 5. Armazenar blob URL (será revogado quando modal fechar)
      setPreviewBlobUrl(blobUrl);
      setPreviewUrl(blobUrl);
      setPreviewType(detectedType);
      setPreviewOpen(true);
    } catch (err) {
      console.error('❌ Erro ao abrir preview:', err);
      setPreviewError(err instanceof Error ? err.message : 'Failed to open document.');
      setPreviewOpen(true);
    } finally {
      setPreviewLoading(false);
    }
  };
  
  // Função para download do preview
  async function downloadPreview() {
    if (!previewDocument) return;
    
    try {
      const urlToDownload = previewDocument.translated_file_url || previewDocument.file_url;
      
      if (!urlToDownload) {
        alert('URL do arquivo não disponível.');
        return;
      }
      
      const { extractFilePathFromUrl } = await import('../../utils/fileUtils');
      const pathInfo = extractFilePathFromUrl(urlToDownload);
      
      if (!pathInfo) {
        alert('Não foi possível acessar o arquivo. URL inválida.');
        return;
      }
      
      const { db } = await import('../../lib/supabase');
      const filename = previewDocument.original_filename || previewDocument.filename || 'document';
      const success = await db.downloadFileAndTrigger(pathInfo.filePath, filename, pathInfo.bucket);
      
      if (!success) {
        alert('Não foi possível baixar o arquivo. Verifique se você está autenticado.');
      }
    } catch (err) {
      console.error('Error downloading preview:', err);
      alert(`Erro ao baixar arquivo: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    }
  }
  
  // Cleanup: revogar blob URL quando componente desmontar
  useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        window.URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewBlobUrl]);

  // O restante do componente (getStatusBadge e JSX) permanece o mesmo.
  const getStatusBadge = (doc: Document) => {
    const currentStatus = documentStatuses[doc.id] || doc.status;
    let color = '';
    let text = '';
    switch (currentStatus) {
      case 'pending':
        color = 'bg-yellow-100 text-yellow-800';
        text = t('dashboard.recentActivity.status.pending');
        break;
      case 'processing':
        color = 'bg-blue-100 text-blue-800';
        text = t('dashboard.recentActivity.status.processing');
        break;
      case 'completed':
      case 'approved':
        color = 'bg-green-100 text-green-800';
        text = t('dashboard.recentActivity.status.completed');
        break;
      case 'rejected':
        color = 'bg-red-100 text-red-800';
        text = t('dashboard.recentActivity.status.rejected');
        break;
      case 'refunded':
        color = 'bg-orange-100 text-orange-800';
        text = 'Refunded';
        break;
      case 'cancelled':
        color = 'bg-red-100 text-red-800';
        text = 'Cancelled';
        break;
      default:
        color = 'bg-gray-100 text-gray-600';
        text = currentStatus || t('dashboard.recentActivity.status.unknown');
    }
    return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${color}`}>{text}</span>;
  };

  if (documents.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
        <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-gray-900 mb-2">{t('dashboard.recentActivity.noActivity.title')}</h3>
        <p className="text-gray-600 text-lg">
          {t('dashboard.recentActivity.noActivity.description')}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <h3 className="text-2xl font-bold text-gray-900 mb-4">{t('dashboard.recentActivity.title')}</h3>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">{t('dashboard.recentActivity.loading')}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {recentDocuments.map((doc) => (
            <div key={doc.id} className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-2 shadow-sm">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileText className="w-6 h-6 text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-blue-900 truncate" title={doc.original_filename || doc.filename}>
                    {doc.original_filename || doc.filename}
                  </div>
                  {doc.original_filename && doc.original_filename !== doc.filename && (
                    <div className="text-xs text-blue-700 truncate" title={doc.filename}>
                      {doc.filename}
                    </div>
                  )}
                  <div className="text-xs text-blue-800 flex gap-2 items-center mt-0.5">
                    {getStatusBadge(doc)}
                    <span className="text-gray-500">{doc.created_at ? new Date(doc.created_at).toLocaleDateString() : ''}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2 md:mt-0">
                {doc.source === 'translated_documents' && !!doc.translated_file_url && (
                  <>
                    <button
                      onClick={() => handleDownload(doc.translated_file_url, doc.original_filename || doc.filename, doc.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-xs"
                    >
                      <Download className="w-4 h-4" /> {t('dashboard.recentActivity.actions.download')}
                    </button>
                    <button
                      onClick={() => handleViewDocument(doc)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-200 text-blue-700 rounded-lg font-medium hover:bg-blue-50 transition-colors text-xs"
                    >
                      {t('dashboard.recentActivity.actions.view')}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Visualização de Documento (Preview) */}
      {previewOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[10000]" style={{ touchAction: 'none' }}>
          <div className="absolute inset-0 bg-white flex flex-col">
            <div className="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-tfe-blue-600 flex-shrink-0" />
                <span className="font-semibold text-gray-900 text-xs sm:text-sm truncate">{previewDocument?.original_filename || previewDocument?.filename || 'Document preview'}</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                <button
                  className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
                  disabled={previewLoading || !previewUrl}
                  onClick={downloadPreview}
                >
                  Download
                </button>
                <button
                  className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
                  onClick={() => {
                    if (previewBlobUrl) {
                      window.URL.revokeObjectURL(previewBlobUrl);
                    }
                    setPreviewOpen(false);
                    setPreviewDocument(null);
                    setPreviewUrl(null);
                    setPreviewBlobUrl(null);
                    setPreviewError(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-50 overflow-auto" style={{ 
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x pan-y pinch-zoom'
            }}>
              {previewLoading && (
                <div className="flex items-center justify-center h-full text-gray-600">
                  <div className="text-center">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-sm sm:text-base">Loading document...</p>
                  </div>
                </div>
              )}
              {!previewLoading && previewError && (
                <div className="p-4 sm:p-6 text-center text-tfe-red-600">
                  <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2" />
                  <p className="text-sm sm:text-base">{previewError}</p>
                </div>
              )}
              {!previewLoading && !previewError && previewUrl && (
                <>
                  {previewType === 'image' ? (
                    <div className="flex items-center justify-center h-full p-2 sm:p-4" style={{ 
                      minHeight: 'calc(100vh - 60px)',
                      WebkitUserSelect: 'none',
                      userSelect: 'none'
                    }}>
                      <img 
                        src={previewUrl} 
                        alt={previewDocument?.filename || 'Document'} 
                        className="max-w-full max-h-full object-contain"
                        style={{ 
                          maxHeight: 'calc(100vh - 60px)',
                          width: 'auto',
                          height: 'auto',
                          display: 'block'
                        }}
                        draggable={false}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full" style={{ 
                      minHeight: 'calc(100vh - 60px)',
                      overflow: 'auto',
                      WebkitOverflowScrolling: 'touch'
                    }}>
                      <iframe 
                        src={previewUrl} 
                        className="w-full h-full border-0" 
                        title="Document Preview"
                        style={{
                          minHeight: 'calc(100vh - 60px)',
                          width: '100%',
                          height: '100%'
                        }}
                        scrolling="auto"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}