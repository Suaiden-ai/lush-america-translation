import { useState } from 'react';
import { useDocumentsWithMissingFiles, DocumentWithMissingFile } from '../../hooks/useDocumentsWithMissingFiles';
import { MissingFileAlert } from './MissingFileAlert';
import { RetryUploadModal } from './RetryUploadModal';

interface DocumentUploadRetryProps {
  userId?: string;
}

export function DocumentUploadRetry({ userId }: DocumentUploadRetryProps) {
  const { documents, loading, refetch, count, error } = useDocumentsWithMissingFiles(userId);
  const [selectedDocument, setSelectedDocument] = useState<DocumentWithMissingFile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Debug logs
  console.log('[DocumentUploadRetry] Renderizando:', { userId, count, loading, error, documentsCount: documents.length });

  const handleViewDocuments = () => {
    // Navegar para página de lista de documentos com falha
    if (documents.length > 0) {
      window.location.href = '/dashboard/retry-upload';
    }
  };

  const handleOpenModal = (document: DocumentWithMissingFile) => {
    setSelectedDocument(document);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedDocument(null);
  };

  const handleUploadSuccess = () => {
    // Recarregar lista de documentos após sucesso
    refetch();
  };

  if (loading) {
    return null; // Não mostrar nada enquanto carrega
  }

  if (count === 0) {
    return null; // Não mostrar nada se não houver documentos problemáticos
  }

  return (
    <>
      <MissingFileAlert count={count} onViewDocuments={handleViewDocuments} />
      
      {selectedDocument && (
        <RetryUploadModal
          document={selectedDocument}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSuccess={handleUploadSuccess}
        />
      )}
    </>
  );
}

// Exportar função helper para abrir modal de um documento específico
export function openRetryModal(document: DocumentWithMissingFile) {
  // Esta função pode ser usada por outros componentes
  return document;
}

