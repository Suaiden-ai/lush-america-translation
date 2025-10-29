import React, { useState, useEffect } from 'react';
import { Loader2, Trash2, Eye, AlertTriangle, CheckCircle } from 'lucide-react';

interface DocumentToCleanup {
  id: string;
  filename: string;
  file_url: string | null;
  user_id: string;
  created_at: string;
  reason: string;
  sessions: any[];
  payments: any[];
}

interface CleanupResponse {
  success: boolean;
  documentsToCleanup: DocumentToCleanup[];
  documentsToKeep: DocumentToCleanup[];
  totalToCleanup: number;
  totalToKeep: number;
  message: string;
}

export default function DraftCleanupApproval() {
  const [documents, setDocuments] = useState<DocumentToCleanup[]>([]);
  const [documentsToKeep, setDocumentsToKeep] = useState<DocumentToCleanup[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lastChecked, setLastChecked] = useState<string>('');
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchDocumentsForCleanup = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://yslbjhnqfkjdoxuixfyh.supabase.co/functions/v1/list-drafts-for-cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzbGJqaG5xZmtqZG94dWl4ZnloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2MjMwNzksImV4cCI6MjA3MTE5OTA3OX0.sAbOqC1qqG99B8v3QcbIxa2WaS9jfhlm3jYpjDysGK8`,
        },
      });

      const data: CleanupResponse = await response.json();

      if (data.success) {
        setDocuments(data.documentsToCleanup);
        setDocumentsToKeep(data.documentsToKeep);
        setLastChecked(new Date().toLocaleString());
        setSelectedDocuments([]);
        
        showNotification('success', `${data.totalToCleanup} documents safe for cleanup, ${data.totalToKeep} documents protected`);
      } else {
        showNotification('error', 'Failed to fetch documents for cleanup');
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      showNotification('error', 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDocuments(documents.map(doc => doc.id));
    } else {
      setSelectedDocuments([]);
    }
  };

  const handleSelectDocument = (documentId: string, checked: boolean) => {
    if (checked) {
      setSelectedDocuments(prev => [...prev, documentId]);
    } else {
      setSelectedDocuments(prev => prev.filter(id => id !== documentId));
    }
  };

  const handleApprovedCleanup = async () => {
    if (selectedDocuments.length === 0) {
      showNotification('error', 'Select at least one document to remove');
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch('https://yslbjhnqfkjdoxuixfyh.supabase.co/functions/v1/approved-cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzbGJqaG5xZmtqZG94dWl4ZnloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2MjMwNzksImV4cCI6MjA3MTE5OTA3OX0.sAbOqC1qqG99B8v3QcbIxa2WaS9jfhlm3jYpjDysGK8`,
        },
        body: JSON.stringify({ documentIds: selectedDocuments }),
      });

      const data = await response.json();

      if (data.success) {
        showNotification('success', `${data.deleted} documents removed successfully`);
        
        // Remover documentos deletados da lista
        setDocuments(prev => prev.filter(doc => !selectedDocuments.includes(doc.id)));
        setSelectedDocuments([]);
      } else {
        showNotification('error', data.error || 'Failed to remove documents');
      }
    } catch (error) {
      console.error('Error executing cleanup:', error);
      showNotification('error', 'Failed to connect to server');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getReasonBadge = (reason: string) => {
    const reasonMap: { [key: string]: { className: string, text: string } } = {
      'Sem sessão Stripe': { className: 'bg-gray-100 text-gray-800', text: 'No payment' },
      'Sessão Stripe expired': { className: 'bg-red-100 text-red-800', text: 'Session expired' },
      'Sessão Stripe failed': { className: 'bg-red-100 text-red-800', text: 'Payment failed' },
      'Sessão Stripe antiga (mais de 1 hora)': { className: 'bg-gray-100 text-gray-800', text: 'Old session' },
    };

    const config = reasonMap[reason] || { className: 'bg-blue-100 text-blue-800', text: reason };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
        {config.text}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-md ${
          notification.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <div className="flex">
            <div className="flex-shrink-0">
              {notification.type === 'success' ? (
                <CheckCircle className="h-5 w-5 text-green-400" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-400" />
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{notification.message}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Draft Documents Cleanup</h1>
          <p className="text-gray-600 mt-2">
            Review and approve draft documents that can be safely removed
          </p>
        </div>
        <button
          onClick={fetchDocumentsForCleanup}
          disabled={loading}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <Eye className="mr-2 h-4 w-4" />
              Check Documents
            </>
          )}
        </button>
      </div>

      {lastChecked && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-800">
                Last check: {lastChecked}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Documentos para Cleanup */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Documents Safe for Removal ({documents.length})
            </h3>
            <div className="mt-4 space-y-4">
              {documents.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No documents found for cleanup
                </p>
              ) : (
                <>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="select-all"
                      checked={selectedDocuments.length === documents.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="select-all" className="text-sm font-medium text-gray-700">
                      Select all ({selectedDocuments.length}/{documents.length})
                    </label>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {documents.map((doc) => (
                      <div key={doc.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                        <div className="flex items-start space-x-2">
                          <input
                            type="checkbox"
                            checked={selectedDocuments.includes(doc.id)}
                            onChange={(e) => handleSelectDocument(doc.id, e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{doc.filename}</p>
                            <p className="text-sm text-gray-500">
                              Created: {formatDate(doc.created_at)}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {getReasonBadge(doc.reason)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedDocuments.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <AlertTriangle className="h-5 w-5 text-yellow-400" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-yellow-800">
                            {selectedDocuments.length} document(s) selected for removal.
                            This action cannot be undone.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleApprovedCleanup}
                    disabled={selectedDocuments.length === 0 || deleting}
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Removing...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove Selected ({selectedDocuments.length})
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Documentos Protegidos */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Protected Documents ({documentsToKeep.length})
            </h3>
            <div className="mt-4">
              {documentsToKeep.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No protected documents found
                </p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {documentsToKeep.map((doc) => (
                    <div key={doc.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{doc.filename}</p>
                        <p className="text-sm text-gray-500">
                          Created: {formatDate(doc.created_at)}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {doc.reason}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}