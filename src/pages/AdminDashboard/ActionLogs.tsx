import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  ArrowLeft,
  User as UserIcon,
  Loader2,
  AlertCircle,
  Calendar,
  Filter,
  X,
  ChevronDown
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useActionLogs } from '../../hooks/useActionLogs';
import { useDocumentList } from '../../hooks/useDocumentList';
import { useClientsCache } from '../../hooks/useClientsCache';
import type { Client } from '../../hooks/useClientsCache';
import { LogItem } from '../../components/LogItem';
import { useI18n } from '../../contexts/I18nContext';
import { Logger } from '../../lib/loggingHelpers';
import { ActionTypes } from '../../types/actionTypes';

export const ActionLogs: React.FC = () => {
  const { t } = useI18n();
  
  // Hook de cache de clientes
  const { clients, loading, error, refreshClients, lastUpdated } = useClientsCache();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [timeFrom, setTimeFrom] = useState('');
  const [timeTo, setTimeTo] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<{id: string, name: string} | null>(null);
  const [showDocumentDropdown, setShowDocumentDropdown] = useState(false);

  // Hook de logs para o cliente selecionado
  const { logs: allLogs, loading: logsLoading, pagination, goToPage, nextPage, prevPage, updateFilters, clearFilters } = useActionLogs(selectedClient?.id);
  
  // Hook de lista de documentos
  const { documents: documentList, loading: documentsLoading, fetchDocuments, clearResults } = useDocumentList();
  
  // Debug: log do selectedClient
  console.log('[ActionLogs] selectedClient:', selectedClient);
  console.log('[ActionLogs] selectedClient?.id:', selectedClient?.id);
  
  // Filtrar logs localmente baseado no searchTerm
  const logs = allLogs.filter(log => {
    if (!searchTerm.trim()) return true;
    
    const searchLower = searchTerm.toLowerCase();
    
    // Buscar em diferentes campos do log
    return (
      log.action_description.toLowerCase().includes(searchLower) ||
      log.action_type.toLowerCase().includes(searchLower) ||
      log.performed_by_name?.toLowerCase().includes(searchLower) ||
      log.performed_by_email?.toLowerCase().includes(searchLower) ||
      log.entity_id?.toLowerCase().includes(searchLower) ||
      // Buscar no metadata (filename, etc.)
      (log.metadata && JSON.stringify(log.metadata).toLowerCase().includes(searchLower))
    );
  });

  // Filtrar clientes por busca (busca local agora)
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Aplicar filtros de data quando mudarem (sempre reseta para página 1)
  useEffect(() => {
    if (selectedClient) {
      let dateFromFilter = '';
      let dateToFilter = '';

      if (dateFrom) {
        dateFromFilter = timeFrom ? `${dateFrom}T${timeFrom}` : `${dateFrom}T00:00:00`;
      }

      if (dateTo) {
        dateToFilter = timeTo ? `${dateTo}T${timeTo}` : `${dateTo}T23:59:59`;
      }

      // updateFilters já reseta para página 1 automaticamente
      updateFilters({
        date_from: dateFromFilter || undefined,
        date_to: dateToFilter || undefined
      });
    }
  }, [dateFrom, dateTo, timeFrom, timeTo, selectedClient, updateFilters]);

  // Carregar lista de documentos quando cliente é selecionado
  useEffect(() => {
    if (selectedClient) {
      fetchDocuments(selectedClient.id);
    } else {
      clearResults();
      setSelectedDocument(null);
    }
  }, [selectedClient, fetchDocuments, clearResults]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.document-filter-container')) {
        setShowDocumentDropdown(false);
      }
    };

    if (showDocumentDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDocumentDropdown]);

  // Funções para filtros rápidos
  const applyQuickFilter = (period: string) => {
    const now = new Date();
    let fromDate = '';
    let toDate = '';

    switch (period) {
      case 'today':
        fromDate = now.toISOString().split('T')[0];
        toDate = now.toISOString().split('T')[0];
        break;
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        fromDate = yesterday.toISOString().split('T')[0];
        toDate = yesterday.toISOString().split('T')[0];
        break;
      case 'last7days':
        const lastWeek = new Date(now);
        lastWeek.setDate(lastWeek.getDate() - 7);
        fromDate = lastWeek.toISOString().split('T')[0];
        toDate = now.toISOString().split('T')[0];
        break;
      case 'last30days':
        const lastMonth = new Date(now);
        lastMonth.setDate(lastMonth.getDate() - 30);
        fromDate = lastMonth.toISOString().split('T')[0];
        toDate = now.toISOString().split('T')[0];
        break;
      case 'clear':
        fromDate = '';
        toDate = '';
        break;
    }

    setDateFrom(fromDate);
    setDateTo(toDate);
    setTimeFrom('');
    setTimeTo('');
  };

  const clearAllFilters = () => {
    setDateFrom('');
    setDateTo('');
    setTimeFrom('');
    setTimeTo('');
    setSearchTerm('');
    setSelectedDocument(null);
    setShowDocumentDropdown(false);
    clearResults();
    // clearFilters do hook já reseta paginação para página 1
    clearFilters();
  };

  // Funções para lidar com seleção de documentos
  const handleDocumentSelect = (document: {id: string, filename: string}) => {
    setSelectedDocument({ id: document.id, name: document.filename });
    setShowDocumentDropdown(false);
    // Aplicar filtro de documento
    updateFilters({ document_id: document.id });
  };

  const handleDocumentClear = () => {
    setSelectedDocument(null);
    updateFilters({ document_id: undefined });
  };


  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;

    return date.toLocaleDateString();
  };

  // Se um cliente está selecionado, mostrar os logs dele
  if (selectedClient) {
    return (
      <div className="py-4 sm:py-6">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
          {/* Header com botão voltar */}
          <div className="mb-4 sm:mb-6">
        <button
          onClick={() => {
            setSelectedClient(null);
            setSearchTerm(''); // Limpar busca ao voltar
          }}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Clients
        </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-xl font-bold text-blue-600">
                  {selectedClient.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                  {selectedClient.name}'s Activity
                </h1>
                <p className="text-sm text-gray-600">{selectedClient.email}</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mt-4">
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <p className="text-xs text-gray-600">Total Logs</p>
                <p className="text-lg sm:text-xl font-bold text-gray-900">{pagination.total}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <p className="text-xs text-gray-600">Documents</p>
                <p className="text-lg sm:text-xl font-bold text-gray-900">{selectedClient.documents_count}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <p className="text-xs text-gray-600">Last Activity</p>
                <p className="text-lg sm:text-xl font-bold text-gray-900">{formatDate(selectedClient.last_activity)}</p>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="mt-4 space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search logs in real-time..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Filter Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    showFilters 
                      ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                      : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Filters
                </button>

                {/* Quick Filter Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => applyQuickFilter('today')}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => applyQuickFilter('yesterday')}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                  >
                    Yesterday
                  </button>
                  <button
                    onClick={() => applyQuickFilter('last7days')}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                  >
                    Last 7 days
                  </button>
                  <button
                    onClick={() => applyQuickFilter('last30days')}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                  >
                    Last 30 days
                  </button>
                  <button
                    onClick={() => applyQuickFilter('clear')}
                    className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Advanced Filters */}
              {showFilters && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">Date & Time Filters</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Date From */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <input
                          type="time"
                          value={timeFrom}
                          onChange={(e) => setTimeFrom(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Time"
                        />
                      </div>
                    </div>

                    {/* Date To */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <input
                          type="time"
                          value={timeTo}
                          onChange={(e) => setTimeTo(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Time"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Document Filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Filter by Document</label>
                    <div className="relative document-filter-container">
                      {selectedDocument ? (
                        // Show selected document
                        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <FileText className="w-4 h-4 text-blue-600" />
                          <span className="flex-1 text-sm font-medium text-blue-900 truncate">
                            {selectedDocument.name}
                          </span>
                          <button
                            onClick={handleDocumentClear}
                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        // Select dropdown
                        <div className="relative">
                          <button
                            onClick={() => setShowDocumentDropdown(!showDocumentDropdown)}
                            className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-500">
                                {documentsLoading ? 'Loading documents...' : 'Select a document'}
                              </span>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showDocumentDropdown ? 'rotate-180' : ''}`} />
                          </button>

                          {/* Dropdown with document list */}
                          {showDocumentDropdown && documentList.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                              {documentList.map((doc) => (
                                <button
                                  key={doc.id}
                                  onClick={() => handleDocumentSelect(doc)}
                                  className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                                >
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-gray-500" />
                                    <span className="text-sm text-gray-900 truncate">{doc.filename}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* No documents message */}
                          {showDocumentDropdown && documentList.length === 0 && !documentsLoading && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3">
                              <p className="text-sm text-gray-500">No documents found</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Clear All Filters */}
                  <div className="flex justify-end">
                    <button
                      onClick={clearAllFilters}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Clear All Filters
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Loading State */}
          {logsLoading && logs.length === 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-12">
              <div className="flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
                <p className="text-gray-600">Loading activity logs...</p>
              </div>
            </div>
          )}

          {/* Logs List */}
          {!logsLoading && logs.length > 0 && (
            <div className="space-y-3">
              {logs.map((log) => (
                <LogItem key={log.id} log={log} />
              ))}

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex flex-col items-center gap-4 pt-6">
                  {/* Page Info */}
                  <div className="text-sm text-gray-600">
                    Showing page {pagination.page} of {pagination.totalPages} 
                    ({pagination.total} total logs)
                    {/* Show active filters indicator */}
                    {(dateFrom || dateTo || searchTerm || selectedDocument) && (
                      <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                        Filters Active
                      </span>
                    )}
                  </div>

                  {/* Pagination Controls */}
                  <div className="flex items-center gap-2">
                    {/* First Page */}
                    <button
                      onClick={() => goToPage(1)}
                      disabled={pagination.page === 1 || logsLoading}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      First
                    </button>

                    {/* Previous Page */}
                    <button
                      onClick={prevPage}
                      disabled={pagination.page === 1 || logsLoading}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>

                    {/* Page Numbers */}
                    <div className="flex items-center gap-1">
                      {(() => {
                        const pages = [];
                        const currentPage = pagination.page;
                        const totalPages = pagination.totalPages;
                        
                        // Show up to 5 page numbers around current page
                        let startPage = Math.max(1, currentPage - 2);
                        let endPage = Math.min(totalPages, currentPage + 2);
                        
                        // Adjust if we're near the beginning or end
                        if (currentPage <= 3) {
                          endPage = Math.min(5, totalPages);
                        }
                        if (currentPage >= totalPages - 2) {
                          startPage = Math.max(1, totalPages - 4);
                        }
                        
                        for (let i = startPage; i <= endPage; i++) {
                          pages.push(
                            <button
                              key={i}
                              onClick={() => goToPage(i)}
                              disabled={logsLoading}
                              className={`px-3 py-2 text-sm border rounded-lg ${
                                i === currentPage
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'border-gray-300 hover:bg-gray-50'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              {i}
                            </button>
                          );
                        }
                        
                        return pages;
                      })()}
                    </div>

                    {/* Next Page */}
                    <button
                      onClick={nextPage}
                      disabled={!pagination.hasMore || logsLoading}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>

                    {/* Last Page */}
                    <button
                      onClick={() => goToPage(pagination.totalPages)}
                      disabled={pagination.page === pagination.totalPages || logsLoading}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Last
                    </button>
                  </div>

                  {/* Loading Indicator */}
                  {logsLoading && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading page {pagination.page}...
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {!logsLoading && logs.length === 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-12">
              <div className="flex flex-col items-center justify-center text-center">
                <FileText className="w-12 h-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No activity yet</h3>
                <p className="text-sm text-gray-600">This client hasn't performed any actions yet.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vista principal: Lista de clientes
  return (
    <div className="py-4 sm:py-6">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                {t('admin.activityLogs.title')}
              </h1>
              <p className="text-sm text-gray-600">{t('admin.activityLogs.subtitle')}</p>
            </div>
          </div>

        {/* Unified Search */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search clients by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          <button
            onClick={refreshClients}
            disabled={loading}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-2"
            title={lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : 'Refresh clients list'}
          >
            <Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error loading clients</h3>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-12">
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
              <p className="text-gray-600">Loading clients...</p>
            </div>
          </div>
        )}

        {/* Clients List */}
        {!loading && filteredClients.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            {/* Table Header */}
            <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase">
              <div className="col-span-4">Client</div>
              <div className="col-span-3">Email</div>
              <div className="col-span-2">Documents</div>
              <div className="col-span-3">Last Activity</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-200">
              {filteredClients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => setSelectedClient(client)}
                  className="w-full px-4 py-3 hover:bg-gray-50 transition-colors text-left group"
                >
                  {/* Desktop View */}
                  <div className="hidden md:grid md:grid-cols-12 gap-4 items-center">
                    <div className="col-span-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                        <span className="text-sm font-bold text-blue-600">
                          {client.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium text-gray-900 truncate">{client.name}</span>
                    </div>
                    <div className="col-span-3 text-sm text-gray-600 truncate">{client.email}</div>
                    <div className="col-span-2 text-sm text-gray-900">{client.documents_count} docs</div>
                    <div className="col-span-3 text-sm text-gray-600">{formatDate(client.last_activity)}</div>
                  </div>

                  {/* Mobile View */}
                  <div className="md:hidden flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                      <span className="text-sm font-bold text-blue-600">
                        {client.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{client.name}</h3>
                      <p className="text-sm text-gray-600 truncate">{client.email}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>{client.documents_count} docs</span>
                        <span>•</span>
                        <span>{formatDate(client.last_activity)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredClients.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <UserIcon className="w-12 h-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No clients found</h3>
              <p className="text-sm text-gray-600">
                {searchTerm ? 'Try adjusting your search term.' : 'No clients available yet.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActionLogs;
