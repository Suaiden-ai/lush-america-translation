import { useState, useEffect, useMemo } from 'react';
import { MappedPayment } from '../types/payments.types';
import { DateRange } from '../../../components/DateRangeFilter';

interface UsePaymentsFiltersParams {
  payments: MappedPayment[];
  itemsPerPage?: number;
  initialDateRange?: DateRange;
}

export function usePaymentsFilters({ payments, itemsPerPage = 10, initialDateRange }: UsePaymentsFiltersParams) {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<DateRange>(
    initialDateRange || {
      startDate: null,
      endDate: null,
      preset: 'all'
    }
  );
  const [currentPage, setCurrentPage] = useState(1);

  // Client-side filtering for search term, status, and role
  const filteredPayments = useMemo(() => {
    if (!payments) return [];
    return payments.filter(payment => {
      // Filter by status first
      const matchesStatus = filterStatus === 'all' || payment.status === filterStatus;
      
      // Filter by role
      const matchesRole = filterRole === 'all' || payment.user_role === filterRole;
      
      // Then filter by search term
      const matchesSearch = searchTerm === '' ||
        payment.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.document_filename?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.stripe_session_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.id.toLowerCase().includes(searchTerm.toLowerCase()); // Allow searching payment ID

      return matchesStatus && matchesRole && matchesSearch;
    });
  }, [payments, searchTerm, filterStatus, filterRole]);

  // Pagination logic
  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPayments = filteredPayments.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterRole, dateFilter]);

  return {
    // Filters
    filterStatus,
    setFilterStatus,
    filterRole,
    setFilterRole,
    searchTerm,
    setSearchTerm,
    dateFilter,
    setDateFilter,
    
    // Filtered and paginated data
    filteredPayments,
    paginatedPayments,
    
    // Pagination
    currentPage,
    setCurrentPage,
    totalPages,
    startIndex,
    endIndex,
    itemsPerPage
  };
}
