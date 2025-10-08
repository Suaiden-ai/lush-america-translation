import React, { useState, useEffect } from 'react';
import { XCircle, FileText, Calendar, Hash, Shield, Globe, DollarSign, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { getStatusColor, getStatusIcon } from '../../utils/documentUtils';
import { Document } from '../../App';
import { db } from '../../lib/supabase';
import { ImageViewerModal } from '../../components/ImageViewerModal';
import { getValidFileUrl } from '../../utils/fileUtils';

interface DocumentDetailsModalProps {
  document: Document | null;
  onClose: () => void;
}

interface TranslatedDocumentInfo {
  verification_code: string;
  translated_file_url: string;
  is_authenticated: boolean | null;
  authentication_date: string | null;
  authenticated_by_name: string | null;
}

export function DocumentDetailsModal({ document, onClose }: DocumentDetailsModalProps) {
  const [translatedInfo, setTranslatedInfo] = useState<TranslatedDocumentInfo | null>(null);
  const [loadingTranslated, setLoadingTranslated] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [imageToView, setImageToView] = useState<{ url: string; filename: string } | null>(null);

  // Buscar informações do documento traduzido quando o modal abrir
  useEffect(() => {
    const fetchTranslatedInfo = async () => {
      if (!document?.id) return;
      
      setLoadingTranslated(true);
      try {
        const translatedData = await db.getVerificationCode(document.id);
        setTranslatedInfo(translatedData);
      } catch (error) {
        console.error('Erro ao buscar código de verificação:', error);
        setTranslatedInfo(null);
      } finally {
        setLoadingTranslated(false);
      }
    };

    fetchTranslatedInfo();
  }, [document?.id]);

  if (!document) return null;

  // Função para formatar o tipo de tradução
  const formatTranslationType = (tipo: string | null) => {
    if (!tipo) return 'Standard';
    return tipo === 'Certificado' ? 'Certified Translation' : 'Notarized Translation';
  };

  // Função para formatar o idioma
  const formatLanguage = (idioma: string | null) => {
    if (!idioma) return 'Not specified';
    return idioma;
  };

  // Função para formatar o valor
  const formatValue = (valor: number | null) => {
    if (valor === null || valor === undefined) return 'N/A';
    return `R$ ${valor.toFixed(2)}`;
  };

  // Função para verificar se é uma imagem
  const isImageFile = (filename: string) => {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
    const extension = filename?.split('.').pop()?.toLowerCase();
    return imageExtensions.includes(extension || '');
  };

  // Função para visualizar arquivo
  const handleViewFile = async (url: string, filename: string) => {
    try {
      const validUrl = await getValidFileUrl(url);
      if (isImageFile(filename)) {
        setImageToView({ url: validUrl, filename });
        setShowImageViewer(true);
      } else {
        // Para PDFs e outros arquivos, abrir em nova aba
        window.open(validUrl, '_blank');
      }
    } catch (error) {
      console.error('Error opening file:', error);
      alert((error as Error).message || 'Failed to open file.');
    }
  };

  // Função para download automático (incluindo PDFs)
  const handleDownload = async (url: string, filename: string) => {
    try {
      // Obter uma URL válida
      const validUrl = await getValidFileUrl(url);
      
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
      alert((error as Error).message || 'Failed to download file.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-900">Document Details</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close modal"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Document Info */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center mb-3">
              <FileText className="w-5 h-5 text-gray-500 mr-2" />
              <span className="font-medium text-gray-900">{document.filename}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Pages:</span>
                <span className="ml-2 font-medium">{document.pages || 0}</span>
              </div>
              <div>
                <span className="text-gray-600">Cost:</span>
                <span className="ml-2 font-medium">{formatValue(document.total_cost)}</span>
              </div>
              {document.valor && (
                <div>
                  <span className="text-gray-600">Value:</span>
                  <span className="ml-2 font-medium">{formatValue(document.valor)}</span>
                </div>
              )}
              <div>
                <span className="text-gray-600">Status:</span>
                <span className="ml-2 font-medium capitalize">{document.status}</span>
              </div>
            </div>
          </div>

          {/* Translation Details */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Translation Details
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Type:</span>
                <span className="font-medium">{formatTranslationType(document.tipo_trad)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Source Language:</span>
                <span className="font-medium">{formatLanguage(document.idioma_raiz)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Bank Statement:</span>
                <span className="font-medium">{document.is_bank_statement ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Status:</span>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(document)}`}>
                  {getStatusIcon(document)}
                  <span className="ml-1 capitalize">{document.file_url ? 'Completed' : document.status}</span>
                </span>
          </div>

          {/* Upload Date */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Upload Date:</span>
            <div className="flex items-center text-sm text-gray-900">
              <Calendar className="w-4 h-4 mr-1" />
              <span className="text-gray-700">
                {document.upload_date ? new Date(document.upload_date).toLocaleDateString('pt-BR') : 
                 document.created_at ? new Date(document.created_at).toLocaleDateString('pt-BR') : '-'}
              </span>
            </div>
          </div>

          {/* Created Date */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Created:</span>
            <div className="flex items-center text-sm text-gray-900">
              <Clock className="w-4 h-4 mr-1" />
              <span className="text-gray-700">
                {document.created_at ? new Date(document.created_at).toLocaleDateString('pt-BR') : '-'}
              </span>
            </div>
          </div>

          {/* Verification Code */}
          {loadingTranslated ? (
            <div className="bg-tfe-blue-50 p-4 rounded-lg">
              <div className="flex items-center mb-2">
                <Hash className="w-5 h-5 text-tfe-blue-600 mr-2" />
                <span className="font-medium text-tfe-blue-950">Verification Code</span>
              </div>
              <div className="flex items-center justify-center py-4">
                <Clock className="w-5 h-5 animate-spin text-tfe-blue-600 mr-2" />
                <span className="text-sm text-tfe-blue-700">Loading verification code...</span>
              </div>
            </div>
          ) : translatedInfo?.verification_code ? (
            <div className="bg-tfe-blue-50 p-4 rounded-lg">
              <div className="flex items-center mb-2">
                <Hash className="w-5 h-5 text-tfe-blue-600 mr-2" />
                <span className="font-medium text-tfe-blue-950">Verification Code</span>
              </div>
              <p className="font-mono text-lg text-tfe-blue-950 mb-2">{translatedInfo.verification_code}</p>
              <p className="text-sm text-tfe-blue-700">
                Use this code to verify the authenticity of your translated document.
              </p>
            </div>
          ) : document.verification_code ? (
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="flex items-center mb-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                <span className="font-medium text-yellow-950">Temporary Code</span>
              </div>
              <p className="font-mono text-lg text-yellow-950 mb-2">{document.verification_code}</p>
              <p className="text-sm text-yellow-700">
                This is a temporary code. The final verification code will be available when the translation is completed.
              </p>
            </div>
          ) : (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center mb-2">
                <AlertCircle className="w-5 h-5 text-gray-600 mr-2" />
                <span className="font-medium text-gray-950">Processing Status</span>
              </div>
              <p className="text-sm text-gray-700">
                Your document is still being processed by our system. The verification code will be available once the translation is completed and authenticated.
              </p>
            </div>
          )}

          {/* Authentication Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Authenticated:</span>
            <div className="flex items-center">
              {translatedInfo?.is_authenticated ? (
                <div className="flex items-center text-green-600">
                  <Shield className="w-4 h-4 mr-1" />
                  <span className="text-sm font-medium">Yes</span>
                  {translatedInfo.authenticated_by_name && (
                    <span className="text-xs text-gray-500 ml-2">
                      by {translatedInfo.authenticated_by_name}
                    </span>
                  )}
                </div>
              ) : document.is_authenticated ? (
                <div className="flex items-center text-yellow-600">
                  <Shield className="w-4 h-4 mr-1" />
                  <span className="text-sm font-medium">Pending</span>
                </div>
              ) : (
                <div className="flex items-center text-gray-500">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  <span className="text-sm">Not yet processed</span>
                </div>
              )}
            </div>
          </div>

          {/* Authentication Date */}
          {translatedInfo?.authentication_date && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Authentication Date:</span>
              <div className="flex items-center text-sm text-gray-900">
                <Calendar className="w-4 h-4 mr-1" />
                <span className="text-gray-700">
                  {new Date(translatedInfo.authentication_date).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>
          )}

          {/* Status-specific information */}
          {document.status === 'pending' && (
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="font-medium text-yellow-900 mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Processing Information
              </h4>
              <p className="text-sm text-yellow-800">
                Your document is in the queue for translation. Processing typically takes 24-48 hours.
              </p>
            </div>
          )}

          {document.status === 'processing' && (
            <div className="bg-tfe-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-tfe-blue-950 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Translation in Progress
              </h4>
              <p className="text-sm text-tfe-blue-800">
                Our certified translators are currently working on your document. 
                You'll be notified when it's completed.
              </p>
            </div>
          )}

          {document.status === 'completed' && (
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Translation Complete
              </h4>
              <p className="text-sm text-green-800">
                Your certified translation is ready for download. The document includes 
                official authentication and is accepted by USCIS.
              </p>
                             <div className="flex gap-2 mt-3">
                 {translatedInfo?.translated_file_url ? (
                   <>
                                           <button 
                        className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
                        onClick={() => handleDownload(translatedInfo.translated_file_url, `translated_${document.filename}`)}
                      >
                        Download Translation
                      </button>
                     <button 
                       className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                       onClick={() => handleViewFile(translatedInfo.translated_file_url, `translated_${document.filename}`)}
                     >
                       View Translation
                     </button>
                   </>
                 ) : document.file_url && (
                   <>
                                           <button 
                        className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
                        onClick={() => handleDownload(document.file_url!, document.filename)}
                      >
                        Download Original
                      </button>
                     <button 
                       className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                       onClick={() => handleViewFile(document.file_url!, document.filename)}
                     >
                       View Original
                     </button>
                   </>
                 )}
               </div>
            </div>
          )}

          {document.status === 'refunded' && (
            <div className="bg-orange-50 p-4 rounded-lg">
              <h4 className="font-medium text-orange-900 mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Payment Refunded
              </h4>
              <p className="text-sm text-orange-800">
                This document's payment has been refunded. The translation process has been cancelled 
                and you should have received a refund for this order.
              </p>
            </div>
          )}

          {document.status === 'cancelled' && (
            <div className="bg-red-50 p-4 rounded-lg">
              <h4 className="font-medium text-red-900 mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Order Cancelled
              </h4>
              <p className="text-sm text-red-800">
                This document's order has been cancelled. The translation process has been stopped 
                and no charges were made for this order.
              </p>
            </div>
          )}

          {/* File Information */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">File Information</h4>
            <div className="space-y-1 text-sm">
              {document.file_id && (
                <div className="flex justify-between">
                  <span className="text-gray-600">File ID:</span>
                  <span className="font-mono text-xs">{document.file_id}</span>
                </div>
              )}
              {document.file_url && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Original File URL:</span>
                  <span className="font-mono text-xs truncate max-w-[200px]">{document.file_url}</span>
                </div>
              )}
              {translatedInfo?.translated_file_url && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Translated File URL:</span>
                  <span className="font-mono text-xs truncate max-w-[200px]">{translatedInfo.translated_file_url}</span>
                </div>
              )}
              {document.folder_id && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Folder ID:</span>
                  <span className="font-mono text-xs">{document.folder_id}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Document ID:</span>
                <span className="font-mono text-xs">{document.id}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Close
          </button>
                 </div>
       </div>

       {/* Image Viewer Modal */}
       {showImageViewer && imageToView && (
         <ImageViewerModal
           imageUrl={imageToView.url}
           filename={imageToView.filename}
           onClose={() => {
             setShowImageViewer(false);
             setImageToView(null);
           }}
         />
       )}
     </div>
   );
 }