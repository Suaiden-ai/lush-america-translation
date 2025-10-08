import React, { useState, useEffect } from 'react';
import { FileText, User, Calendar, CheckCircle, Eye, Search, Filter, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface TranslatedDocument {
  id: string;
  filename: string;
  user_id: string;
  user_name: string;
  user_email: string;
  pages: number;
  status: string;
  total_cost: number;
  source_language: string;
  target_language: string;
  translated_file_url: string;
  created_at: string;
  is_authenticated: boolean;
  verification_code: string;
  original_document_id?: string;
  folder_id?: string;
  upload_date?: string;
}

export function TranslatedDocumentsTable() {
  const [documents, setDocuments] = useState<TranslatedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Buscar documentos traduzidos
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      
      // Buscar documentos traduzidos
      const { data: documentsData, error: documentsError } = await supabase
        .from('translated_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (documentsError) throw documentsError;

      // Buscar perfis dos usuários
      const userIds = [...new Set(documentsData?.map(doc => doc.user_id) || [])];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Criar um mapa de perfis por ID
      const profilesMap = new Map(profilesData?.map(profile => [profile.id, profile]) || []);

      // Processar dados para incluir nomes dos usuários
      const processedDocuments = (documentsData || []).map(doc => {
        const profile = profilesMap.get(doc.user_id);
        return {
          ...doc,
          user_name: profile?.name || 'N/A',
          user_email: profile?.email || 'N/A'
        };
      });

      setDocuments(processedDocuments);
      setError(null);
    } catch (err) {
      console.error('Error fetching translated documents:', err);
      setError('Failed to fetch translated documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Filtrar documentos
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.user_email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    const matchesLanguage = languageFilter === 'all' || 
                           doc.source_language.toLowerCase().includes(languageFilter.toLowerCase()) ||
                           doc.target_language.toLowerCase().includes(languageFilter.toLowerCase());
    return matchesSearch && matchesStatus && matchesLanguage;
  });

  // Estatísticas
  const totalDocuments = documents.length;
  const pendingDocuments = documents.filter(doc => doc.status === 'pending').length;
  const processingDocuments = documents.filter(doc => doc.status === 'processing').length;
  const completedDocuments = documents.filter(doc => doc.status === 'completed').length;
  const authenticatedDocuments = documents.filter(doc => doc.is_authenticated).length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <FileText className="w-4 h-4" />;
      case 'processing': return <FileText className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tfe-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">{error}</div>
        <button
          onClick={fetchDocuments}
          className="px-4 py-2 bg-tfe-blue-600 text-white rounded-lg hover:bg-tfe-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Translated Documents</h2>
            <p className="text-sm text-gray-600">All completed and translated documents</p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg"
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                placeholder="Search by filename, user name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tfe-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tfe-blue-500 focus:border-transparent text-sm"
                aria-label="Filter by status"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
              <input
                type="text"
                placeholder="Filter by language..."
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tfe-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="text-center p-3 bg-white rounded-lg border border-gray-200">
            <div className="text-xl sm:text-2xl font-bold text-gray-900">{totalDocuments}</div>
            <div className="text-xs sm:text-sm text-gray-600">Total</div>
          </div>
          <div className="text-center p-3 bg-white rounded-lg border border-gray-200">
            <div className="text-xl sm:text-2xl font-bold text-yellow-600">{pendingDocuments}</div>
            <div className="text-xs sm:text-sm text-gray-600">Pending</div>
          </div>
          <div className="text-center p-3 bg-white rounded-lg border border-gray-200">
            <div className="text-xl sm:text-2xl font-bold text-blue-600">{processingDocuments}</div>
            <div className="text-xs sm:text-sm text-gray-600">Processing</div>
          </div>
          <div className="text-center p-3 bg-white rounded-lg border border-gray-200">
            <div className="text-xl sm:text-2xl font-bold text-green-600">{completedDocuments}</div>
            <div className="text-xs sm:text-sm text-gray-600">Completed</div>
          </div>
          <div className="text-center p-3 bg-white rounded-lg border border-gray-200 col-span-2 sm:col-span-1">
            <div className="text-xl sm:text-2xl font-bold text-purple-600">{authenticatedDocuments}</div>
            <div className="text-xs sm:text-sm text-gray-600">Authenticated</div>
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="overflow-x-auto hidden lg:block">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Document</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">User</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">Languages</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/8">Status</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">Code</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/8">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredDocuments.map((doc) => (
              <tr key={doc.id} className="hover:bg-gray-50">
                <td className="px-3 py-4">
                  <div className="flex items-center min-w-0">
                    <FileText className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 truncate" title={doc.filename}>
                        {doc.filename}
                      </div>
                      <div className="text-xs text-gray-500">
                        {doc.pages} pages • ${doc.total_cost}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate" title={doc.user_name}>
                      {doc.user_name}
                    </div>
                    <div className="text-xs text-gray-500 truncate" title={doc.user_email}>
                      {doc.user_email}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-4">
                  <div className="text-xs text-gray-900">
                    <div className="truncate" title={`${doc.source_language} → ${doc.target_language}`}>
                      {doc.source_language} → {doc.target_language}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-4">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}>
                    {getStatusIcon(doc.status)}
                    <span className="ml-1 truncate">{doc.status}</span>
                  </span>
                </td>
                <td className="px-3 py-4">
                  <div className="text-xs text-gray-900">
                    <div className="truncate font-mono" title={doc.verification_code}>
                      {doc.verification_code.substring(0, 8)}...
                    </div>
                  </div>
                </td>
                <td className="px-3 py-4 text-sm font-medium">
                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleDownload(doc.translated_file_url, doc.filename)}
                      className="text-green-600 hover:text-green-900 flex items-center p-1 rounded hover:bg-green-50"
                      title="Download translated document"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden">
        <div className="divide-y divide-gray-200">
          {filteredDocuments.map((doc) => (
            <div key={doc.id} className="p-3 sm:p-4 hover:bg-gray-50">
              <div className="flex flex-col gap-3">
                {/* Document Info */}
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 truncate" title={doc.filename}>
                      {doc.filename}
                    </h4>
                    <div className="text-xs text-gray-500 mt-1">
                      {doc.pages} pages • ${doc.total_cost}
                    </div>
                  </div>
                </div>
                
                {/* User Info */}
                <div className="flex items-start gap-3">
                  <User className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-900 truncate" title={doc.user_name}>
                      {doc.user_name}
                    </div>
                    <div className="text-xs text-gray-500 truncate" title={doc.user_email}>
                      {doc.user_email}
                    </div>
                  </div>
                </div>
                
                {/* Languages and Status */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-xs">
                    <span className="font-medium text-gray-700">Languages:</span>
                    <div className="text-gray-900 truncate mt-1" title={`${doc.source_language} → ${doc.target_language}`}>
                      {doc.source_language} → {doc.target_language}
                    </div>
                  </div>
                  <div className="text-xs">
                    <span className="font-medium text-gray-700">Status:</span>
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}>
                        {getStatusIcon(doc.status)}
                        <span className="ml-1 truncate">{doc.status}</span>
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Code and Actions */}
                <div className="flex items-center justify-between">
                  <div className="text-xs">
                    <span className="font-medium text-gray-700">Code:</span>
                    <div className="font-mono text-gray-900 mt-1" title={doc.verification_code}>
                      {doc.verification_code.substring(0, 8)}...
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload(doc.translated_file_url, doc.filename)}
                    className="text-green-600 hover:text-green-900 flex items-center p-2 rounded hover:bg-green-50"
                    title="Download translated document"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {filteredDocuments.length === 0 && (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No translated documents found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || statusFilter !== 'all' || languageFilter !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'No documents have been translated yet.'
            }
          </p>
        </div>
      )}
    </div>
  );
}