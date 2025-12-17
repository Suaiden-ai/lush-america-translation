import { useState, useMemo } from 'react';
import { Document } from '../types/authenticator.types';

interface UsePaginationParams {
  items: Document[];
  itemsPerPage: number;
}

export function usePagination({ items, itemsPerPage }: UsePaginationParams) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  
  const paginatedItems = useMemo(() => {
    return items.slice(startIndex, endIndex);
  }, [items, startIndex, endIndex]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Reset to page 1 when items change
  useMemo(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [items.length, totalPages]);

  return {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    paginatedItems,
    setCurrentPage: handlePageChange
  };
}
