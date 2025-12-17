import { useEffect } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { DocumentDetailsModal } from './DocumentDetailsModal';
import { usePaymentsData } from './hooks/usePaymentsData';
import { usePaymentsFilters } from './hooks/usePaymentsFilters';
import { useDocumentViewer } from './hooks/useDocumentViewer';
import { PaymentsFilters } from './components/PaymentsFilters';
import { PaymentsTableDesktop } from './components/PaymentsTableDesktop';
import { PaymentsTableMobile } from './components/PaymentsTableMobile';
import { PaymentsPagination } from './components/PaymentsPagination';
import { exportPaymentsReport } from './services/paymentsExcelExport';
import { PaymentsTableProps } from './types/payments.types';

export function PaymentsTable({ initialDateRange }: PaymentsTableProps) {
  // Hook para gerenciar filtros e paginação
  // Inicialmente com array vazio - o hook sempre retorna dateFilter mesmo sem payments
  const filters = usePaymentsFilters({
    payments: [],
    itemsPerPage: 10,
    initialDateRange
  });

  // Hook para buscar dados de pagamentos (usa dateFilter dos filtros)
  const { payments, loading, error, refreshing, refresh } = usePaymentsData({
    dateFilter: filters.dateFilter,
    filterStatus: 'all', // Filtragem por status é client-side
    filterRole: 'all' // Filtragem por role é client-side
  });

  // Hook de filtros com os dados reais (faz filtragem client-side e paginação)
  const filtersWithPayments = usePaymentsFilters({
    payments,
    itemsPerPage: 10,
    initialDateRange
  });

  // Sincronizar dateFilter: quando mudar em filtersWithPayments, atualizar filters
  // para que usePaymentsData seja atualizado na próxima renderização
  useEffect(() => {
    if (filtersWithPayments.dateFilter !== filters.dateFilter) {
      filters.setDateFilter(filtersWithPayments.dateFilter);
    }
  }, [filtersWithPayments.dateFilter, filters.dateFilter, filters.setDateFilter]);

  // Hook para visualização de documentos
  const { selectedDocument, showModal, viewDocument, closeModal } = useDocumentViewer();

  // Handler para exportação
  const handleExport = async () => {
    await exportPaymentsReport(filtersWithPayments.filteredPayments, filtersWithPayments.dateFilter);
  };

  return (
    <div className="bg-white rounded-lg shadow w-full">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h3 className="text-base sm:text-lg font-medium text-gray-900">Payments</h3>
            <p className="text-sm text-gray-500">Track all payment transactions</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Refresh payments data"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              aria-label="Export Payments to Excel"
            >
              <Download className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Export Excel</span>
              <span className="sm:hidden">Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <PaymentsFilters
        searchTerm={filtersWithPayments.searchTerm}
        onSearchChange={filtersWithPayments.setSearchTerm}
        filterStatus={filtersWithPayments.filterStatus}
        onStatusChange={filtersWithPayments.setFilterStatus}
        filterRole={filtersWithPayments.filterRole}
        onRoleChange={filtersWithPayments.setFilterRole}
        dateFilter={filtersWithPayments.dateFilter}
        onDateFilterChange={filtersWithPayments.setDateFilter}
      />

      {/* Loading State */}
      {loading ? (
        <div className="p-6">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative m-6" role="alert">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      ) : (
        <>
          {/* Mobile: Cards View */}
          <div className="block sm:hidden">
            <PaymentsTableMobile
              payments={filtersWithPayments.paginatedPayments}
              onViewDocument={viewDocument}
            />
          </div>

          {/* Desktop: Table View */}
          <div className="hidden sm:block">
            <PaymentsTableDesktop
              payments={filtersWithPayments.paginatedPayments}
              onViewDocument={viewDocument}
            />
          </div>

          {/* Pagination */}
          <PaymentsPagination
            currentPage={filtersWithPayments.currentPage}
            totalPages={filtersWithPayments.totalPages}
            onPageChange={filtersWithPayments.setCurrentPage}
            filteredPayments={filtersWithPayments.filteredPayments}
            allPayments={payments}
            startIndex={filtersWithPayments.startIndex}
            endIndex={filtersWithPayments.endIndex}
          />
        </>
      )}

      {/* Document Details Modal */}
      {showModal && selectedDocument && (
        <DocumentDetailsModal
          document={selectedDocument as any}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
