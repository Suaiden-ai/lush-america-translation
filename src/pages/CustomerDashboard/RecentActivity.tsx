import React, { useState, useEffect, useMemo } from 'react';
import { Clock, FileText, Download } from 'lucide-react';
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
    
    console.log('🔍 Documentos na RecentActivity:', recentDocuments.map(doc => ({ 
      id: doc.id, 
      filename: doc.filename,
      status: doc.status,
      source: doc.source,
      user_id: doc.user_id 
    })));
    
    // Usar os status que já vêm do useTranslatedDocuments
    const statusMap: DocumentStatus = {};
    recentDocuments.forEach(doc => {
      statusMap[doc.id] = doc.status || 'unknown';
    });

    console.log('🔍 Mapa de status criado a partir dos dados do useTranslatedDocuments:', statusMap);

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
          console.log('✅ Document download logged successfully');
        } catch (logError) {
          console.error('Error logging document download:', logError);
        }
      }

      const response = await fetch(url);
      
      if (!response.ok && response.status === 403) {
        console.log('URL expirado, regenerando URL...');
        const urlParts = url.split('/');
        const filePath = urlParts.slice(-2).join('/');
        
        // Tentar URL público primeiro
        const publicUrl = await db.generatePublicUrl(filePath);
        if (publicUrl) {
          try {
            const publicResponse = await fetch(publicUrl);
            if (publicResponse.ok) {
              const blob = await publicResponse.blob();
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
            console.log('URL público falhou, tentando URL pré-assinado...');
          }
        }
        
        // Tentar URL pré-assinado
        const signedUrl = await db.generateSignedUrl(filePath);
        if (signedUrl) {
          try {
            const signedResponse = await fetch(signedUrl);
            if (signedResponse.ok) {
              const blob = await signedResponse.blob();
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
            console.error('Erro ao baixar com URL pré-assinada:', error);
          }
        }
        
        throw new Error('Não foi possível baixar o arquivo. Tente novamente mais tarde.');
      }
      
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
      } else {
        throw new Error(`Erro ao baixar arquivo: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Erro no download:', error);
      alert(`Erro ao baixar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  // Função para visualizar documento
  const handleViewDocument = async (doc: Document) => {
    const currentStatus = documentStatuses[doc.id] || doc.status;
    
    console.log(`🎯 View clicked - Doc: ${doc.original_filename || doc.filename}, Status: ${currentStatus}`);
    console.log(`🔍 Documento completo:`, doc);

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
            view_type: 'recent_activity_view',
            document_status: currentStatus
          },
          affectedUserId: user?.id,
          performerType: 'user'
        }
      );
      console.log('✅ Document view logged successfully');
    } catch (logError) {
      console.error('Error logging document view:', logError);
    }
    
    // Se o documento já tem translated_file_url (vem de translated_documents), usar diretamente
    if (doc.translated_file_url) {
      const fileExtension = (doc.original_filename || doc.filename)?.split('.').pop()?.toLowerCase();
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
      
      if (imageExtensions.includes(fileExtension || '')) {
        // Para imagens, criar um documento temporário com a URL traduzida
        const translatedDocForViewing = {
          ...doc,
          file_url: doc.translated_file_url
        };
        onViewDocument(translatedDocForViewing);
      } else {
        // Para PDFs, abrir a URL traduzida diretamente
        window.open(doc.translated_file_url, '_blank');
      }
      return;
    }
    
    // Se o documento está completed mas não tem translated_file_url, buscar na translated_documents
    if (currentStatus === 'completed') {
      try {
        console.log(`🔍 Buscando documento traduzido para: ${doc.filename}`);
        
        const { data: translatedDocs, error } = await supabase
          .from('translated_documents')
          .select('translated_file_url, filename')
          .eq('user_id', doc.user_id)
          .eq('filename', doc.filename);

        console.log('🎯 Documentos traduzidos encontrados:', translatedDocs);

        if (translatedDocs && translatedDocs.length > 0 && translatedDocs[0].translated_file_url) {
          const fileExtension = (doc.original_filename || doc.filename)?.split('.').pop()?.toLowerCase();
          const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
          
          if (imageExtensions.includes(fileExtension || '')) {
            const translatedDocForViewing = {
              ...doc,
              file_url: translatedDocs[0].translated_file_url
            };
            onViewDocument(translatedDocForViewing);
          } else {
            window.open(translatedDocs[0].translated_file_url, '_blank');
          }
          return;
        }
      } catch (error) {
        console.error('Erro ao buscar documento traduzido:', error);
      }
    }
    
    // Fallback: mostrar documento original
    const fileExtension = (doc.original_filename || doc.filename)?.split('.').pop()?.toLowerCase();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
    if (imageExtensions.includes(fileExtension || '')) {
      onViewDocument(doc);
    } else {
      window.open(doc.file_url!, '_blank');
    }
  };

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
    </div>
  );
}