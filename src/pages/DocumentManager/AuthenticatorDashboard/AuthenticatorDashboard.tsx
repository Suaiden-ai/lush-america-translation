import { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { FileText } from 'lucide-react';
import { Document } from './types/authenticator.types';

// Hooks
import { useAuthenticatorData } from './hooks/useAuthenticatorData';
import { usePagination } from './hooks/usePagination';
import { useDocumentPreview } from './hooks/useDocumentPreview';
import { useUserModal } from './hooks/useUserModal';
import { useDocumentActions } from './hooks/useDocumentActions';

// Components
import { AuthenticatorHeader } from './components/AuthenticatorHeader';
import { StatsCards } from './components/StatsCards';
import { AuthenticationInstructions } from './components/AuthenticationInstructions';
import { DocumentTableMobile } from './components/DocumentTableMobile';
import { DocumentTableDesktop } from './components/DocumentTableDesktop';
import { Pagination } from './components/Pagination';
import { ApprovalModal } from './components/ApprovalModal';
import { CorrectionModal } from './components/CorrectionModal';
import { UserInfoModal } from './components/UserInfoModal';
import { DocumentPreviewModal } from './components/DocumentPreviewModal';

export default function AuthenticatorDashboard() {
  const { user: currentUser } = useAuth();

  // Hooks de dados
  const { documents, loading, error, stats, refresh } = useAuthenticatorData();
  const { currentPage, totalPages, startIndex, endIndex, paginatedItems, setCurrentPage } = usePagination({
    items: documents,
    itemsPerPage: 10
  });

  // Hooks de UI
  const { previewOpen, previewDocument, previewUrl, previewType, previewLoading, previewError, openPreview, closePreview, downloadPreview } = useDocumentPreview();
  const { selectedUser, userModalOpen, userLoading, userError, viewUser, closeModal: closeUserModal } = useUserModal();
  
  // Estado para userId do modal
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  
  const handleViewUser = (userId: string) => {
    setViewingUserId(userId);
    viewUser(userId);
  };

  // Hook de ações
  const { approveDocument, rejectDocument, uploadCorrection, uploadStates, rejectedRows, setUploadState } = useDocumentActions({
    currentUser,
    onDocumentRemoved: (documentId: string) => {
      // O hook useAuthenticatorData vai atualizar automaticamente quando refresh for chamado
      refresh();
    },
    onStatsUpdate: () => {
      refresh();
    }
  });

  // Estados locais para modais de confirmação
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [modalDocument, setModalDocument] = useState<Document | null>(null);

  // Handlers
  const handleApproveConfirm = async () => {
    if (!modalDocument) return;
    setShowApprovalModal(false);
    await approveDocument(modalDocument.id, modalDocument);
    setModalDocument(null);
  };

  const handleReject = (id: string) => {
    rejectDocument(id);
  };

  const handleCorrectionUploadConfirm = async () => {
    if (!modalDocument) return;
    const state = uploadStates[modalDocument.id];
    if (!state || !state.file) {
      alert('Por favor, selecione um arquivo antes de enviar a correção.');
      return;
    }
    
    setShowCorrectionModal(false);
    await uploadCorrection(modalDocument, state.file);
    setModalDocument(null);
  };

  const handleDownload = async (doc: Document) => {
    try {
      const urlToDownload = doc.translated_file_url || doc.file_url;
      if (!urlToDownload) {
        alert('No document available to download.');
        return;
      }
      
      const { extractFilePathFromUrl } = await import('../../../utils/fileUtils');
      const pathInfo = extractFilePathFromUrl(urlToDownload);
      
      if (!pathInfo) {
        try {
          const response = await fetch(urlToDownload);
          if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = doc.filename ? String(doc.filename) : 'document.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            return;
          }
        } catch (error) {
          alert('Não foi possível acessar o arquivo. Verifique sua conexão.');
          return;
        }
      }
      
      const { db } = await import('../../../lib/supabase');
      const filename = doc.filename ? String(doc.filename) : 'document.pdf';
      const success = await db.downloadFileAndTrigger(pathInfo.filePath, filename, pathInfo.bucket);
      
      if (!success) {
        alert('Não foi possível baixar o arquivo. Por favor, tente novamente.');
      }
    } catch (err) {
      console.error('Error downloading file:', err);
      alert((err as Error).message || 'Failed to download file.');
    }
  };

  const showApprovalConfirmation = (id: string) => {
    const document = documents.find(doc => doc.id === id);
    if (!document) return;
    setModalDocument(document);
    setShowApprovalModal(true);
  };

  const handleViewClick = async (doc: Document) => {
    try {
      const urlToView = doc.translated_file_url || doc.file_url;
      if (!urlToView) {
        alert('No document available to view.');
        return;
      }
      
      const { db } = await import('../../../lib/supabase');
      const viewUrl = await db.generateViewUrl(urlToView);
      
      if (viewUrl) {
        window.open(viewUrl, '_blank', 'noopener,noreferrer');
      } else {
        alert('Não foi possível gerar link para visualização. Por favor, tente novamente.');
      }
    } catch (error) {
      console.error('Error opening document:', error);
      alert((error as Error).message || 'Failed to open document. The file may be corrupted or inaccessible.');
    }
  };

  const showSendCorrectionConfirmation = (doc: Document) => {
    setModalDocument(doc);
    setShowCorrectionModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-4 sm:py-8 px-3 sm:px-6">
        <AuthenticatorHeader />
        <StatsCards pending={stats.pending} approved={stats.approved} />

        {/* Documents Table */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4 sm:mb-6 flex items-center gap-3">
            <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-tfe-blue-700" /> Documents to Authenticate
          </h2>
          
          <AuthenticationInstructions />
          
          {loading && <p className="text-tfe-blue-700 text-base sm:text-lg">Loading documents...</p>}
          {error && <p className="text-tfe-red-500 text-base sm:text-lg">Error: {error}</p>}
          
          {/* Mobile Cards View */}
          <DocumentTableMobile
            documents={paginatedItems}
            uploadStates={uploadStates}
            rejectedRows={rejectedRows}
            onView={handleViewClick}
            onDownload={handleDownload}
            onApprove={showApprovalConfirmation}
            onReject={handleReject}
            onCorrectionUpload={showSendCorrectionConfirmation}
            onFileSelect={setUploadState}
            onViewUser={handleViewUser}
          />

          {/* Desktop Table View */}
          <DocumentTableDesktop
            documents={paginatedItems}
            uploadStates={uploadStates}
            rejectedRows={rejectedRows}
            onView={openPreview}
            onDownload={handleDownload}
            onApprove={showApprovalConfirmation}
            onReject={handleReject}
            onCorrectionUpload={showSendCorrectionConfirmation}
            onFileSelect={setUploadState}
            onViewUser={handleViewUser}
          />

          {documents.length === 0 && !loading && (
            <p className="mt-8 text-gray-500 text-center text-base sm:text-lg">
              No pending documents for authentication.
            </p>
          )}
          
          {/* Pagination */}
          {documents.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              startIndex={startIndex}
              endIndex={endIndex}
              totalItems={documents.length}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <ApprovalModal
        isOpen={showApprovalModal}
        documentName={modalDocument?.filename || ''}
        onConfirm={handleApproveConfirm}
        onCancel={() => {
          setShowApprovalModal(false);
          setModalDocument(null);
        }}
      />

      <CorrectionModal
        isOpen={showCorrectionModal}
        documentName={modalDocument?.filename || ''}
        onConfirm={handleCorrectionUploadConfirm}
        onCancel={() => {
          setShowCorrectionModal(false);
          setModalDocument(null);
        }}
      />

      <UserInfoModal
        isOpen={userModalOpen}
        userId={viewingUserId}
        onClose={() => {
          closeUserModal();
          setViewingUserId(null);
        }}
      />

      <DocumentPreviewModal
        isOpen={previewOpen}
        document={previewDocument}
        previewUrl={previewUrl}
        previewType={previewType}
        previewLoading={previewLoading}
        previewError={previewError}
        onClose={closePreview}
        onDownload={downloadPreview}
      />
    </div>
  );
}
