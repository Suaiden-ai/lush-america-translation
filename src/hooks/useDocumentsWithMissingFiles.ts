import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface DocumentWithMissingFile {
  document_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  payment_id: string;
  payment_status: string;
  payment_amount: number; // Valor líquido (sem taxa) - mantido para compatibilidade
  payment_gross_amount: number; // Valor total pago (incluindo taxa do Stripe) - usar este para exibir
  payment_fee_amount?: number | null; // Taxa do Stripe
  payment_date: string;
  filename: string;
  original_filename: string | null;
  status: string;
  total_cost: number;
  verification_code: string;
  created_at: string;
  upload_failed_at: string | null;
  upload_retry_count: number;
  pages: number; // Número de páginas que foi pago
}

export function useDocumentsWithMissingFiles(userId?: string) {
  const [documents, setDocuments] = useState<DocumentWithMissingFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[useDocumentsWithMissingFiles] Buscando documentos para userId:', userId);

      const { data, error: fetchError } = await supabase
        .rpc('get_documents_with_missing_files', {
          user_id_param: userId || null
        });

      if (fetchError) {
        console.error('[useDocumentsWithMissingFiles] Erro ao buscar:', fetchError);
        setError(fetchError.message);
        return;
      }

      console.log('[useDocumentsWithMissingFiles] Documentos encontrados:', data?.length || 0, data);
      setDocuments(data || []);
    } catch (err: any) {
      console.error('[useDocumentsWithMissingFiles] Exceção:', err);
      setError(err.message || 'Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();

    // Configurar subscription para atualizações em tempo real
    const channel = supabase
      .channel('documents_with_missing_files_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: userId ? `user_id=eq.${userId}` : undefined
        },
        () => {
          // Recarregar documentos quando houver mudanças
          fetchDocuments();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments'
        },
        () => {
          // Recarregar documentos quando houver mudanças em pagamentos
          fetchDocuments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return {
    documents,
    loading,
    error,
    refetch: fetchDocuments,
    count: documents.length
  };
}

