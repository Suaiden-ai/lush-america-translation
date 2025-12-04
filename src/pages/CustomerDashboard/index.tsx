import React, { useEffect, useRef, useState } from 'react';
import { WelcomeSection } from './WelcomeSection';
import { CustomerStatsCards } from './CustomerStatsCards';
import { RecentActivity } from './RecentActivity';
import { QuickActions } from './QuickActions';
import { DocumentUploadModal } from './DocumentUploadModal';
import { DocumentsList } from './DocumentsList';
import { DocumentDetailsModal } from './DocumentDetailsModal';
import { Chatbot } from '../../components/Chatbot';
import { DocumentUploadRetry } from '../../components/DocumentUploadRetry/DocumentUploadRetry';
// import { DocumentManager } from './DocumentManager';
import { Document, Folder } from '../../App';
import { Database } from '../../lib/database.types';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import ProfilePage from './ProfilePage';
import { CheckCircle, Home } from 'lucide-react';
import UploadDocument from './UploadDocument';
import { CustomUser } from '../../hooks/useAuth';
import { useI18n } from '../../contexts/I18nContext';
type Page = 'home' | 'translations' | 'dashboard-customer' | 'admin' | 'verify' | 'login' | 'register' | 'documents';

type DocumentInsert = Database['public']['Tables']['documents']['Insert'];
type FolderInsert = Database['public']['Tables']['folders']['Insert'];

interface CustomerDashboardProps {
  user: CustomUser | null;
  documents: Document[];
  folders: Folder[];
  onDocumentUpload: (document: Omit<DocumentInsert, 'user_id'>) => void;
  onFolderCreate: (folder: Omit<FolderInsert, 'user_id'>) => void;
  onFolderUpdate: (folderId: string, updates: Partial<Folder>) => void;
  onFolderDelete: (folderId: string) => void;
  onViewDocument: (document: Document) => void;
}

export function CustomerDashboard({ 
  user, 
  documents, 
  folders, 
  onDocumentUpload, 
  onFolderCreate, 
  onFolderUpdate, 
  onFolderDelete,
  onViewDocument
}: CustomerDashboardProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

  console.log('[CustomerDashboard] Renderizando dashboard do usuário');
  console.log('[CustomerDashboard] User:', user);
  console.log('[CustomerDashboard] Documents count:', documents.length);

  // Toast de novo documento traduzido
  const [showToast, setShowToast] = useState(false);
  const [newCompletedDoc, setNewCompletedDoc] = useState<Document | null>(null);
  const prevCompletedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Detectar novos documentos completed
    const completedDocs = documents.filter(doc => doc.status === 'completed');
    const completedIds = new Set(completedDocs.map(doc => doc.id));
    // Verifica se há algum novo completed
    for (const doc of completedDocs) {
      if (!prevCompletedIds.current.has(doc.id)) {
        setNewCompletedDoc(doc);
        setShowToast(true);
        break;
      }
    }
    prevCompletedIds.current = completedIds;
  }, [documents]);

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const hasCompletedDocuments = documents.some(doc => doc.status === 'completed');

  const handleUploadClick = () => {
    navigate('/dashboard/upload');
  };

  const handleCloseUploadModal = () => {
    setIsUploadModalOpen(false);
  };

  const handleViewDocument = (document: Document) => {
    setSelectedDocument(document);
  };

  const handleCloseDetailsModal = () => {
    setSelectedDocument(null);
  };

  const handleDocumentUpload = async (doc: any) => {
    console.log('DEBUG: [onDocumentUpload] chamado com:', JSON.stringify(doc, null, 2));
    await onDocumentUpload(doc);
  };

  return (
    <div className="relative">
      {/* Toast/banner de novo documento traduzido */}
      {showToast && newCompletedDoc && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-green-50 border border-green-200 rounded-xl shadow-lg flex items-center px-6 py-4 gap-4 animate-fade-in-up min-w-[320px] max-w-[90vw]">
          <CheckCircle className="w-7 h-7 text-green-600" />
          <div className="flex-1">
            <div className="font-semibold text-green-900 text-base mb-1">{t('dashboard.notifications.translationReady')}</div>
            <div className="text-green-800 text-sm truncate">{newCompletedDoc.filename}</div>
          </div>
          <button
            className="ml-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
            onClick={() => {
              setShowToast(false);
              onViewDocument(newCompletedDoc);
            }}
          >
            {t('dashboard.notifications.download')}
          </button>
          <button
            className="ml-2 text-green-700 hover:text-green-900 text-xl font-bold"
            onClick={() => setShowToast(false)}
            aria-label={t('dashboard.notifications.close')}
          >
            ×
          </button>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-8">
        {/* Alerta de documentos com upload pendente */}
        <DocumentUploadRetry userId={user?.id} />
        
        {/* Dashboard principal - sempre renderiza o overview */}
        <WelcomeSection user={user} onUploadClick={handleUploadClick} />
        <CustomerStatsCards documents={documents} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2">
            <RecentActivity 
              documents={documents} 
              onViewDocument={handleViewDocument} 
            />
          </div>
          <div>
            <QuickActions 
              onUploadClick={handleUploadClick}
              hasCompletedDocuments={hasCompletedDocuments}
            />
          </div>
        </div>
        
        {/* Modais */}
        <DocumentUploadModal
          isOpen={isUploadModalOpen}
          onClose={handleCloseUploadModal}
          onUpload={onDocumentUpload}
          userId={user?.id || ''}
          userEmail={user?.email || ''} // Adicionar email do usuário
          userName={user?.name || ''} // Adicionar nome do usuário
        />
        <DocumentDetailsModal
          document={selectedDocument}
          onClose={handleCloseDetailsModal}
        />
      </div>
      <Chatbot />
    </div>
  );
}