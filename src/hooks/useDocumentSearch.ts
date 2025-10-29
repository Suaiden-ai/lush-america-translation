import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface DocumentOption {
  id: string;
  filename: string;
  document_id: string;
  entity_id: string;
}

interface UseDocumentListReturn {
  documents: DocumentOption[];
  loading: boolean;
  error: string | null;
  fetchDocuments: (userId: string) => Promise<void>;
  clearResults: () => void;
}

export const useDocumentList = (): UseDocumentListReturn => {
  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async (userId: string) => {
    if (!userId) {
      setDocuments([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Query action_logs to get unique documents that have logs for the user
      const { data, error } = await supabase
        .from('action_logs')
        .select('metadata, entity_id')
        .or(`affected_user_id.eq.${userId},performed_by.eq.${userId}`)
        .not('metadata->>filename', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100); // Get more results to filter unique ones

      if (error) throw error;

      // Process results to get unique documents
      const uniqueDocuments = new Map<string, DocumentOption>();
      
      (data || []).forEach(log => {
        const filename = log.metadata?.filename || log.metadata?.original_filename;
        const documentId = log.metadata?.document_id || log.entity_id;
        
        if (filename && documentId) {
          const key = `${documentId}-${filename}`;
          if (!uniqueDocuments.has(key)) {
            uniqueDocuments.set(key, {
              id: documentId,
              filename: filename,
              document_id: documentId,
              entity_id: log.entity_id || documentId
            });
          }
        }
      });

      // Convert to array and sort by filename
      const results = Array.from(uniqueDocuments.values())
        .sort((a, b) => a.filename.localeCompare(b.filename));
      
      setDocuments(results);
    } catch (err) {
      console.error('[useDocumentList] Error fetching documents:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch documents');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setDocuments([]);
    setError(null);
  }, []);

  return {
    documents,
    loading,
    error,
    fetchDocuments,
    clearResults,
  };
};
