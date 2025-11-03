import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { FileText, Download, Eye, Calendar, DollarSign, User, CheckCircle, XCircle, Filter } from 'lucide-react';
import { getValidFileUrl } from '../../utils/fileUtils';
import { GoogleStyleDatePicker } from '../../components/GoogleStyleDatePicker';
import { DateRange } from '../../components/DateRangeFilter';

interface TranslatedDocument {
  id: string;
  original_document_id: string;
  user_id: string;
  filename: string;
  translated_file_url: string;
  source_language: string;
  target_language: string;
  pages: number | null;
  status: string;
  total_cost: number | null;
  verification_code: string;
  is_authenticated: boolean;
  upload_date: string;
  created_at: string | null;
  updated_at: string | null;
  // Campos de auditoria
  authenticated_by?: string | null;
  authenticated_by_name?: string | null;
  authenticated_by_email?: string | null;
  authentication_date?: string | null;
  // Dados do usuário
  user_name?: string | null;
  user_email?: string | null;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function TranslatedDocuments() {
  const { user, loading: authLoading } = useAuth();
  const [documents, setDocuments] = useState<TranslatedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  // Modal de preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('all');
  const [dateFilter, setDateFilter] = useState<DateRange>({
    startDate: null,
    endDate: null,
    preset: 'all'
  });
  
  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const documentsPerPage = 10;

  useEffect(() => {
    async function fetchTranslatedDocuments() {
      if (!user) return;
      
      setLoading(true);
      setError(null);
      try {
        console.log('[TranslatedDocuments] Fetching documents for authenticator:', user.id);
        
        // Se for admin, mostra todos os documentos. Se for authenticator, mostra apenas os que ele autenticou
        let query = supabase
          .from('translated_documents')
          .select(`
            *,
            profiles:user_id (
              name,
              email
            )
          `);
        
        // Se não for admin, filtra apenas os documentos autenticados pelo usuário atual
        if (user.role !== 'admin') {
          query = query.eq('authenticated_by', user.id);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
        
        if (error) {
          console.error('[TranslatedDocuments] Error fetching documents:', error);
          setError(error.message);
        } else {
          const documentsWithUserData = (data as any[] || []).map(doc => ({
            ...doc,
            user_name: doc.profiles?.name || null,
            user_email: doc.profiles?.email || null
          })) as TranslatedDocument[];
          setDocuments(documentsWithUserData);
          console.log('[TranslatedDocuments] Found documents:', documentsWithUserData.length);
        }
      } catch (err) {
        console.error('[TranslatedDocuments] Unexpected error:', err);
        setError('Unexpected error while fetching documents.');
      } finally {
        setLoading(false);
      }
    }
    fetchTranslatedDocuments();
  }, [user]);

  async function handleViewUser(userId: string) {
    setUserLoading(true);
    setUserError(null);
    setSelectedUser(null);
    setUserModalOpen(true);
    try {
      const { data: user, error } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .eq('id', userId)
        .single();
      if (error || !user) {
        setUserError('Erro ao buscar informações do usuário.');
      } else {
        setSelectedUser(user);
      }
    } catch (err) {
      setUserError('Erro inesperado ao buscar usuário.');
    } finally {
      setUserLoading(false);
    }
  }

  // Aplicar filtros
  const filteredDocuments = useMemo(() => {
    let filtered = documents;

    // Filtro de busca
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(doc => 
        doc.filename.toLowerCase().includes(searchLower) ||
        doc.user_name?.toLowerCase().includes(searchLower) ||
        doc.user_email?.toLowerCase().includes(searchLower) ||
        doc.verification_code.toLowerCase().includes(searchLower) ||
        doc.authenticated_by_name?.toLowerCase().includes(searchLower) ||
        doc.authenticated_by_email?.toLowerCase().includes(searchLower)
      );
    }


    // Filtro de idioma
    if (filterLanguage !== 'all') {
      filtered = filtered.filter(doc => {
        const languagePair = `${doc.source_language} → ${doc.target_language}`;
        return languagePair.toLowerCase().includes(filterLanguage.toLowerCase());
      });
    }

    // Filtro de data
    if (dateFilter.startDate || dateFilter.endDate) {
      filtered = filtered.filter(doc => {
        if (!doc.created_at) return false;
        
        const docDate = new Date(doc.created_at);
        const startDate = dateFilter.startDate;
        const endDate = dateFilter.endDate;
        
        if (startDate && docDate < startDate) return false;
        if (endDate && docDate > endDate) return false;
        
        return true;
      });
    }

    return filtered;
  }, [documents, searchTerm, filterLanguage, dateFilter]);

  // Summary cards (usando documentos filtrados)
  const totalDocuments = filteredDocuments.length;
  const totalValue = filteredDocuments.reduce((sum, doc) => sum + (doc.total_cost || 0), 0);
  const totalPages = filteredDocuments.reduce((sum, doc) => sum + (doc.pages || 0), 0);

  // Paginação
  const totalPagesForPagination = Math.ceil(filteredDocuments.length / documentsPerPage);
  const startIndex = (currentPage - 1) * documentsPerPage;
  const endIndex = startIndex + documentsPerPage;
  const currentDocuments = filteredDocuments.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterLanguage, dateFilter]);

  // Verificar se está carregando ou se não há usuário
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-tfe-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-tfe-red-600">You need to be logged in to access this page.</p>
        </div>
      </div>
    );
  }

  async function openPreview(doc: TranslatedDocument) {
    try {
      setPreviewLoading(true);
      setPreviewError(null);
      if (!doc.translated_file_url) {
        setPreviewError('No PDF file available to view.');
        setPreviewOpen(true);
        return;
      }
      // SEMPRE gerar um novo signed URL para visualização
      const { db } = await import('../../lib/supabase');
      const viewUrl = await db.generateViewUrl(doc.translated_file_url);
      
      if (!viewUrl) {
        throw new Error('Não foi possível gerar link para visualização. Verifique se você está autenticado.');
      }
      
      setPreviewUrl(viewUrl);
      setPreviewOpen(true);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to open document.');
      setPreviewOpen(true);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function downloadPreview(filename?: string) {
    if (!previewUrl) return;
    try {
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || 'translated_document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      window.open(previewUrl, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-4 sm:py-8 px-3 sm:px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mb-6 sm:mb-8 p-4 sm:p-6 bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100">
          <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 text-green-600" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">Translated Documents</h1>
            <p className="text-sm sm:text-base text-gray-600">
              {user?.role === 'admin' 
                ? 'View all documents that have been translated and sent to clients.' 
                : 'View documents that you have authenticated and sent to clients.'
              }
            </p>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm p-4 sm:p-6 border border-gray-100 flex items-center gap-3 sm:gap-4 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-tfe-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-tfe-blue-950" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">{totalDocuments}</div>
              <div className="text-xs sm:text-sm text-gray-600 font-medium">Total Documents</div>
            </div>
          </div>
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm p-4 sm:p-6 border border-gray-100 flex items-center gap-3 sm:gap-4 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-green-900" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">${totalValue.toFixed(2)}</div>
              <div className="text-xs sm:text-sm text-gray-600 font-medium">Total Value</div>
            </div>
          </div>
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm p-4 sm:p-6 border border-gray-100 flex items-center gap-3 sm:gap-4 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-purple-900" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">{totalPages}</div>
              <div className="text-xs sm:text-sm text-gray-600 font-medium">Total Pages</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <input
                type="text"
                placeholder="Search by name, email, filename, code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                aria-label="Search documents"
              />
            </div>

            {/* Language Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-400 hidden sm:block" aria-hidden="true" />
              <select
                value={filterLanguage}
                onChange={(e) => setFilterLanguage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                aria-label="Filter by language"
              >
                <option value="all">All Languages</option>
                <option value="portuguese">Portuguese</option>
                <option value="english">English</option>
                <option value="spanish">Spanish</option>
                <option value="german">German</option>
                <option value="french">French</option>
              </select>
            </div>

            {/* Date Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-400 hidden sm:block" aria-hidden="true" />
              <GoogleStyleDatePicker
                dateRange={dateFilter}
                onDateRangeChange={setDateFilter}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Documents Table */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-tfe-blue-700" /> Translated Documents History
          </h2>
          {loading && <p className="text-tfe-blue-700 text-base sm:text-lg">Loading documents...</p>}
          {error && <p className="text-tfe-red-500 text-base sm:text-lg">Error: {error}</p>}
          
          {/* Mobile Cards View */}
          <div className="block sm:hidden space-y-4">
            {currentDocuments.map(doc => (
              <div key={doc.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="space-y-3">
                  {/* Document Name */}
                  <div>
                    <span className="text-gray-900 font-medium text-sm">
                      {doc.filename}
                    </span>
                  </div>



                  {/* Document Details */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="font-medium text-gray-600">Value:</span>
                      <span className="ml-1">${doc.total_cost?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Pages:</span>
                      <span className="ml-1">{doc.pages}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Language:</span>
                      <span className="ml-1">{doc.source_language} → {doc.target_language}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Status:</span>
                      <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-medium ${doc.is_authenticated ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {doc.is_authenticated ? 'Authenticated' : 'Pending'}
                      </span>
                    </div>
                  </div>

                  {/* Client Info */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 truncate max-w-32" title={doc.user_name || doc.user_id}>
                        {doc.user_name || `${doc.user_id.slice(0, 8)}...`}
                      </span>
                      <button
                        className="text-tfe-blue-600 hover:text-tfe-blue-950 p-1 rounded hover:bg-tfe-blue-50 transition-colors"
                        title="View user information"
                        onClick={() => handleViewUser(doc.user_id)}
                      >
                        <User className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="text-xs text-gray-500">
                      {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : '-'}
                    </span>
                  </div>

                  {/* Authentication Info */}
                  {doc.authenticated_by_name && (
                    <div className="pt-2 border-t border-gray-200">
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <CheckCircle className="w-3 h-3 text-green-600" />
                        <span>Authenticated by {doc.authenticated_by_name}</span>
                      </div>
                      {doc.authentication_date && (
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(doc.authentication_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full bg-white border rounded-lg shadow">
              <thead className="bg-tfe-blue-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Document</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Actions</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Client</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Value</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Language</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Details</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Authenticated By</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Sent Date</th>
                </tr>
              </thead>
              <tbody>
                {currentDocuments.map(doc => {
                  return (
                    <tr key={doc.id} className="border-t hover:bg-tfe-blue-50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <span className="text-gray-900 font-medium text-sm">
                            {doc.filename}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openPreview(doc)}
                            className="flex items-center gap-1 bg-tfe-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-tfe-blue-700 transition-colors font-medium"
                            title="View PDF"
                          >
                            <FileText className="w-3 h-3" /> View
                          </button>
                          <button
                            className="flex items-center gap-1 bg-emerald-600 text-white px-2 py-1 rounded text-xs hover:bg-emerald-700 transition-colors font-medium"
                            onClick={async e => {
                              e.preventDefault();
                              try {
                                const validUrl = await getValidFileUrl(doc.translated_file_url || '');
                                const response = await fetch(validUrl);
                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = doc.filename || 'translated_document.pdf';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                window.URL.revokeObjectURL(url);
                              } catch (err) {
                                console.error('Error downloading file:', err);
                                alert((err as Error).message || 'Failed to download file.');
                              }
                            }}
                            title="Download PDF"
                          >
                            <Download className="w-3 h-3" /> Download
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 truncate max-w-32" title={doc.user_name || doc.user_id}>
                            {doc.user_name || `${doc.user_id.slice(0, 8)}...`}
                          </span>
                          <button
                            className="text-tfe-blue-600 hover:text-tfe-blue-950 p-1 rounded hover:bg-tfe-blue-50 transition-colors"
                            title="View user information"
                            onClick={() => handleViewUser(doc.user_id)}
                          >
                            <User className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-sm">
                        ${doc.total_cost?.toFixed(2) || '0.00'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {doc.source_language} → {doc.target_language}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Pages:</span>
                            <span>{doc.pages}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Status:</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${doc.is_authenticated ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                              {doc.is_authenticated ? 'Authenticated' : 'Pending'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Code:</span>
                            <span className="font-mono">{doc.verification_code}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {doc.authenticated_by_name ? (
                          <div>
                            <div className="font-medium text-gray-900">{doc.authenticated_by_name}</div>
                            <div className="text-xs text-gray-500">{doc.authenticated_by_email}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">Not authenticated</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredDocuments.length === 0 && !loading && (
            <p className="mt-8 text-gray-500 text-center text-base sm:text-lg">
              {documents.length === 0 
                ? 'No translated documents found.' 
                : 'No documents found matching your filters.'
              }
            </p>
          )}
          
          {/* Controles de Paginação */}
          {filteredDocuments.length > 0 && (
            <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="text-sm text-gray-700 text-center sm:text-left">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredDocuments.length)} of {filteredDocuments.length} documents
              </div>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPagesForPagination }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        currentPage === page
                          ? 'bg-tfe-blue-600 text-white'
                          : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPagesForPagination}
                  className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de informações do usuário */}
      {userModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-8 w-full max-w-md sm:min-w-[400px] relative animate-fade-in">
            <button
              className="absolute top-2 sm:top-4 right-2 sm:right-4 text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setUserModalOpen(false)}
              aria-label="Close modal"
            >
              <XCircle className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <h3 className="text-xl font-bold mb-6 text-gray-900">Client Information</h3>
            {userLoading && <p className="text-tfe-blue-700 text-lg">Loading...</p>}
            {userError && <p className="text-tfe-red-500 text-lg">{userError}</p>}
            {selectedUser && (
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="font-medium text-gray-700">Name:</span>
                  <span className="text-gray-900">{selectedUser.name}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="font-medium text-gray-700">Email:</span>
                  <span className="text-gray-900">{selectedUser.email}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="font-medium text-gray-700">Role:</span>
                  <span className="text-gray-900">{selectedUser.role}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="font-medium text-gray-700">ID:</span>
                  <span className="text-gray-900 font-mono text-sm">{selectedUser.id}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Visualização de Documento (tela cheia) */}
      {previewOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[10000]">
          <div className="absolute inset-0 bg-white flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-tfe-blue-600" />
                <span className="font-semibold text-gray-900">Document preview</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
                  disabled={previewLoading || !previewUrl}
                  onClick={() => downloadPreview('translated_document.pdf')}
                >
                  Download
                </button>
                <button
                  className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
                  onClick={() => setPreviewOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-50 overflow-hidden">
              {previewLoading && (
                <div className="flex items-center justify-center h-full text-gray-600">Loading...</div>
              )}
              {!previewLoading && previewError && (
                <div className="p-6 text-center text-tfe-red-600">{previewError}</div>
              )}
              {!previewLoading && !previewError && previewUrl && (
                <iframe src={previewUrl} className="w-full h-full border-0" title="Document" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 