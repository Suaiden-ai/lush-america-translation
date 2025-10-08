import React, { useState, useEffect } from 'react';
import { FileText, User, Calendar, Clock, CheckCircle, XCircle, Eye, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface DocumentToAuthenticate {
  id: string;
  filename: string;
  user_id: string;
  user_name: string;
  user_email: string;
  pages: number;
  status: string;
  total_cost: number;
  created_at: string;
  is_authenticated: boolean;
  authenticated_by?: string;
  authenticated_at?: string;
  verification_code?: string;
  file_id?: string;
  is_bank_statement?: boolean;
  source_language?: string;
  target_language?: string;
  translation_status?: string;
}

export function DocumentsToAuthenticateTable() {
  const [documents, setDocuments] = useState<DocumentToAuthenticate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentToAuthenticate | null>(null);

  // Buscar documentos para autenticação
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      
      // Buscar documentos para autenticação
      const { data: documentsData, error: documentsError } = await supabase
        .from('documents_to_be_verified')
        .select('*')
        .order('created_at', { ascending: false });

      if (documentsError) throw documentsError;

      // Buscar status de pagamentos para filtrar documentos refunded/cancelled
      // Primeiro, buscar todos os pagamentos para encontrar correspondências
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('document_id, status, user_id, amount');
      
      if (paymentsError) {
        console.warn('[DocumentsToAuthenticateTable] Erro ao buscar pagamentos:', paymentsError);
      }
      
      console.log('[DocumentsToAuthenticateTable] Pagamentos encontrados:', paymentsData?.length || 0);
      
      // Criar mapa de status de pagamentos
      // Mapear por document_id primeiro, depois por user_id + amount se necessário
      const paymentStatusMap = new Map<string, string>();
      paymentsData?.forEach(payment => {
        if (payment.document_id) {
          paymentStatusMap.set(payment.document_id, payment.status);
        }
      });
      
      // Para documentos sem document_id direto, tentar mapear por user_id + amount
      const documentsWithoutDirectPayment = (documentsData || []).filter(doc => {
        const directPayment = paymentStatusMap.get(doc.id);
        return !directPayment;
      });
      
      console.log('[DocumentsToAuthenticateTable] Documentos sem pagamento direto:', documentsWithoutDirectPayment.length);
      
      // Mapear por user_id + amount para documentos sem document_id direto
      documentsWithoutDirectPayment.forEach(doc => {
        const matchingPayment = paymentsData?.find(payment => 
          payment.user_id === doc.user_id && 
          payment.amount === doc.valor
        );
        
        if (matchingPayment) {
          paymentStatusMap.set(doc.id, matchingPayment.status);
          console.log('[DocumentsToAuthenticateTable] Mapeamento por user_id + amount:', {
            doc_id: doc.id,
            user_id: doc.user_id,
            amount: doc.valor,
            payment_status: matchingPayment.status
          });
        }
      });
      
      // Filtrar documentos que NÃO têm status refunded ou cancelled
      const validDocuments = (documentsData || []).filter(doc => {
        const paymentStatus = paymentStatusMap.get(doc.id);
        const shouldExclude = paymentStatus === 'refunded' || paymentStatus === 'cancelled';
        
        if (shouldExclude) {
          console.log('[DocumentsToAuthenticateTable] Excluindo documento:', {
            id: doc.id,
            filename: doc.filename,
            payment_status: paymentStatus
          });
        }
        
        return !shouldExclude;
      });
      
      console.log('[DocumentsToAuthenticateTable] Documentos válidos (após filtro de pagamento):', validDocuments.length);
      console.log('[DocumentsToAuthenticateTable] Documentos filtrados (refunded/cancelled):', (documentsData || []).length - validDocuments.length);

      // Buscar perfis dos usuários
      const userIds = [...new Set(validDocuments?.map(doc => doc.user_id) || [])];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Criar um mapa de perfis por ID
      const profilesMap = new Map(profilesData?.map(profile => [profile.id, profile]) || []);

      // Processar dados para incluir nomes dos usuários
      const processedDocuments = validDocuments.map(doc => {
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
      console.error('Error fetching documents:', err);
      setError('Failed to fetch documents');
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
    return matchesSearch && matchesStatus;
  });

  // Estatísticas
  const totalDocuments = documents.length;
  const pendingDocuments = documents.filter(doc => doc.status === 'pending').length;
  const processingDocuments = documents.filter(doc => doc.status === 'processing').length;
  const completedDocuments = documents.filter(doc => doc.status === 'completed').length;
  const rejectedDocuments = documents.filter(doc => doc.status === 'rejected').length;

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
      case 'pending': return <Clock className="w-4 h-4" />;
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
            <h2 className="text-lg font-semibold text-gray-900">Documents to Authenticate</h2>
            <p className="text-sm text-gray-600">All documents waiting for authentication</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div className="text-xl sm:text-2xl font-bold text-red-600">{rejectedDocuments}</div>
            <div className="text-xs sm:text-sm text-gray-600">Rejected</div>
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
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/8">Status</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">Authenticator</th>
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
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}>
                    {getStatusIcon(doc.status)}
                    <span className="ml-1 truncate">{doc.status}</span>
                  </span>
                </td>
                <td className="px-3 py-4">
                  {doc.authenticated_by ? (
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-gray-900 truncate" title={doc.authenticated_by}>
                        ID: {doc.authenticated_by.substring(0, 8)}...
                      </div>
                      <div className="text-xs text-gray-500">
                        {doc.authenticated_at ? new Date(doc.authenticated_at).toLocaleDateString('pt-BR') : 'N/A'}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500">Not assigned</span>
                  )}
                </td>
                <td className="px-3 py-4 text-sm font-medium">
                  <button
                    onClick={() => setSelectedDocument(doc)}
                    className="text-tfe-blue-600 hover:text-tfe-blue-900 flex items-center p-1 rounded hover:bg-blue-50"
                    title="View document details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
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
                
                {/* Status and Authenticator */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-xs">
                    <span className="font-medium text-gray-700">Status:</span>
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}>
                        {getStatusIcon(doc.status)}
                        <span className="ml-1 truncate">{doc.status}</span>
                      </span>
                    </div>
                  </div>
                  <div className="text-xs">
                    <span className="font-medium text-gray-700">Authenticator:</span>
                    <div className="text-gray-900 mt-1">
                      {doc.authenticated_by ? (
                        <>
                          <div className="truncate" title={doc.authenticated_by}>
                            ID: {doc.authenticated_by.substring(0, 8)}...
                          </div>
                          <div className="text-gray-500">
                            {doc.authenticated_at ? new Date(doc.authenticated_at).toLocaleDateString('pt-BR') : 'N/A'}
                          </div>
                        </>
                      ) : (
                        <span className="text-gray-500">Not assigned</span>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex justify-end">
                  <button
                    onClick={() => setSelectedDocument(doc)}
                    className="text-tfe-blue-600 hover:text-tfe-blue-900 flex items-center p-2 rounded hover:bg-blue-50"
                    title="View document details"
                  >
                    <Eye className="w-4 h-4" />
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
          <h3 className="mt-2 text-sm font-medium text-gray-900">No documents found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'No documents are currently waiting for authentication.'
            }
          </p>
        </div>
      )}
    </div>
  );
}