import { useState, useEffect, useCallback, useMemo } from 'react';
import { FileText, Eye, Download, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Document } from '../../App';
import { DateRange } from '../../components/DateRangeFilter';
import { GoogleStyleDatePicker } from '../../components/GoogleStyleDatePicker';
import { formatDate } from '../../utils/dateUtils';
import { useI18n } from '../../contexts/I18nContext';

// Interface estendida para incluir dados de tabelas relacionadas
interface ExtendedDocument extends Omit<Document, 'client_name' | 'payment_method'> {
  user_name?: string;
  user_email?: string;
  user_phone?: string;
  document_type?: 'regular' | 'verified';
  authenticated_by_name?: string;
  authenticated_by_email?: string;
  authentication_date?: string;
  source_language?: string;
  target_language?: string;
  payment_method?: string | null;
  payment_status?: string | null;
  client_name?: string | null;
  display_name?: string | null; // Nome formatado para exibição na coluna USER/CLIENT
  user_role?: string | null; // Role do usuário para filtros
}

// Propriedades do componente
interface DocumentsTableProps {
  documents: Document[]; // Mantido para conformidade, embora os dados sejam buscados internamente
  onViewDocument: (document: Document) => void;
  dateRange?: DateRange;
  onDateRangeChange?: (dateRange: DateRange) => void;
}

export function DocumentsTable({ onViewDocument, dateRange, onDateRangeChange }: DocumentsTableProps) {
  const { t } = useI18n();
  const [extendedDocuments, setExtendedDocuments] = useState<ExtendedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [internalDateRange, setInternalDateRange] = useState<DateRange>(dateRange || {
    startDate: null,
    endDate: null,
    preset: 'all'
  });

  // ✅ Função simplificada com JOIN direto (reversão para query original)
  const loadExtendedDocuments = useCallback(async () => {
    setLoading(true);
    try {
      // Aplicar filtros de data se fornecidos
      let startDateParam = null;
      let endDateParam = null;
      
      if (internalDateRange?.startDate) {
        const startDate = new Date(internalDateRange.startDate);
        startDate.setHours(0, 0, 0, 0);
        startDateParam = startDate.toISOString();
      }
      
      if (internalDateRange?.endDate) {
        const endDate = new Date(internalDateRange.endDate);
        endDate.setHours(23, 59, 59, 999);
        endDateParam = endDate.toISOString();
      }

      // ✅ QUERY SIMPLIFICADA COM LÓGICA ORIGINAL DE PAGAMENTO
      let query = supabase
        .from('documents')
        .select(`
          *,
          profiles!documents_user_id_fkey(name, email, phone, role),
          payments!payments_document_id_fkey(payment_method, status, amount, currency)
        `)
        .order('created_at', { ascending: false });

      // Aplicar filtros de data
      if (startDateParam) {
        query = query.gte('created_at', startDateParam);
      }
      if (endDateParam) {
        query = query.lte('created_at', endDateParam);
      }

      const { data: documents, error } = await query;

      if (error) {
        console.error('Error loading documents:', error);
        return;
      }

      console.log('🔍 DEBUG - Documents loaded:', documents?.length || 0);
      console.log('🔍 DEBUG - Sample documents:', documents?.slice(0, 3));

      // Processar dados com lógica original de pagamento
      const processedDocuments = documents?.map(doc => {
        // Lógica original: usar payment_method do documento se não houver na tabela payments
        const paymentMethod = doc.payments?.[0]?.payment_method || doc.payment_method || null;
        const paymentStatus = doc.payments?.[0]?.status || 'pending';
        
        return {
          ...doc,
          user_name: doc.profiles?.name || null,
          user_email: doc.profiles?.email || null,
          user_phone: doc.profiles?.phone || null,
          user_role: doc.profiles?.role || 'user',
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          display_name: doc.profiles?.name || null,
          document_type: 'regular' as const,
          client_name: doc.client_name || null,
        };
      }) || [];

      console.log('🔍 DEBUG - Processed documents:', processedDocuments.length);
      setExtendedDocuments(processedDocuments);
    } catch (error) {
      console.error('Error loading extended documents:', error);
    } finally {
      setLoading(false);
    }
  }, [internalDateRange]);

  // Sincronizar dateRange externo com interno
  useEffect(() => {
    if (dateRange) {
      setInternalDateRange(dateRange);
    }
  }, [dateRange]);

  useEffect(() => {
    loadExtendedDocuments();
  }, [loadExtendedDocuments]);

  // Aplica os filtros de busca, status e role
  const filteredDocuments = useMemo(() => {
    const filtered = extendedDocuments.filter(doc => {
      // Filtro de busca textual
      const matchesSearch = searchTerm === '' ||
        doc.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.display_name?.toLowerCase().includes(searchTerm.toLowerCase());

      // Filtro de status
      const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;

      // Filtro de role - usar o role real do usuário
      let matchesRole = true;
      if (roleFilter !== 'all') {
        const userRole = doc.user_role || 'user'; // Default para 'user' se não tiver role
        
        // Debug log detalhado para todos os documentos quando filtro user está ativo
        if (roleFilter === 'user') {
          console.log(`[Role Filter Debug - USER] Document: ${doc.filename}, user_role: ${userRole}, matchesRole: ${userRole === 'user'}`);
          console.log(`  - user_name: ${doc.user_name}`);
          console.log(`  - user_email: ${doc.user_email}`);
        }
        
        if (roleFilter === 'authenticator') {
          matchesRole = userRole === 'authenticator';
        } else if (roleFilter === 'user') {
          matchesRole = userRole === 'user';
        }
      }

      return matchesSearch && matchesStatus && matchesRole;
    });
    
    // Debug log para mostrar quantos documentos foram filtrados
    if (roleFilter === 'user') {
      console.log(`[Role Filter Debug] Total documents: ${extendedDocuments.length}, Filtered for 'user': ${filtered.length}`);
    }
    
    return filtered;
  }, [extendedDocuments, searchTerm, statusFilter, roleFilter]);

  // Total dinâmico baseado nos filtros atuais
  const totalAmountFiltered = useMemo(() => {
    return filteredDocuments.reduce((sum, doc) => sum + (doc.total_cost || 0), 0);
  }, [filteredDocuments]);

  // Define a cor de fundo e texto com base no status de pagamento
  const getPaymentStatusColor = (paymentStatus: string | null | undefined) => {
    switch (paymentStatus) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'pending_verification': return 'bg-orange-100 text-orange-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'refunded': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Formata o texto do status de pagamento
  const getPaymentStatusText = (paymentStatus: string | null | undefined) => {
    switch (paymentStatus) {
      case 'completed': return t('admin.documents.table.status.paid');
      case 'pending': return t('admin.documents.table.status.pending');
      case 'pending_verification': return t('admin.documents.table.status.pendingVerification');
      case 'failed': return t('admin.documents.table.status.failed');
      case 'refunded': return t('admin.documents.table.status.refunded');
      default: return t('admin.documents.table.status.unknown');
    }
  };

  // Define a cor de fundo e texto com base no status do documento
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'pending_manual_review': return 'bg-orange-100 text-orange-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Gera e inicia o download de um relatório CSV dos documentos filtrados
  const downloadDocumentsReport = useCallback(() => {
    const csvContent = [
      ['Document Name', 'User Name', 'User Email', 'Document Type', 'Status', 'Pages', 'Cost', 'Source Language', 'Target Language', 'Authenticator', 'Created At'],
      ...filteredDocuments.map(doc => [
        doc.filename,
        doc.user_name || '',
        doc.user_email || '',
        doc.document_type || 'regular',
        doc.status || 'pending',
        doc.pages?.toString() || 'N/A',
        doc.total_cost?.toFixed(2) || '0.00',
        doc.source_language || '',
        doc.target_language || '',
        doc.authenticated_by_name || '',
        new Date(doc.created_at || '').toLocaleDateString()
      ])
    ].map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `documents-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, [filteredDocuments]);

  // Renderiza um esqueleto de carregamento enquanto os dados são buscados
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow w-full p-6">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow w-full">
      {/* Cabeçalho */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-lg font-medium text-gray-900">{t('admin.documents.title')}</h3>
            <p className="text-sm text-gray-500">
              {t('admin.documents.table.showing', { filtered: filteredDocuments.length, total: extendedDocuments.length })}
              <span className="mx-2">•</span>
              <span className="font-medium text-green-600">{t('admin.documents.table.total')}: ${totalAmountFiltered.toFixed(2)}</span>
            </p>
          </div>
          <button
            onClick={downloadDocumentsReport}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tfe-blue-500"
          >
            <Download className="w-4 h-4 mr-2" />
            <span>{t('admin.documents.table.exportCsv')}</span>
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gray-50">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
          {/* Search */}
          <div className="sm:col-span-2">
            <input
              type="text"
              placeholder={t('admin.documents.table.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
              aria-label="Search documents"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400 hidden sm:block" aria-hidden="true" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              aria-label="Filter by document status"
            >
              <option value="all">{t('admin.documents.table.filters.allStatus')}</option>
              <option value="completed">{t('admin.documents.table.status.completed')}</option>
              <option value="pending">{t('admin.documents.table.status.pending')}</option>
              <option value="processing">{t('admin.documents.table.status.processing')}</option>
              <option value="failed">{t('admin.documents.table.status.failed')}</option>
              <option value="draft">{t('admin.documents.table.status.draft')}</option>
            </select>
          </div>

          {/* Role Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400 hidden sm:block" aria-hidden="true" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              aria-label="Filter by user role"
            >
              <option value="all">{t('admin.documents.table.filters.allUserRoles')}</option>
              <option value="user">{t('admin.documents.table.filters.user')}</option>
              <option value="authenticator">{t('admin.documents.table.filters.authenticator')}</option>
            </select>
          </div>

          {/* Google Style Date Range Filter */}
          <GoogleStyleDatePicker
            dateRange={internalDateRange}
            onDateRangeChange={(newDateRange) => {
              setInternalDateRange(newDateRange);
              if (onDateRangeChange) {
                onDateRangeChange(newDateRange);
              }
            }}
            className="w-full"
          />
        </div>
      </div>

      {/* Conteúdo: Tabela para Desktop e Cartões para Mobile */}
      {filteredDocuments.length === 0 ? (
        <div className="text-center py-8 px-4">
          <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-base font-medium text-gray-700">{t('admin.documents.table.noDocuments')}</p>
          <p className="text-sm text-gray-500">{t('admin.documents.table.noDocumentsDescription')}</p>
        </div>
      ) : (
        <>
          {/* Mobile: Cards View */}
          <div className="sm:hidden px-3 py-2 space-y-2">
            {filteredDocuments.map((doc) => (
              <div key={doc.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {doc.display_name || doc.user_name || doc.user_email || 'Unknown user'}
                    </p>
                  </div>
                  <span className={`ml-2 flex-shrink-0 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(doc.status || 'pending')}`}>
                    {doc.status || 'pending'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                  <div>
                    <span className="text-gray-500">Amount:</span>
                    <p className="font-medium text-gray-900">${doc.total_cost?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Payment Method:</span>
                    <p className="font-medium text-gray-900 truncate">
                      {doc.payment_method ? (
                        doc.payment_method === 'card' ? '💳 Card' :
                          doc.payment_method === 'stripe' ? '💳 Stripe' :
                          doc.payment_method === 'bank_transfer' ? '🏦 Bank' :
                            doc.payment_method === 'paypal' ? '📱 PayPal' :
                              doc.payment_method === 'zelle' ? '💰 Zelle' :
                                doc.payment_method === 'upload' ? '📋 Upload' :
                                  doc.payment_method
                      ) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Translation:</span>
                    <p className="font-medium text-gray-900">
                      {doc.status || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Authenticator:</span>
                    <p className="font-medium text-gray-900 truncate">
                      {doc.authenticated_by_name || 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                  <p className="text-xs text-gray-500">{formatDate(doc.created_at || '')}</p>
                  <button onClick={() => onViewDocument(doc as Document)} className="text-blue-600 hover:text-blue-900">
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    USER/CLIENT
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                    Document
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Amount
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                    Payment Method
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Payment Status
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    TRANSLATIONS
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    AUTHENTICATOR
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Date
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    {/* USER/CLIENT */}
                    <td className="px-3 py-3 text-xs">
                      <div>
                        <div className="font-medium text-gray-900 truncate">
                          {doc.display_name || doc.user_name || 'N/A'}
                        </div>
                        <div className="text-gray-500 truncate">
                          {doc.user_email || 'No email'}
                        </div>
                      </div>
                    </td>
                    
                    {/* Document */}
                    <td className="px-3 py-3 text-xs">
                      <div className="flex items-center">
                        <FileText className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {doc.filename}
                          </div>
                          <div className="text-gray-500">
                            {doc.pages} páginas
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    {/* Amount */}
                    <td className="px-3 py-3 text-xs font-medium text-gray-900">
                      ${doc.total_cost?.toFixed(2) || '0.00'}
                    </td>
                    
                    {/* Payment Method */}
                    <td className="px-3 py-3 text-xs">
                      {doc.payment_method ? (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          {doc.payment_method === 'card' ? '💳 Card' :
                            doc.payment_method === 'stripe' ? '💳 Stripe' :
                            doc.payment_method === 'bank_transfer' ? '🏦 Bank' :
                            doc.payment_method === 'paypal' ? '📱 PayPal' :
                            doc.payment_method === 'zelle' ? '💰 Zelle' :
                            doc.payment_method === 'upload' ? '📋 Upload' :
                              doc.payment_method}
                        </span>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                    
                    {/* Payment Status */}
                    <td className="px-3 py-3 text-xs">
                      <span className={`inline-flex px-2 py-1 font-medium rounded-full ${getPaymentStatusColor(doc.payment_status)}`}>
                        {getPaymentStatusText(doc.payment_status)}
                      </span>
                    </td>
                    
                    {/* TRANSLATIONS */}
                    <td className="px-3 py-3 text-xs">
                      <span className={`inline-flex px-2 py-1 font-semibold rounded-full ${getStatusColor(doc.status || 'pending')}`}>
                        {doc.status || 'N/A'}
                      </span>
                    </td>
                    
                    {/* AUTHENTICATOR */}
                    <td className="px-3 py-3 text-xs">
                      <div className="truncate">
                        <div className="font-medium text-gray-900">
                          {doc.authenticated_by_name || 'N/A'}
                        </div>
                        <div className="text-gray-500 truncate">
                          {doc.authenticated_by_email || 'No authenticator'}
                        </div>
                      </div>
                    </td>
                    
                    {/* Date */}
                    <td className="px-3 py-3 text-xs text-gray-500">
                      {formatDate(doc.created_at || '')}
                    </td>
                    
                    {/* Details */}
                    <td className="px-3 py-3 text-xs text-right">
                      <button
                        onClick={() => onViewDocument(doc as Document)}
                        className="text-blue-600 hover:text-blue-900 font-medium p-1"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer removido para evitar duplicação do total */}
        </>
      )}
    </div>
  );
}