import { useState, useEffect } from 'react';
import { Document, PreviewType } from '../types/authenticator.types';
import { detectPreviewType } from '../utils/documentUtils';

export function useDocumentPreview() {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<PreviewType>('unknown');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);

  async function openPreview(doc: Document) {
    try {
      setPreviewLoading(true);
      setPreviewError(null);
      setPreviewDocument(doc);
      const urlToView = doc.translated_file_url || doc.file_url;
      
      if (!urlToView) {
        setPreviewError('No document available to view.');
        setPreviewOpen(true);
        return;
      }
      
      // IMPORTANTE: Usar blob URL para evitar expor URL original no DOM
      // 1. Extrair filePath da URL original
      const { extractFilePathFromUrl } = await import('../../../../utils/fileUtils');
      const pathInfo = extractFilePathFromUrl(urlToView);
      
      if (!pathInfo) {
        throw new Error('Não foi possível extrair informações do arquivo da URL.');
      }
      
      // 2. Fazer download do arquivo
      const { db } = await import('../../../../lib/supabase');
      const blob = await db.downloadFile(pathInfo.filePath, pathInfo.bucket);
      
      if (!blob) {
        throw new Error('Não foi possível baixar o arquivo. Por favor, tente novamente.');
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
  }

  async function downloadPreview(filename?: string | null) {
    if (!previewDocument) return;
    
    try {
      // Usar URL original do documento para download (não o blob URL)
      const urlToDownload = previewDocument.translated_file_url || previewDocument.file_url;
      
      if (!urlToDownload) {
        alert('URL do arquivo não disponível.');
        return;
      }
      
      // Extrair filePath e bucket da URL original
      const { extractFilePathFromUrl } = await import('../../../../utils/fileUtils');
      const pathInfo = extractFilePathFromUrl(urlToDownload);
      
      if (!pathInfo) {
        // Se não conseguir extrair, tentar download direto da URL
        try {
          const response = await fetch(urlToDownload);
          if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename || previewDocument.filename || 'document';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            return;
          }
        } catch (error) {
          console.error('Erro no download direto:', error);
          alert('Não foi possível acessar o arquivo. Verifique sua conexão.');
          return;
        }
      }
      
      // Usar download autenticado direto
      const downloadFilename = filename || previewDocument.filename || 'document';
      const { db } = await import('../../../../lib/supabase');
      const success = await db.downloadFileAndTrigger(pathInfo.filePath, downloadFilename, pathInfo.bucket);
      
      if (!success) {
        alert('Não foi possível baixar o arquivo. Por favor, tente novamente.');
      }
    } catch (err) {
      console.error('Error downloading preview:', err);
      alert(`Erro ao baixar arquivo: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    }
  }

  function closePreview() {
    // Revogar blob URL para liberar memória e evitar vazamento
    if (previewBlobUrl) {
      window.URL.revokeObjectURL(previewBlobUrl);
    }
    setPreviewOpen(false);
    setPreviewDocument(null);
    setPreviewUrl(null);
    setPreviewBlobUrl(null);
    setPreviewError(null);
  }

  // Cleanup: revogar blob URL quando componente desmontar
  useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        window.URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewBlobUrl]);

  return {
    previewOpen,
    previewUrl,
    previewType,
    previewLoading,
    previewError,
    previewDocument,
    openPreview,
    closePreview,
    downloadPreview
  };
}
