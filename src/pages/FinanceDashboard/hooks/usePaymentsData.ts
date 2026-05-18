import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { DateRange } from '../../../components/DateRangeFilter';
import { MappedPayment } from '../types/payments.types';

interface UsePaymentsDataParams {
  dateFilter: DateRange;
  filterStatus: string;
  filterRole: string;
}

export function usePaymentsData({ dateFilter, filterStatus, filterRole }: UsePaymentsDataParams) {
  const [payments, setPayments] = useState<MappedPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPayments([]); // Clear payments on new load

    try {
      console.log('🔄 Loading payments with correct logic...', { dateFilter, filterStatus, filterRole });

      // Aplicar filtros de data se fornecidos
      let startDateParam = null;
      let endDateParam = null;

      if (dateFilter?.startDate) {
        // Para data de início, usar início do dia (00:00:00)
        const startDate = new Date(dateFilter.startDate);
        startDate.setHours(0, 0, 0, 0);
        startDateParam = startDate.toISOString();
      }

      if (dateFilter?.endDate) {
        // Para data de fim, usar fim do dia (23:59:59)
        const endDate = new Date(dateFilter.endDate);
        endDate.setHours(23, 59, 59, 999);
        endDateParam = endDate.toISOString();
      }

      console.log('🔍 Date filter params:', { startDateParam, endDateParam });

      // Buscar todos os documentos da tabela principal (como no Admin Dashboard)
      // Excluir documentos de uso pessoal (is_internal_use = true) das estatísticas
      let mainDocumentsQuery = supabase
        .from('documents')
        .select('*, profiles:profiles!documents_user_id_fkey(name, email, phone, role)')
        .or('is_internal_use.is.null,is_internal_use.eq.false')
        .order('created_at', { ascending: false });

      // Aplicar filtros de data
      if (startDateParam) {
        mainDocumentsQuery = mainDocumentsQuery.gte('created_at', startDateParam);
      }
      if (endDateParam) {
        mainDocumentsQuery = mainDocumentsQuery.lte('created_at', endDateParam);
      }

      const { data: mainDocuments, error: mainError } = await mainDocumentsQuery;

      if (mainError) {
        console.error('Error loading documents:', mainError);
        return;
      }

      // Buscar documentos da tabela documents_to_be_verified
      // IMPORTANTE: Incluir original_document_id para poder buscar o pagamento correto
      let verifiedDocumentsQuery = supabase
        .from('documents_to_be_verified')
        .select('*, original_document_id, profiles:profiles!documents_to_be_verified_user_id_fkey(name, email, phone, role)')
        .order('created_at', { ascending: false });

      // Aplicar filtros de data
      if (startDateParam) {
        verifiedDocumentsQuery = verifiedDocumentsQuery.gte('created_at', startDateParam);
      }
      if (endDateParam) {
        verifiedDocumentsQuery = verifiedDocumentsQuery.lte('created_at', endDateParam);
      }

      const { data: verifiedDocuments, error: verifiedDocError } = await verifiedDocumentsQuery;

      if (verifiedDocError) {
        console.error('Error loading verified documents:', verifiedDocError);
      }

      // Buscar todos os documentos (incluindo os de uso pessoal) para verificar is_internal_use
      // Isso é necessário porque mainDocuments já está filtrado
      let allDocumentsForCheck: Array<{ id: string; filename: string; is_internal_use: boolean | null }> = [];
      if (verifiedDocuments && verifiedDocuments.length > 0) {
        const filenames = verifiedDocuments.map(vd => vd.filename);
        const { data: allDocs, error: allDocsError } = await supabase
          .from('documents')
          .select('id, filename, is_internal_use')
          .in('filename', filenames);

        if (allDocsError) {
          console.error('Error loading all documents for check:', allDocsError);
        } else {
          allDocumentsForCheck = allDocs || [];
        }
      }

      // ✅ BUSCAR DADOS DE AUTENTICAÇÃO DE translated_documents
      // 1. Para autenticadores: buscar usando os IDs dos dtbv diretamente
      let translatedDocsMap = new Map(); // Mapa: dtbv.id -> dados de autenticação
      if (verifiedDocuments && verifiedDocuments.length > 0) {
        const dtbvIds = verifiedDocuments.map(vd => vd.id);
        const { data: translatedDocs, error: tdError } = await supabase
          .from('translated_documents')
          .select('original_document_id, authenticated_by_name, authenticated_by_email, authentication_date, is_authenticated, status')
          .in('original_document_id', dtbvIds);

        if (tdError) {
          console.error('Error loading translated_documents:', tdError);
        } else if (translatedDocs) {
          // Criar mapa: dtbv.id -> dados de autenticação
          translatedDocs.forEach(td => {
            translatedDocsMap.set(td.original_document_id, {
              authenticated_by_name: td.authenticated_by_name,
              authenticated_by_email: td.authenticated_by_email,
              authentication_date: td.authentication_date,
              is_authenticated: td.is_authenticated,
              status: td.status
            });
          });
        }
      }

      // 2. Para documentos regulares: buscar dtbv que referenciam documents.id
      let regularDocsAuthMap = new Map(); // Mapa: documents.id -> dados de autenticação
      if (mainDocuments && mainDocuments.length > 0) {
        const regularDocIds = mainDocuments.map(doc => doc.id);

        // Buscar documents_to_be_verified que referenciam os documentos regulares
        const { data: dtbvForRegularDocs, error: dtbvRegularError } = await supabase
          .from('documents_to_be_verified')
          .select('id, original_document_id')
          .in('original_document_id', regularDocIds);

        if (!dtbvRegularError && dtbvForRegularDocs && dtbvForRegularDocs.length > 0) {
          const dtbvIdsForRegular = dtbvForRegularDocs.map(d => d.id);

          // Buscar translated_documents usando os IDs dos dtbv
          const { data: translatedDocsForRegular, error: tdRegularError } = await supabase
            .from('translated_documents')
            .select('original_document_id, authenticated_by_name, authenticated_by_email, authentication_date, is_authenticated, status')
            .in('original_document_id', dtbvIdsForRegular);

          if (!tdRegularError && translatedDocsForRegular) {
            // Criar mapa auxiliar: dtbv.id -> documents.id
            const dtbvToDocMap = new Map(dtbvForRegularDocs.map(d => [d.id, d.original_document_id]));

            // Mapear dados de autenticação: documents.id -> dados de autenticação
            translatedDocsForRegular.forEach(td => {
              const dtbvId = td.original_document_id; // ID do documents_to_be_verified
              const originalDocId = dtbvToDocMap.get(dtbvId); // ID do documento original (documents.id)

              if (originalDocId) {
                regularDocsAuthMap.set(originalDocId, {
                  authenticated_by_name: td.authenticated_by_name,
                  authenticated_by_email: td.authenticated_by_email,
                  authentication_date: td.authentication_date,
                  is_authenticated: td.is_authenticated,
                  status: td.status
                });
              }
            });
          }
        }
      }

      // Buscar IDs de todos os documentos encontrados para buscar os pagamentos vinculados
      const allDocIds = [
        ...(mainDocuments?.map(d => d.id) || []),
        ...(verifiedDocuments?.map(d => d.id) || []),
        ...(verifiedDocuments?.map(d => d.original_document_id).filter(id => !!id) as string[] || [])
      ];

      // Eliminar duplicatas
      const uniqueDocIds = [...new Set(allDocIds)];

      // Buscar dados de pagamentos vinculados aos documentos encontrados
      // IMPORTANTE: Não filtrar por data aqui para garantir que pagamentos feitos após
      // a criação do documento sejam encontrados, igual ao Admin Dashboard.
      let paymentsData: any[] = [];
      if (uniqueDocIds.length > 0) {
        const { data, error: paymentsError } = await supabase
          .from('payments')
          .select('*')
          .in('document_id', uniqueDocIds);

        if (paymentsError) {
          console.error('Error loading payments data:', paymentsError);
        } else {
          paymentsData = data || [];
        }
      }

      // Processar documentos de autenticadores (documents_to_be_verified)
      // Para autenticadores, o payment_method está na tabela documents
      // Filtrar documentos de uso pessoal (is_internal_use = true)
      const authenticatorPayments: MappedPayment[] = verifiedDocuments?.filter(verifiedDoc => {
        // Verificar se o documento original é de uso pessoal
        // Primeiro tentar pelo original_document_id, depois pelo filename
        let originalDoc = null;
        if (verifiedDoc.original_document_id) {
          // Buscar no allDocumentsForCheck (que inclui todos os documentos)
          originalDoc = allDocumentsForCheck.find(doc => doc.id === verifiedDoc.original_document_id);
          // Se não encontrar, tentar no mainDocuments
          if (!originalDoc) {
            originalDoc = mainDocuments?.find(doc => doc.id === verifiedDoc.original_document_id);
          }
        } else {
          // Se não tiver original_document_id, buscar pelo filename no allDocumentsForCheck
          originalDoc = allDocumentsForCheck.find(doc => doc.filename === verifiedDoc.filename);
        }

        if (originalDoc?.is_internal_use === true) {
          return false; // Excluir documentos de uso pessoal
        }
        return true; // Incluir todos os outros documentos
      }).map(verifiedDoc => {
        const mainDoc = mainDocuments?.find(doc => doc.filename === verifiedDoc.filename);

        // 🔍 BUSCAR STATUS REAL DA TABELA PAYMENTS PARA AUTENTICADORES
        // IMPORTANTE: verifiedDoc.id é o ID de documents_to_be_verified
        // O pagamento está vinculado ao document_id original (documents.id), não ao dtbv.id
        // MESMA LÓGICA DO ADMIN DASHBOARD: buscar apenas pelo original_document_id (sem fallback)
        let realStatus = 'completed'; // Default para autenticadores
        let paymentForAuth = null;

        if (verifiedDoc.original_document_id) {
          paymentForAuth = paymentsData?.find(payment =>
            payment.document_id === verifiedDoc.original_document_id
          );
        }

        if (paymentForAuth) {
          realStatus = paymentForAuth.status;
        }

        // 🔍 LOG PARA VERIFICAR SE O DOCUMENTO REFUNDED ESTÁ SENDO PROCESSADO COM STATUS CORRETO
        if (verifiedDoc.filename === 'relatorio-suaiden-ai_PS7V00.pdf') {
          console.log('🔍 DEBUG - Creating authenticator payment for refunded document:', {
            id: `auth-${verifiedDoc.id}`,
            status: realStatus, // Status real da tabela payments
            amount: verifiedDoc.total_cost || 0,
            payment_method: mainDoc?.payment_method || null
          });
        }

        return {
          id: `auth-${verifiedDoc.id}`,
          user_id: verifiedDoc.user_id,
          document_id: verifiedDoc.id,
          stripe_session_id: null,
          amount: paymentForAuth?.amount || verifiedDoc.total_cost || 0,
          currency: 'usd',
          status: realStatus, // Usar status real da tabela payments
          payment_method: paymentForAuth?.payment_method || mainDoc?.payment_method || null, // Priorizar método do pagamento
          payment_date: paymentForAuth?.payment_date || verifiedDoc.authentication_date || verifiedDoc.created_at,
          created_at: verifiedDoc.created_at,
          fee_amount: paymentForAuth?.fee_amount || 0,
          gross_amount: paymentForAuth?.gross_amount || verifiedDoc.total_cost || 0,

          // Dados do usuário
          user_email: verifiedDoc.profiles?.email || null,
          user_name: verifiedDoc.profiles?.name || null,
          user_role: verifiedDoc.profiles?.role || null,

          // Dados do documento
          document_filename: verifiedDoc.filename,
          // Para autenticadores, usar status 'completed' se foi autenticado (igual ao AdminDashboard)
          document_status: (verifiedDoc.authenticated_by_name || verifiedDoc.status === 'completed') ? 'completed' : verifiedDoc.status,
          client_name: verifiedDoc.client_name,
          idioma_raiz: verifiedDoc.source_language,
          tipo_trad: verifiedDoc.target_language,

          // ✅ DADOS DE AUTENTICAÇÃO VINDOS DE translated_documents (fonte de verdade)
          authenticated_by_name: (translatedDocsMap.get(verifiedDoc.id)?.authenticated_by_name) || verifiedDoc.authenticated_by_name || null,
          authenticated_by_email: (translatedDocsMap.get(verifiedDoc.id)?.authenticated_by_email) || verifiedDoc.authenticated_by_email || null,
          authentication_date: (translatedDocsMap.get(verifiedDoc.id)?.authentication_date) || verifiedDoc.authentication_date || null,
          source_language: verifiedDoc.source_language,
          target_language: verifiedDoc.target_language,

          // Campos obrigatórios da interface
          profiles: verifiedDoc.profiles,
          documents: {
            filename: verifiedDoc.filename,
            status: verifiedDoc.status,
            client_name: verifiedDoc.client_name,
            idioma_raiz: verifiedDoc.source_language,
            tipo_trad: verifiedDoc.target_language,
            verification_code: verifiedDoc.verification_code
          },
          pages: verifiedDoc.pages || 0,
          total_cost: verifiedDoc.total_cost || 0
        };
      }) || [];

      // Processar documentos de usuários regulares (role: user)
      // Para usuários regulares, o payment_method está na tabela payments
      const regularPayments: MappedPayment[] = [];

      if (mainDocuments) {
        for (const doc of mainDocuments) {
          // Excluir documentos de uso pessoal (is_internal_use = true)
          if (doc.is_internal_use === true) {
            continue;
          }

          // Verificar se já foi processado como autenticador
          const alreadyProcessed = authenticatorPayments.some(auth => auth.document_filename === doc.filename);
          if (alreadyProcessed) {
            continue;
          }

          // Buscar pagamento na tabela payments para usuários regulares
          const paymentInfo = paymentsData?.find(payment => payment.document_id === doc.id);

          // Só incluir se tem informação financeira e NÃO for um rascunho
          // 🛑 REGRA ADMIN: Ignorar rascunhos (drafts)
          const authData = regularDocsAuthMap.get(doc.id);
          let translationStatus = doc.status || 'pending';

          // Se o documento foi autenticado, deve mostrar "completed"
          if (authData && (authData.is_authenticated === true || authData.status === 'completed')) {
            translationStatus = 'completed';
          }

          if (translationStatus === 'draft' || translationStatus === 'pending_review') {
            continue;
          }

          if (!paymentInfo && !doc.total_cost) {
            continue;
          }

          regularPayments.push({
            id: paymentInfo?.id || `doc-${doc.id}`,
            user_id: doc.user_id,
            document_id: doc.id,
            stripe_session_id: paymentInfo?.stripe_session_id || null,
            amount: paymentInfo?.amount || doc.total_cost || 0,
            currency: paymentInfo?.currency || 'usd',
            status: paymentInfo?.status, // Para usuários regulares, buscar na tabela payments
            payment_method: paymentInfo?.payment_method || doc.payment_method || null, // Priorizar método do pagamento
            payment_date: paymentInfo?.payment_date || doc.created_at,
            created_at: paymentInfo?.created_at || doc.created_at,
            fee_amount: paymentInfo?.fee_amount || 0,
            gross_amount: paymentInfo?.gross_amount || doc.total_cost || 0,

            // Dados do usuário
            user_email: doc.profiles?.email || null,
            user_name: doc.profiles?.name || null,
            user_role: doc.profiles?.role || null,

            // Dados do documento
            document_filename: doc.filename,
            document_status: translationStatus,
            client_name: doc.client_name,
            idioma_raiz: doc.idioma_raiz,
            tipo_trad: doc.tipo_trad,

            // ✅ DADOS DE AUTENTICAÇÃO PARA DOCUMENTOS REGULARES
            authenticated_by_name: authData?.authenticated_by_name || doc.authenticated_by_name || null,
            authenticated_by_email: authData?.authenticated_by_email || doc.authenticated_by_email || null,
            authentication_date: authData?.authentication_date || doc.authentication_date || null,
            source_language: doc.idioma_raiz,
            target_language: doc.tipo_trad,

            // Campos obrigatórios da interface
            profiles: doc.profiles,
            documents: {
              filename: doc.filename,
              status: doc.status,
              client_name: doc.client_name,
              idioma_raiz: doc.idioma_raiz,
              tipo_trad: doc.tipo_trad,
              verification_code: doc.verification_code
            },
            pages: doc.pages || 0,
            total_cost: doc.total_cost || 0
          });
        }
      }

      // Combinar ambos os tipos de pagamentos e ordenar por data de criação (mais recente primeiro)
      // para bater com a ordem do Dashboard do Admin
      const documentsWithFinancialData: MappedPayment[] = [...authenticatorPayments, ...regularPayments]
        .sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA; // Decrescente (mais recente primeiro)
        });

      setPayments(documentsWithFinancialData);

    } catch (err) {
      console.error('💥 Error loading payments:', err);
      setError('An unexpected error occurred while loading payments.');
    } finally {
      setLoading(false);
    }
  }, [dateFilter, filterStatus, filterRole]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadPayments();
    } finally {
      setRefreshing(false);
    }
  }, [loadPayments]);

  return {
    payments,
    loading,
    error,
    refreshing,
    refresh
  };
}
