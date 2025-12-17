import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../../lib/supabase';
import { Document, Stats } from '../types/authenticator.types';

export function useAuthenticatorData() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({
    pending: 0,
    approved: 0
  });

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Buscar documentos de verificação PENDENTES (fonte única de verdade para autenticação)
      const { data: verifiedDocs, error: verifiedError } = await supabase
        .from('documents_to_be_verified')
        .select(`
          *,
          profiles:user_id (
            name,
            email
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      
      if (verifiedError) {
        console.error('[AuthenticatorDashboard] Error fetching verified documents:', verifiedError);
        setError(verifiedError.message);
        return;
      }

      // Buscar status de pagamentos para filtrar documentos refunded/cancelled
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('document_id, status, user_id, amount');
      
      if (paymentsError) {
        console.warn('[AuthenticatorDashboard] Erro ao buscar pagamentos:', paymentsError);
      }
      
      // Criar mapa de status de pagamentos
      const paymentStatusMap = new Map<string, string>();
      paymentsData?.forEach(payment => {
        if (payment.document_id) {
          paymentStatusMap.set(payment.document_id, payment.status);
        }
      });

      // Enriquecer documentos pendentes com dados do usuário e normalizar campos esperados na UI
      const pendingDocuments = (verifiedDocs as any[] || []).map(vdoc => {
        return {
          ...vdoc,
          user_name: vdoc.profiles?.name || null,
          user_email: vdoc.profiles?.email || null,
          verification_id: vdoc.id,
          // A UI espera 'status' com o valor já normalizado
          status: vdoc.status || 'pending',
        } as Document;
      });

      // Filtrar documentos que NÃO têm status refunded ou cancelled
      const validDocuments = pendingDocuments.filter(doc => {
        const paymentStatus = paymentStatusMap.get(doc.id);
        const shouldExclude = paymentStatus === 'refunded' || paymentStatus === 'cancelled';
        
        if (shouldExclude) {
          console.log('🚫 FILTRO: Excluindo documento refunded/cancelled:', {
            filename: doc.filename,
            payment_status: paymentStatus
          });
        }
        
        return !shouldExclude;
      });
      
      console.log('📊 FILTRO RESULTADO:');
      console.log(`- Total documentos pendentes: ${pendingDocuments.length}`);
      console.log(`- Documentos válidos: ${validDocuments.length}`);
      console.log(`- Documentos filtrados (pagamentos): ${pendingDocuments.length - validDocuments.length}`);
      
      // Debug: mostrar status dos documentos
      console.log('🔍 DEBUG - Status dos documentos:');
      validDocuments.forEach((doc, index) => {
        if (index < 5) { // Mostrar apenas os primeiros 5
          console.log(`  ${index + 1}. ${doc.filename} - Status: ${doc.status}`);
        }
      });
      
      // Calcular estatísticas
      const pendingCount = validDocuments.length;

      // Buscar contagem de aprovados a partir de translated_documents (fonte de verdade)
      const { count: approvedCountRaw } = await supabase
        .from('translated_documents')
        .select('*', { count: 'exact', head: true })
        .or('is_authenticated.eq.true,status.eq.completed');
      const approvedCount = approvedCountRaw || 0;

      console.log(`📈 Estatísticas: Pending: ${pendingCount}, Approved: ${approvedCount}`);

      setStats({
        pending: pendingCount,
        approved: approvedCount
      });

      // A lista deve mostrar APENAS documentos pendentes para autenticação
      console.log(`🎯 Documentos relevantes (apenas pending): ${validDocuments.length}`);
      setDocuments(validDocuments);
      
    } catch (err) {
      console.error('[AuthenticatorDashboard] Unexpected error:', err);
      setError('Unexpected error while fetching documents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const refresh = useCallback(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return {
    documents,
    loading,
    error,
    stats,
    refresh
  };
}
