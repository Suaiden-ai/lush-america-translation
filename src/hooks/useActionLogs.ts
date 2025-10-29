import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface ActionLog {
  id: string;
  performed_by: string;
  performed_by_type: 'user' | 'admin' | 'authenticator' | 'finance' | 'affiliate' | 'system';
  performed_by_name: string | null;
  performed_by_email: string | null;
  action_type: string;
  action_description: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, any> | null;
  affected_user_id: string | null;
  created_at: string;
}

interface LogFilters {
  action_type?: string;
  performed_by_type?: string;
  entity_type?: string;
  entity_id?: string;
  filename?: string; // New filter for filename
  document_id?: string; // Filter by specific document
  date_from?: string;
  date_to?: string;
  search_term?: string;
}

interface UseActionLogsReturn {
  logs: ActionLog[];
  loading: boolean;
  error: string | null;
  filters: LogFilters;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  fetchLogs: (page?: number, reset?: boolean) => Promise<void>;
  updateFilters: (newFilters: Partial<LogFilters>) => void;
  clearFilters: () => void;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
}

const DEFAULT_LIMIT = 20;

export const useActionLogs = (userId?: string): UseActionLogsReturn => {
  console.log('[useActionLogs] Hook called with userId:', userId);
  
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<LogFilters>({});
  const [pagination, setPagination] = useState({
    page: 1,
    limit: DEFAULT_LIMIT,
    total: 0,
    totalPages: 0,
    hasMore: false,
  });

  const fetchLogs = useCallback(async (page = 1, reset = false) => {
    // Don't fetch logs if no userId is provided
    if (!userId) {
      console.log('[useActionLogs] No userId provided, skipping fetch');
      setLogs([]);
      setPagination(prev => ({ ...prev, total: 0, hasMore: false }));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('action_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Filter by specific user if provided
      if (userId) {
        console.log(`[useActionLogs] Filtering logs for user: ${userId}`);
        // Show logs where the user is the affected user OR the performer
        // Use a more explicit approach to ensure proper filtering
        query = query.or(`affected_user_id.eq.${userId},performed_by.eq.${userId}`);
        console.log(`[useActionLogs] Applied filter: affected_user_id.eq.${userId},performed_by.eq.${userId}`);
      }

      // Apply search filter
      if (filters.search_term) {
        query = query.or(
          `performed_by_name.ilike.%${filters.search_term}%,performed_by_email.ilike.%${filters.search_term}%,action_description.ilike.%${filters.search_term}%`
        );
      }

      // Apply other filters
      if (filters.action_type) {
        query = query.eq('action_type', filters.action_type);
      }
      if (filters.performed_by_type) {
        query = query.eq('performed_by_type', filters.performed_by_type);
      }
      if (filters.entity_type) {
        query = query.eq('entity_type', filters.entity_type);
      }
      if (filters.entity_id) {
        query = query.eq('entity_id', filters.entity_id);
      }
      if (filters.filename) {
        // Filter by filename in metadata using JSONB text search
        query = query.ilike('metadata->>filename', `%${filters.filename}%`);
      }
      if (filters.document_id) {
        // Filter by specific document ID
        query = query.eq('entity_id', filters.document_id);
      }
      if (filters.date_from) {
        query = query.gte('created_at', filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte('created_at', filters.date_to);
      }

      // Pagination
      const from = (page - 1) * pagination.limit;
      const to = from + pagination.limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      const newLogs = (data || []) as ActionLog[];
      const total = count || 0;
      const totalPages = Math.ceil(total / pagination.limit);

      console.log(`[useActionLogs] Fetched ${newLogs.length} logs for user ${userId}`);
      console.log(`[useActionLogs] Sample logs:`, newLogs.slice(0, 3).map(log => ({
        id: log.id,
        performed_by: log.performed_by,
        performed_by_name: log.performed_by_name,
        affected_user_id: log.affected_user_id,
        action_type: log.action_type
      })));

      // Sempre substituir logs (paginação em vez de load more)
      setLogs(newLogs);
      setPagination((prev) => ({
        ...prev,
        page,
        total,
        totalPages,
        hasMore: page < totalPages,
      }));
    } catch (err) {
      console.error('[useActionLogs] Error fetching logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }, [userId, filters, pagination.limit]);

  const updateFilters = useCallback((newFilters: Partial<LogFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    // Reset pagination to page 1 when filters change
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    // Reset pagination to page 1 when clearing filters
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= pagination.totalPages && !loading) {
      fetchLogs(page, true);
    }
  }, [pagination.totalPages, loading, fetchLogs]);

  const nextPage = useCallback(() => {
    if (pagination.hasMore && !loading) {
      fetchLogs(pagination.page + 1, true);
    }
  }, [pagination.hasMore, pagination.page, loading, fetchLogs]);

  const prevPage = useCallback(() => {
    if (pagination.page > 1 && !loading) {
      fetchLogs(pagination.page - 1, true);
    }
  }, [pagination.page, loading, fetchLogs]);

  // Fetch logs when filters change or on mount
  useEffect(() => {
    if (userId) {
      // Always fetch page 1 when filters change
      fetchLogs(1, true);
    }
  }, [userId, filters.action_type, filters.performed_by_type, filters.entity_type, filters.entity_id, filters.filename, filters.document_id, filters.date_from, filters.date_to, filters.search_term]);

  return {
    logs,
    loading,
    error,
    filters,
    pagination,
    fetchLogs,
    updateFilters,
    clearFilters,
    goToPage,
    nextPage,
    prevPage,
  };
};

