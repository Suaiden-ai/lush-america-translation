import React from 'react';
import { FileText, Eye, Download, Copy } from 'lucide-react';
import { getStatusColor, getStatusIcon } from '../../utils/documentUtils';
import { Document } from '../../App';
import { db } from '../../lib/supabase';
import { Logger } from '../../lib/loggingHelpers';
import { ActionTypes } from '../../types/actionTypes';
import { useAuth } from '../../hooks/useAuth';

interface DocumentsListProps {
  documents: Document[];
  onViewDocument: (document: Document) => void;
}

export function DocumentsList({ documents, onViewDocument }: DocumentsListProps) {
  const { user } = useAuth();
  
  const copyVerificationCode = (code: string) => {
    navigator.clipboard.writeText(code);
    // You could add a toast notification here
  };

  // Função para download automático (incluindo PDFs)
  // Usa download direto - bucket público
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
                download_type: 'documents_list_download'
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
        // Se não conseguir extrair, verificar se é URL do Supabase (não deve tentar fetch direto)
        if (url.includes('supabase.co')) {
          throw new Error('Não foi possível acessar o arquivo. URL do Supabase inválida ou expirada.');
        }
        
        // Se não for URL do Supabase, tentar download direto da URL (para S3 externo)
        try {
          const response = await fetch(url);
          if (response.ok) {
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = window.document.createElement('a');
            link.href = downloadUrl;
            link.download = filename;
            window.document.body.appendChild(link);
            link.click();
            window.document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
            return;
          } else {
            throw new Error('Não foi possível acessar o arquivo. Verifique sua conexão.');
          }
        } catch (error) {
          throw new Error('Não foi possível acessar o arquivo. Verifique sua conexão.');
        }
      }
      
      // Usar download direto
      const success = await db.downloadFileAndTrigger(pathInfo.filePath, filename, pathInfo.bucket);
      
      if (!success) {
        throw new Error('Não foi possível baixar o arquivo. Por favor, tente novamente.');
      }
    } catch (error: any) {
      console.error('Erro no download:', error);
      alert(`Erro ao baixar arquivo: ${error.message || 'Erro desconhecido'}`);
    }
  };

  if (documents.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-gray-900 mb-2">No Documents Yet</h3>
        <p className="text-gray-600 text-lg">
          Upload your first document to get started with professional translation services.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-2xl font-bold text-gray-900">Your Documents</h3>
      </div>
      
      <div className="divide-y divide-gray-200">
        {documents.map((doc) => (
          <div key={doc.id} className="p-6 hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-tfe-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-tfe-blue-950" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">{doc.filename}</h4>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span>{doc.pages} pages</span>
                    <span>•</span>
                    <span>${doc.totalCost}.00</span>
                    <span>•</span>
                    <span>{new Date(doc.uploadDate).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(doc)}`}>
                  {getStatusIcon(doc)}
                  <span className="ml-1 capitalize">{doc.file_url ? 'Completed' : doc.status}</span>
                </span>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onViewDocument(doc)}
                    className="p-2 text-gray-400 hover:text-tfe-blue-600 transition-colors"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  
                  {doc.file_url && (
                    <button
                      onClick={() => handleDownload(doc.file_url!, doc.filename, doc.id)}
                      className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                      title="Download Original"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            {doc.verificationCode && (
              <div className="mt-4 bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Verification Code:</span>
                    <span className="ml-2 font-mono text-sm text-gray-900">{doc.verificationCode}</span>
                  </div>
                  <button
                    onClick={() => copyVerificationCode(doc.verificationCode!)}
                    className="p-1 text-gray-400 hover:text-tfe-blue-600 transition-colors"
                    title="Copy Code"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}