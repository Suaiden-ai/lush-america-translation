import React, { useState, useEffect } from 'react';
import { XCircle, FileText, User, Calendar, Hash, Eye, Download, Phone } from 'lucide-react';
import { getStatusColor, getStatusIcon } from '../../utils/documentUtils';
import { Document } from './PaymentsTable';
import { supabase, db } from '../../lib/supabase';

interface DocumentDetailsModalProps {
  document: Document | null;
  onClose: () => void;
}

// Definindo um tipo para o perfil do usuário para maior clareza
type UserProfile = {
  name: string;
  email: string;
  phone: string | null;
};

export function DocumentDetailsModal({ document, onClose }: DocumentDetailsModalProps) {
  // Estados para informações do usuário e do documento
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [translatedDoc, setTranslatedDoc] = useState<{ translated_file_url: string; filename: string; original_document_id?: string; } | null>(null);
  const [loadingTranslated, setLoadingTranslated] = useState(false);
  const [actualDocumentStatus, setActualDocumentStatus] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Buscar documento traduzido, perfil do usuário e status atualizado quando o documento mudar
  useEffect(() => {
    if (document) {
      fetchUserProfile();
      fetchTranslatedDocument();
      fetchActualDocumentStatus();
    }
  }, [document]);

  const fetchUserProfile = async () => {
    if (!document?.user_id) return;
    
    setLoadingProfile(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, email, phone')
        .eq('id', document.user_id)
        .single();
      
      if (error) {
        console.error('❌ Erro ao buscar perfil do usuário:', error);
        setUserProfile(null);
      } else {
        setUserProfile(data);
      }
    } catch (err) {
      console.error('💥 Erro na busca do perfil:', err);
      setUserProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchTranslatedDocument = async () => {
    if (!document?.user_id || !document.filename) return;
    
    setLoadingTranslated(true);
    try {
      console.log('🔍 Buscando documento traduzido para:', { 
        user_id: document.user_id, 
        filename: document.filename,
        document_type: document.document_type
      });

      // Para documentos de autenticador, usar uma abordagem diferente
      if (document.document_type === 'authenticator') {
        console.log('🔄 Processando documento de autenticador...');
        
        // Primeiro buscar na tabela translated_documents por user_id e filename
        const { data: translatedDocs, error: translatedError } = await supabase
          .from('translated_documents')
          .select('translated_file_url, filename, original_document_id')
          .eq('user_id', document.user_id)
          .eq('filename', document.filename)
          .order('created_at', { ascending: false });

        if (translatedError) {
          console.error('❌ Erro ao buscar documentos traduzidos (autenticador):', translatedError);
        } else if (translatedDocs && translatedDocs.length > 0) {
          console.log('✅ Documento traduzido encontrado (autenticador):', translatedDocs[0]);
          setTranslatedDoc(translatedDocs[0]);
          return;
        }
        
        // Se não encontrar, usar a URL do próprio documento se existir
        if (document.translated_file_url) {
          console.log('✅ Usando URL do documento de autenticador:', document.translated_file_url);
          setTranslatedDoc({
            translated_file_url: document.translated_file_url,
            filename: document.filename
          });
          return;
        }
        
        console.log('ℹ️ Nenhum arquivo traduzido encontrado para documento de autenticador');
        return;
      }

      // Para documentos de pagamento, usar a lógica original
      console.log('🔄 Processando documento de pagamento...');
      
      // Primeiro, buscar o document_id na tabela documents_to_be_verified usando o filename
      const { data: verifiedDoc, error: verifiedError } = await supabase
        .from('documents_to_be_verified')
        .select('id, filename')
        .eq('user_id', document.user_id)
        .eq('filename', document.filename)
        .single();

      if (verifiedError) {
        console.error('❌ Erro ao buscar documento verificado:', verifiedError);
        
        // Fallback: buscar diretamente na translated_documents por user_id e filename
        const { data: translatedDocs, error } = await supabase
          .from('translated_documents')
          .select('translated_file_url, filename, original_document_id')
          .eq('user_id', document.user_id)
          .eq('filename', document.filename);

        if (error) {
          console.error('❌ Erro ao buscar documentos traduzidos (fallback):', error);
          return;
        }

        console.log('📋 Documentos traduzidos encontrados (fallback):', translatedDocs);
        
        if (translatedDocs && translatedDocs.length > 0) {
          setTranslatedDoc(translatedDocs[0]);
          console.log('✅ Documento traduzido encontrado via fallback:', translatedDocs[0]);
        }
        return;
      }

      console.log('📋 Documento verificado encontrado:', verifiedDoc);

      // Agora buscar o documento traduzido usando o original_document_id
      const { data: translatedDocs, error } = await supabase
        .from('translated_documents')
        .select('translated_file_url, filename, original_document_id, user_id')
        .eq('original_document_id', verifiedDoc.id)
        .eq('user_id', document.user_id);

      if (error) {
        console.error('❌ Erro ao buscar documentos traduzidos:', error);
        return;
      }
      
      console.log('📋 Documentos traduzidos encontrados por original_document_id:', translatedDocs);
      
      if (translatedDocs && translatedDocs.length > 0) {
        // Pegar o mais recente se houver múltiplos
        const matchingTranslatedDoc = translatedDocs[0];
        console.log('✅ Documento traduzido encontrado:', matchingTranslatedDoc);
        setTranslatedDoc(matchingTranslatedDoc);
      } else {
        console.log('ℹ️ Nenhum documento traduzido encontrado para este documento verificado');
      }
    } catch (error) {
      console.error('💥 Erro ao buscar documento traduzido:', error);
    } finally {
      setLoadingTranslated(false);
    }
  };

  const fetchActualDocumentStatus = async () => {
    if (!document?.filename) return;
    
    setLoadingStatus(true);
    try {
      // Buscar o status real na tabela documents_to_be_verified
      // Status 'completed' ou 'approved' indica que foi aprovado pelo autenticador
      const { data: verifiedDoc, error } = await supabase
        .from('documents_to_be_verified')
        .select('status')
        .eq('filename', document.filename)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('❌ Erro ao buscar status do documento:', error);
      }
      
      // Define o status do documento verificado se encontrado, senão mantém o status original
      setActualDocumentStatus(verifiedDoc ? verifiedDoc.status : document.status);

    } catch (err) {
      console.error('💥 Erro na busca do status:', err);
      setActualDocumentStatus(document.status); // Fallback para o status original em caso de erro
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleDownload = async () => {
    if (!document) return;
    
    // Verificar se o documento foi aprovado pelo autenticador
    const isAuthenticated = actualDocumentStatus === 'completed' || actualDocumentStatus === 'approved';
    
    let fileUrl: string | null = null;
    
    if (isAuthenticated) {
      // Para documentos aprovados, priorizar SEMPRE arquivo da tabela translated_documents
      fileUrl = translatedDoc?.translated_file_url || document?.translated_file_url || document?.file_path || null;
      console.log('📄 Download - Documento aprovado - usando arquivo traduzido:', {
        translatedDocUrl: translatedDoc?.translated_file_url,
        documentTranslatedUrl: document?.translated_file_url,
        fallbackUrl: document?.file_path,
        finalUrl: fileUrl
      });
    } else {
      // Para documentos não aprovados, usar apenas o arquivo original
      fileUrl = document?.file_path || null;
      console.log('📄 Download - Documento não aprovado - usando arquivo original:', fileUrl);
    }
    
    if (fileUrl) {
      try {
        // Extrair filePath e bucket da URL
        const { extractFilePathFromUrl } = await import('../../utils/fileUtils');
        const pathInfo = extractFilePathFromUrl(fileUrl);
        
        if (!pathInfo) {
          // Se não conseguir extrair, tentar download direto da URL (para S3 externo)
          try {
            const response = await fetch(fileUrl);
            if (response.ok) {
              const blob = await response.blob();
              const downloadUrl = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = downloadUrl;
              link.download = document.filename;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.URL.revokeObjectURL(downloadUrl);
              return;
            }
          } catch (error) {
            alert('Não foi possível acessar o arquivo. Verifique sua conexão.');
            return;
          }
        }
        
        // Usar download direto
        const success = await db.downloadFileAndTrigger(pathInfo.filePath, document.filename, pathInfo.bucket);
        
        if (!success) {
          alert('Não foi possível baixar o arquivo. Por favor, tente novamente.');
        }
      } catch (error) {
        console.error('Error downloading file:', error);
        alert(`Erro ao baixar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    } else {
        alert('No file available to download');
    }
  };

  const handleViewFile = async () => {
    // Verificar se o documento foi aprovado pelo autenticador
    const isAuthenticated = actualDocumentStatus === 'completed' || actualDocumentStatus === 'approved';
    
    console.log('🔍 HandleViewFile - Status check:', {
      actualDocumentStatus,
      isAuthenticated,
      documentStatus: document?.status
    });
    
    let url: string | null = null;
    
    if (isAuthenticated) {
      // Para documentos aprovados, priorizar SEMPRE arquivo da tabela translated_documents
      url = translatedDoc?.translated_file_url || document?.translated_file_url || document?.file_path || null;
      console.log('📄 Documento aprovado - usando arquivo traduzido:', {
        translatedDocUrl: translatedDoc?.translated_file_url,
        documentTranslatedUrl: document?.translated_file_url,
        fallbackUrl: document?.file_path,
        finalUrl: url,
        translatedDocData: translatedDoc
      });
    } else {
      // Para documentos não aprovados, usar apenas o arquivo original
      url = document?.file_path || null;
      console.log('📄 Documento não aprovado - usando arquivo original:', url);
    }
    
    console.log('🚀 Tentando abrir URL:', url);
    
    if (url) {
      // SEMPRE gerar um novo signed URL para visualização
      const { db } = await import('../../lib/supabase');
      const viewUrl = await db.generateViewUrl(url);
      
      if (viewUrl) {
        window.open(viewUrl, '_blank', 'noopener,noreferrer');
      } else {
        // Logar erro quando não consegue gerar URL de visualização
        try {
          const { logError, showUserFriendlyError } = await import('../../utils/errorHelpers');
          const { extractFilePathFromUrl } = await import('../../utils/fileUtils');
          
          const pathInfo = extractFilePathFromUrl(url);
          const logFilename = document?.filename || 'unknown';
          
          await logError('view', new Error('VIEW_ERROR'), {
            userId: document?.user_id,
            documentId: document?.id,
            filePath: pathInfo?.filePath,
            filename: logFilename,
            bucket: pathInfo?.bucket,
            additionalInfo: {
              operation: 'generate_view_url_failed',
              original_url: url,
            },
          });
          
          showUserFriendlyError('VIEW_ERROR');
        } catch (logError) {
          console.error('Error logging view error:', logError);
          alert('Não foi possível gerar link para visualização. Por favor, tente novamente.');
        }
      }
    } else {
      console.error('❌ Nenhuma URL disponível para visualizar');
      alert('No file available to view');
    }
  };

  if (!document) return null;

  const currentStatus = actualDocumentStatus || document.status;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">Document Details</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Close modal">
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          {/* File Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <FileText className="w-6 h-6 text-tfe-blue-600" />
              <h4 className="text-lg font-semibold text-gray-900">File Information</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Filename</label>
                <p className="text-gray-900 break-all">{document.filename}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Pages</label>
                <p className="text-gray-900">{document.pages || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Total Cost</label>
                <p className="text-gray-900 font-semibold">${document.total_cost || 0}.00</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Status</label>
                <div className="mt-1">
                  {loadingStatus ? (
                    <span className="text-gray-500">Loading...</span>
                  ) : (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor({ status: currentStatus } as any)}`}>
                      {getStatusIcon({ status: currentStatus } as any)}
                      <span className="ml-1 capitalize">{currentStatus || 'Unknown'}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* User Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <User className="w-6 h-6 text-green-600" />
              <h4 className="text-lg font-semibold text-gray-900">User Information</h4>
            </div>
            {loadingProfile ? (
              <p className="text-gray-500">Loading user data...</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Name</label>
                  <p className="text-gray-900">{userProfile?.name || document.user_name || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <p className="text-gray-900 break-all">{userProfile?.email || document.user_email || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    Phone Number
                  </label>
                  <p className="text-gray-900">{userProfile?.phone || document.user_phone || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">User ID</label>
                  <p className="text-gray-900 font-mono text-sm break-all bg-gray-100 p-2 rounded">
                    {document.user_id || 'Not available'}
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {/* Document Details, Dates, Verification sections... (sem alterações) */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <Hash className="w-6 h-6 text-purple-600" />
              <h4 className="text-lg font-semibold text-gray-900">Document Details</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Translation Type</label>
                <p className="text-gray-900">{document.translation_type || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Source Language</label>
                <p className="text-gray-900">{document.source_language || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Target Language</label>
                <p className="text-gray-900">{document.target_language || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Bank Statement</label>
                <p className="text-gray-900">{document.bank_statement ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Authenticated</label>
                <p className="text-gray-900">{document.authenticated ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <Calendar className="w-6 h-6 text-orange-600" />
              <h4 className="text-lg font-semibold text-gray-900">Timeline</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Created</label>
                <p className="text-gray-900">{document.created_at ? new Date(document.created_at).toLocaleString() : 'Not available'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Last Updated</label>
                <p className="text-gray-900">{(document as any).updated_at ? new Date((document as any).updated_at).toLocaleString() : 'Not available'}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <Hash className="w-6 h-6 text-tfe-red-600" />
              <h4 className="text-lg font-semibold text-gray-900">Verification</h4>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Verification Code</label>
              <p className="text-gray-900 font-mono text-sm break-all">{(document as any).verification_code || 'Not available'}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-tfe-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <Eye className="w-6 h-6 text-tfe-blue-600" />
              <h4 className="text-lg font-semibold text-tfe-blue-950">File Actions</h4>
              {loadingTranslated && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-tfe-blue-600"></div>
              )}
              {/* Mostrar status de aprovação */}
              {actualDocumentStatus === 'completed' || actualDocumentStatus === 'approved' ? (
                (document.translated_file_url || translatedDoc?.translated_file_url) && (
                  <span className="bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded-full">
                    Approved - Translated Available
                  </span>
                )
              ) : (
                <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-1 rounded-full">
                  Awaiting Authentication
                </span>
              )}
            </div>
            
            {/* Aviso quando não foi aprovado */}
            {!(actualDocumentStatus === 'completed' || actualDocumentStatus === 'approved') && (
              <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Translated documents are only available after authenticator approval. 
                  Currently showing original document only.
                </p>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleViewFile}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-tfe-blue-600 text-white rounded-lg hover:bg-tfe-blue-700 transition-colors disabled:opacity-50"
                disabled={loadingTranslated}
              >
                <Eye className="w-4 h-4" />
                {(actualDocumentStatus === 'completed' || actualDocumentStatus === 'approved') && 
                 (document.translated_file_url || translatedDoc?.translated_file_url) 
                  ? 'View Translated File' 
                  : 'View Original File'
                }
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                disabled={loadingTranslated}
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}