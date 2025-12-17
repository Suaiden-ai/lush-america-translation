import { useState, useEffect, useCallback, useMemo } from 'react';
// Assuming `Document` is defined as a type/interface in App.ts or a shared types file
// For this example, I'll define a minimal Document interface here.
import { supabase } from '../../lib/supabase';
import { Eye, Download, Filter, RefreshCw } from 'lucide-react';
import { DateRange } from '../../components/DateRangeFilter'; // Assuming this path is correct
import { GoogleStyleDatePicker } from '../../components/GoogleStyleDatePicker';
import { DocumentDetailsModal } from './DocumentDetailsModal'; // Assuming this path is correct
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

  // Extended Document interface for the modal
  export interface Document {
    id: string;
    filename: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'deleted';
    file_path?: string;
    user_id?: string;
    created_at?: string;
    // Campos adicionais para o modal
    total_cost?: number;
    pages?: number;
    source_language?: string;
    target_language?: string;
    translation_type?: string;
    bank_statement?: boolean;
    authenticated?: boolean;
    verification_code?: string;
    // Informações do usuário
    user_name?: string;
    user_email?: string;
    user_phone?: string;
    // Tipo de documento
    document_type?: 'authenticator' | 'payment';
    // URL do arquivo traduzido
    translated_file_url?: string;
  }

// Define the structure of the data directly from Supabase join
interface PaymentWithRelations {
  id: string;
  document_id: string;
  user_id: string;
  stripe_session_id: string | null;
  amount: number;
  currency: string;
  status: string; // payment status
  payment_method: string | null;
  payment_date: string | null;
  created_at: string;
  profiles: { email: string | null; name: string | null; role: string | null } | null;
  documents: { 
    filename: string | null; 
    status: Document['status'] | null;
    client_name: string | null;
    idioma_raiz: string | null;
    tipo_trad: string | null;
    verification_code: string | null;
  } | null; // document info from documents table
}

// Define the mapped Payment interface used in the component's state
interface MappedPayment extends PaymentWithRelations {
  user_email: string | null;
  user_name: string | null;
  user_role: string | null; // Role do usuário (user, authenticator, admin, finance)
  client_name: string | null;
  document_filename: string | null;
  document_status: Document['status'] | null; // Adding document status here
  idioma_raiz: string | null;
  tipo_trad: string | null;
  // Authentication info from documents_to_be_verified
  authenticated_by_name: string | null;
  authenticated_by_email: string | null;
  authentication_date: string | null;
  source_language: string | null; // From documents_to_be_verified
  target_language: string | null; // From documents_to_be_verified

}

interface PaymentsTableProps {
  // `documents` prop is removed as it's not directly used here.
  // `onStatusUpdate` and `onViewDocument` props are removed as internal logic handles these.
  initialDateRange?: DateRange; // Renamed to avoid confusion with internal state
}

export function PaymentsTable({ initialDateRange }: PaymentsTableProps) {
  const [payments, setPayments] = useState<MappedPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all'); // payment status filter
  const [filterRole, setFilterRole] = useState<string>('all'); // user role filter
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<DateRange>(initialDateRange || {
    startDate: null,
    endDate: null,
    preset: 'all'
  });
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const itemsPerPage = 10;

  // Date filter is now managed by parent component (FinanceDashboard)

  // Effect to load payments whenever dateFilter, filterStatus, or searchTerm changes
  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPayments([]); // Clear payments on new load

    try {
      console.log('� Loading payments with correct logic...', { dateFilter, filterStatus, searchTerm });

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

      // Buscar dados de pagamentos
      let paymentsQuery = supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });

      // Aplicar filtros de data
      if (startDateParam) {
        paymentsQuery = paymentsQuery.gte('created_at', startDateParam);
      }
      if (endDateParam) {
        paymentsQuery = paymentsQuery.lte('created_at', endDateParam);
      }

      const { data: paymentsData, error: paymentsError } = await paymentsQuery;

      if (paymentsError) {
        console.error('Error loading payments data:', paymentsError);
      }

      // Logs removidos para reduzir poluição
      const refundedPayments = paymentsData?.filter(p => p.status === 'refunded');
      
      if (refundedPayments && refundedPayments.length > 0) {
        // Log removido
      }
      
      // Verificar todos os status únicos
      // Log removido


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
        // 🔍 LOG PARA RASTREAR PROCESSAMENTO DO DOCUMENTO REFUNDED COMO AUTENTICADOR
        if (verifiedDoc.filename === 'relatorio-suaiden-ai_PS7V00.pdf') {
          console.log('🔍 DEBUG - Processing refunded document as authenticator:', {
            id: verifiedDoc.id,
            filename: verifiedDoc.filename,
            user_id: verifiedDoc.user_id,
            status: verifiedDoc.status,
            total_cost: verifiedDoc.total_cost
          });
        }
        const mainDoc = mainDocuments?.find(doc => doc.filename === verifiedDoc.filename);
        
        // 🔍 BUSCAR STATUS REAL DA TABELA PAYMENTS PARA AUTENTICADORES
        // IMPORTANTE: verifiedDoc.id é o ID de documents_to_be_verified
        // O pagamento está vinculado ao document_id original (documents.id), não ao dtbv.id
        // MESMA LÓGICA DO ADMIN DASHBOARD: buscar apenas pelo original_document_id (sem fallback)
        let realStatus = 'completed'; // Default para autenticadores
        let paymentForAuth = null;
        
        // Buscar APENAS pelo original_document_id (sem fallback, igual ao AdminDashboard)
        if (verifiedDoc.original_document_id) {
          paymentForAuth = paymentsData?.find(payment => 
            payment.document_id === verifiedDoc.original_document_id
          );
          
          // 🔍 LOG ESPECÍFICO PARA O DOCUMENTO DA KARINA
          if (verifiedDoc.filename?.includes('0UUWX0') || verifiedDoc.filename?.includes('certidao_de_casamento')) {
            console.log('🔍 DEBUG KARINA - Buscando pagamento:', {
              original_document_id: verifiedDoc.original_document_id,
              dtbv_id: verifiedDoc.id,
              filename: verifiedDoc.filename,
              payments_checked: paymentsData?.filter(p => p.document_id === verifiedDoc.original_document_id).map(p => ({
                id: p.id,
                document_id: p.document_id,
                status: p.status,
                amount: p.amount
              })),
              payment_found: paymentForAuth ? {
                id: paymentForAuth.id,
                document_id: paymentForAuth.document_id,
                status: paymentForAuth.status,
                amount: paymentForAuth.amount
              } : null
            });
          }
        }
        
        // 🔍 LOG ESPECÍFICO PARA O DOCUMENTO DA KARINA
        if (verifiedDoc.filename?.includes('0UUWX0') || verifiedDoc.filename?.includes('certidao_de_casamento')) {
          console.log('🔍 DEBUG KARINA - Processing document:', {
            dtbv_id: verifiedDoc.id,
            original_document_id: verifiedDoc.original_document_id,
            filename: verifiedDoc.filename,
            user_id: verifiedDoc.user_id,
            total_cost: verifiedDoc.total_cost,
            payment_found: !!paymentForAuth,
            payment_status: paymentForAuth?.status,
            all_payments_for_user: paymentsData?.filter(p => p.user_id === verifiedDoc.user_id).map(p => ({
              id: p.id,
              document_id: p.document_id,
              status: p.status,
              amount: p.amount
            }))
          });
        }
        
        if (paymentForAuth) {
          realStatus = paymentForAuth.status;
          console.log('🔍 DEBUG - Found payment for authenticator document:', {
            dtbv_id: verifiedDoc.id,
            original_document_id: verifiedDoc.original_document_id,
            payment_id: paymentForAuth.id,
            payment_document_id: paymentForAuth.document_id,
            real_status: paymentForAuth.status,
            amount: paymentForAuth.amount
          });
        } else {
          // Log removido para reduzir poluição
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
          amount: verifiedDoc.total_cost || 0,
          currency: 'usd',
          status: realStatus, // Usar status real da tabela payments
          payment_method: mainDoc?.payment_method || null, // Para autenticadores, buscar na tabela documents
          payment_date: verifiedDoc.authentication_date || verifiedDoc.created_at,
          created_at: verifiedDoc.created_at,
          
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
          }
        };
      }) || [];

      // Processar documentos de usuários regulares (role: user)
      // Para usuários regulares, o payment_method está na tabela payments
      const regularPayments: MappedPayment[] = [];
      
      // 🔍 LOG PARA VERIFICAR SE O DOCUMENTO REFUNDED ESTÁ SENDO PROCESSADO
      console.log('🔍 DEBUG - Total mainDocuments to process:', mainDocuments?.length || 0);
      const refundedDocument = mainDocuments?.find(doc => doc.id === 'eefae3a4-8a80-4908-a94f-69349106664e');
      console.log('🔍 DEBUG - Refunded document found in mainDocuments:', !!refundedDocument);
      if (refundedDocument) {
        console.log('🔍 DEBUG - Refunded document details:', {
          id: refundedDocument.id,
          filename: refundedDocument.filename,
          user_id: refundedDocument.user_id,
          status: refundedDocument.status,
          total_cost: refundedDocument.total_cost
        });
      }
      
      if (mainDocuments) {
        for (const doc of mainDocuments) {
          // Excluir documentos de uso pessoal (is_internal_use = true)
          if (doc.is_internal_use === true) {
            continue;
          }
          
          // 🔍 LOG PARA RASTREAR PROCESSAMENTO DO DOCUMENTO REFUNDED
          if (doc.id === 'eefae3a4-8a80-4908-a94f-69349106664e') {
            console.log('🔍 DEBUG - Processing refunded document in loop:', {
              id: doc.id,
              filename: doc.filename,
              user_id: doc.user_id,
              status: doc.status
            });
          }
          
          // Verificar se já foi processado como autenticador
          const alreadyProcessed = authenticatorPayments.some(auth => auth.document_filename === doc.filename);
          if (alreadyProcessed) {
            // Log removido
            continue;
          }

          // Buscar pagamento na tabela payments para usuários regulares
          // Tentar primeiro por document_id, depois por user_id
          let paymentInfo = paymentsData?.find(payment => payment.document_id === doc.id);
          if (!paymentInfo) {
            paymentInfo = paymentsData?.find(payment => payment.user_id === doc.user_id);
          }
          
          // 🔍 LOG ESPECÍFICO PARA RASTREAR MATCHING DE PAGAMENTOS
          if (doc.id === 'eefae3a4-8a80-4908-a94f-69349106664e') {
            console.log('🔍 DEBUG - Processing specific document:', {
              document_id: doc.id,
              filename: doc.filename,
              user_id: doc.user_id,
              status: doc.status
            });
            
            console.log('🔍 DEBUG - Looking for payment by document_id:', doc.id);
            const paymentByDocId = paymentsData?.find(payment => payment.document_id === doc.id);
            console.log('🔍 DEBUG - Payment found by document_id:', paymentByDocId);
            
            console.log('🔍 DEBUG - Looking for payment by user_id:', doc.user_id);
            const paymentByUserId = paymentsData?.find(payment => payment.user_id === doc.user_id);
            console.log('🔍 DEBUG - Payment found by user_id:', paymentByUserId);
            
            console.log('🔍 DEBUG - Final paymentInfo selected:', paymentInfo);
            
            // Verificar se o pagamento será incluído
            console.log('🔍 DEBUG - Will be included?', !(!paymentInfo && !doc.total_cost));
            console.log('🔍 DEBUG - Has paymentInfo?', !!paymentInfo);
            console.log('🔍 DEBUG - Has doc.total_cost?', !!doc.total_cost);
          }
          
          
          // Só incluir se tem informação financeira
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
            payment_method: paymentInfo?.payment_method || null, // Para usuários regulares, buscar na tabela payments
            payment_date: paymentInfo?.payment_date || doc.created_at,
            created_at: paymentInfo?.created_at || doc.created_at,
            
            // Dados do usuário
            user_email: doc.profiles?.email || null,
            user_name: doc.profiles?.name || null,
            user_role: doc.profiles?.role || null,
            
            // Dados do documento
            document_filename: doc.filename,
            document_status: doc.status,
            client_name: doc.client_name,
            idioma_raiz: doc.idioma_raiz,
            tipo_trad: doc.tipo_trad,
            
            // ✅ DADOS DE AUTENTICAÇÃO PARA DOCUMENTOS REGULARES
            // Primeiro tentar do regularDocsAuthMap (via translated_documents)
            // Se não encontrar, verificar se há dados diretamente na tabela documents (marcado manualmente)
            authenticated_by_name: regularDocsAuthMap.get(doc.id)?.authenticated_by_name || doc.authenticated_by_name || null,
            authenticated_by_email: regularDocsAuthMap.get(doc.id)?.authenticated_by_email || doc.authenticated_by_email || null,
            authentication_date: regularDocsAuthMap.get(doc.id)?.authentication_date || doc.authentication_date || null,
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
            }
          });
        }
      }

      // Combinar ambos os tipos de pagamentos
      const documentsWithFinancialData: MappedPayment[] = [...authenticatorPayments, ...regularPayments];

      // Log removido
      const refundedInFinalData = documentsWithFinancialData.filter(p => p.status === 'refunded');
      
      if (refundedInFinalData.length > 0) {
        // Log removido
      }
      
      // Logs removidos
      
      setPayments(documentsWithFinancialData);

    } catch (err) {
      console.error('💥 Error loading payments:', err);
      setError('An unexpected error occurred while loading payments.');
    } finally {
      setLoading(false);
    }
  }, [dateFilter, filterStatus, filterRole]); // Removed searchTerm from here, as filtering is done client-side

  useEffect(() => {
    loadPayments();
  }, [loadPayments]); // Rerun effect when `loadPayments` (memoized) changes


  // Manual refresh function
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadPayments();
    } finally {
      setRefreshing(false);
    }
  }, [loadPayments]);

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


  const handleViewDocument = useCallback(async (payment: MappedPayment) => {
    try {
      console.log('🔍 Fetching document for payment:', payment);
      console.log('🔍 Payment method:', payment.payment_method);
      console.log('🔍 Document ID:', payment.document_id);

      // Buscar dados reais do documento
      let documentData: any = null;
      let documentType: 'authenticator' | 'payment' = 'payment';

      // Primeiro tentar buscar na tabela documents para ver se existe
      console.log('💳 Tentando buscar documento na tabela documents primeiro...');
      const { data: documentCheck, error: docCheckError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', payment.document_id)
        .single();

      // Se não encontrou na tabela documents, é documento de autenticador
      if (docCheckError || !documentCheck) {
        console.log('📋 Documento não encontrado na tabela documents, buscando na documents_to_be_verified...');
        documentType = 'authenticator';
        console.log('🔍 Document type detected:', documentType);
        
        const { data: document, error } = await supabase
          .from('documents_to_be_verified')
          .select('*')
          .eq('id', payment.document_id)
          .single();

        if (error) {
          console.error('❌ Error fetching authenticator document:', error);
          // Tentar buscar por filename se falhar por ID
          console.log('🔄 Tentando buscar por filename...');
          const { data: docByFilename, error: filenameError } = await supabase
            .from('documents_to_be_verified')
            .select('*')
            .eq('filename', payment.document_filename)
            .single();
          
          if (filenameError) {
            console.error('❌ Error fetching by filename too:', filenameError);
            return;
          }
          
          documentData = docByFilename;
        } else {
          documentData = document;
        }
      } else {
        // Para pagamentos tradicionais, usar documento já encontrado
        console.log('💳 Usando documento já encontrado na tabela documents');
        console.log('🔍 Document type detected:', documentType);
        documentData = documentCheck;
      }

      if (!documentData) {
        console.error('❌ No document data found');
        return;
      }

      // Buscar informações adicionais do usuário
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', payment.user_id)
        .single();

      // Buscar URL do arquivo traduzido da tabela documents_to_be_verified
      let translatedFileUrl: string | null = null;
      

      
      // Buscar por user_id na tabela documents_to_be_verified
      let { data: translatedDoc, error } = await supabase
        .from('documents_to_be_verified')
        .select('*')
        .eq('user_id', payment.user_id)
        .eq('filename', payment.document_filename)
        .single();
      
      if (error) {
        const { data: docsByUserId, error: userIdError } = await supabase
          .from('documents_to_be_verified')
          .select('*')
          .eq('user_id', payment.user_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (!userIdError && docsByUserId) {
          translatedDoc = docsByUserId;
          error = null;
        }
      }
      
      if (error) {
        console.log('ℹ️ Documento não encontrado na tabela documents_to_be_verified');
      } else {
        console.log('✅ Dados encontrados na documents_to_be_verified:', translatedDoc);
        console.log('✅ Todas as colunas disponíveis:', Object.keys(translatedDoc || {}));
        console.log('✅ translated_file_url encontrado:', translatedDoc?.translated_file_url);
        console.log('✅ file_url encontrado:', translatedDoc?.file_url);
        console.log('✅ file_path encontrado:', translatedDoc?.file_path);
        
        // Tentar diferentes campos possíveis para a URL do arquivo traduzido
        translatedFileUrl = translatedDoc?.translated_file_url || 
                           translatedDoc?.file_url || 
                           translatedDoc?.file_path || 
                           null;
      }

      // Criar um objeto Document completo com todos os dados
      const completeDocument: Document = {
        id: documentData.id,
        filename: documentData.filename || payment.document_filename,
        status: documentData.status,
        file_path: documentData.file_path || documentData.file_url,
        user_id: documentData.user_id || payment.user_id,
        created_at: documentData.created_at || payment.created_at,
        // Campos adicionais para o modal
        total_cost: payment.amount,
        pages: documentData.pages,
        source_language: documentData.source_language || payment.source_language,
        target_language: documentData.target_language || payment.target_language,
        translation_type: payment.payment_method === 'upload' ? documentData.translation_type : payment.tipo_trad,
        bank_statement: documentData.bank_statement,
        authenticated: documentData.authenticated,
        verification_code: documentData.verification_code || payment.documents?.verification_code,
        // Informações do usuário
        user_name: userProfile?.name,
        user_email: userProfile?.email,
        user_phone: userProfile?.phone,
        // Tipo de documento para o modal
        document_type: documentType,
        // URL do arquivo traduzido
        translated_file_url: translatedFileUrl || undefined
      };

      console.log('📄 Complete document prepared for modal:', completeDocument);
      console.log('🔍 Campos importantes:', {
        file_path: completeDocument.file_path,
        translated_file_url: completeDocument.translated_file_url,
        filename: completeDocument.filename
      });
      setSelectedDocument(completeDocument);
      setShowModal(true);
      console.log('✅ Modal opened with complete document data');

    } catch (err) {
      console.error('💥 Error opening document:', err);
      console.error('💥 Error details:', err);
    }
  }, []); // Empty dependency array because supabase and useState setters are stable

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'refunded':
        return 'bg-gray-200 text-gray-800'; // Changed from gray-100 for more contrast
      case 'processing': // For document status
      case 'draft': // For document status
        return 'bg-blue-100 text-blue-800';
      case 'deleted': // For document status
        return 'bg-red-200 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const downloadPaymentsReport = useCallback(async () => {
    // Log básico mantido

    if (filteredPayments.length === 0) {
      alert('Nenhum pagamento encontrado para exportar.');
      return;
    }

    try {
      // Buscar documentos completos para obter total_cost, payment_amount, pages e dados de autenticação
      // Coletar TODOS os documentIds possíveis (incluindo original_document_id quando aplicável)
      const allDocumentIds = new Set<string>();
      filteredPayments.forEach(payment => {
        if (payment.document_id) {
          allDocumentIds.add(payment.document_id);
        }
      });
      
      // Buscar documents_to_be_verified para obter original_document_id quando necessário
      const { data: allVerifiedDocs, error: allVerifiedError } = await supabase
        .from('documents_to_be_verified')
        .select('id, original_document_id')
        .in('id', Array.from(allDocumentIds));
      
      if (!allVerifiedError && allVerifiedDocs) {
        allVerifiedDocs.forEach(dtbv => {
          if (dtbv.original_document_id) {
            allDocumentIds.add(dtbv.original_document_id);
          }
        });
      }
      
      const documentIds = Array.from(allDocumentIds);
      let documentsMap = new Map(); // Mapa: document_id -> { total_cost, pages, original_document_id? }
      let paymentsMap = new Map(); // Mapa: document_id -> payment_amount (valor líquido)
      let authenticationMap = new Map(); // Mapa: document_id -> { authenticated_by_name, authenticated_by_email, authentication_date }
      let verifiedDocsDataForLookup: any[] = []; // Armazenar para uso no lookup
      
      // Log removido - apenas para documentos específicos
      
      if (documentIds.length > 0) {
        // Buscar da tabela documents (incluindo dados de autenticação que podem ter sido marcados manualmente)
        const { data: documentsData, error: docsError } = await supabase
          .from('documents')
          .select('id, total_cost, pages, authenticated_by_name, authenticated_by_email, authentication_date, is_authenticated')
          .in('id', documentIds);
        
        if (!docsError && documentsData) {
          documentsData.forEach(doc => {
            documentsMap.set(doc.id, doc);
            
            // Se o documento tem dados de autenticação diretamente na tabela documents (marcado manualmente)
            // Adicionar ao authenticationMap também
            if (doc.authenticated_by_name || doc.authenticated_by_email || doc.is_authenticated) {
              authenticationMap.set(doc.id, {
                authenticated_by_name: doc.authenticated_by_name,
                authenticated_by_email: doc.authenticated_by_email,
                authentication_date: doc.authentication_date,
                is_authenticated: doc.is_authenticated,
                status: doc.is_authenticated ? 'completed' : null
              });
              
              // Log para documentos específicos
              if (doc.id === 'ba6aaaf4-ea21-4429-b455-a64ae8b27ccd' || doc.id === '0bf7fa13-89a9-431d-8540-8a6cf2b8ef2b') {
                console.log('✅ [GC2GNN/HZBDQR] Dados de autenticação encontrados diretamente na tabela documents:', {
                  document_id: doc.id,
                  authenticated_by_name: doc.authenticated_by_name,
                  authenticated_by_email: doc.authenticated_by_email,
                  authentication_date: doc.authentication_date
                });
              }
            }
          });
        }

        // Buscar também de documents_to_be_verified (para autenticadores)
        // Buscar onde id IN documentIds (quando document_id é dtbv.id)
        const { data: verifiedDocsData, error: verifiedDocsError } = await supabase
          .from('documents_to_be_verified')
          .select('id, total_cost, pages, original_document_id')
          .in('id', documentIds);
        
        if (!verifiedDocsError && verifiedDocsData) {
          verifiedDocsDataForLookup = verifiedDocsData; // Armazenar para uso no lookup
          verifiedDocsData.forEach(doc => {
            documentsMap.set(doc.id, doc);
          });
          
          // Buscar documentos originais para obter total_cost se necessário
          const originalDocIds = verifiedDocsData
            .map(doc => doc.original_document_id)
            .filter(Boolean);
          
          if (originalDocIds.length > 0) {
            const { data: originalDocsData, error: originalDocsError } = await supabase
              .from('documents')
              .select('id, total_cost, pages')
              .in('id', originalDocIds);
            
            if (!originalDocsError && originalDocsData) {
              originalDocsData.forEach(doc => {
                documentsMap.set(doc.id, doc);
              });
            }
          }
        }

        // ✅ BUSCAR DADOS DE AUTENTICAÇÃO DE translated_documents (EXATAMENTE IGUAL AO ADMIN DASHBOARD)
        // Primeiro, buscar os IDs de documents_to_be_verified correspondentes aos documentos
        // Isso busca dtbv que referenciam os documentIds (que podem ser documents.id)
        
        // Log para documentos específicos ANTES da busca
        const specificDocIds = ['ba6aaaf4-ea21-4429-b455-a64ae8b27ccd', '0bf7fa13-89a9-431d-8540-8a6cf2b8ef2b'];
        const specificDocsInList = specificDocIds.filter(id => documentIds.includes(id));
        if (specificDocsInList.length > 0) {
          console.log('🔍 [GC2GNN/HZBDQR] ANTES da busca - documentIds na lista:', specificDocsInList);
        }
        
        const { data: dtbvFullData, error: dtbvFullError } = await supabase
          .from('documents_to_be_verified')
          .select('id, original_document_id')
          .in('original_document_id', documentIds);
        
        // Log para documentos específicos APÓS a busca
        if (specificDocsInList.length > 0 && dtbvFullData) {
          const dtbvForSpecific = dtbvFullData.filter(d => specificDocsInList.includes(d.original_document_id));
          console.log('🔍 [GC2GNN/HZBDQR] dtbv encontrados para esses documentIds:', dtbvForSpecific);
        }
        
        if (!dtbvFullError && dtbvFullData && dtbvFullData.length > 0) {
          // Agora buscar translated_documents usando os IDs de documents_to_be_verified
          const dtbvIds = dtbvFullData.map(d => d.id);
          
          const { data: translatedDocsData, error: translatedDocsError } = await supabase
            .from('translated_documents')
            .select('original_document_id, authenticated_by_name, authenticated_by_email, authentication_date, is_authenticated, status')
            .in('original_document_id', dtbvIds);
          
          if (!translatedDocsError && translatedDocsData) {
            // Criar um mapa auxiliar para relacionar dtbv.id -> dtbv.original_document_id
            const dtbvMap = new Map(dtbvFullData.map(d => [d.id, d.original_document_id]));
            
            // Mapear dados de autenticação: key = document_id (de documents) - IGUAL AO ADMIN DASHBOARD
            translatedDocsData.forEach(td => {
              const dtbvId = td.original_document_id; // ID do documents_to_be_verified
              const originalDocId = dtbvMap.get(dtbvId); // ID do documento original (documents.id)
              
              const authData = {
                authenticated_by_name: td.authenticated_by_name,
                authenticated_by_email: td.authenticated_by_email,
                authentication_date: td.authentication_date,
                is_authenticated: td.is_authenticated,
                status: td.status
              };
              
              // Mapear pelo original_document_id (documents.id) - IGUAL AO ADMIN DASHBOARD
              if (originalDocId) {
                authenticationMap.set(originalDocId, authData);
                // Log para documentos específicos
                if (specificDocsInList.includes(originalDocId)) {
                  console.log('✅ [GC2GNN/HZBDQR] Mapeado authData para documents.id:', originalDocId, '->', authData.authenticated_by_name);
                }
              }
            });
          }
        }

        // ✅ TAMBÉM BUSCAR PARA AUTENTICADORES (quando document_id é o ID do dtbv)
        // Se alguns documentIds são IDs de documents_to_be_verified, buscar diretamente
        if (verifiedDocsData && verifiedDocsData.length > 0) {
          const dtbvIdsFromVerified = verifiedDocsData.map(d => d.id);
          
          if (dtbvIdsFromVerified.length > 0) {
            const { data: translatedDocsForAuth, error: tdForAuthError } = await supabase
              .from('translated_documents')
              .select('original_document_id, authenticated_by_name, authenticated_by_email, authentication_date, is_authenticated, status')
              .in('original_document_id', dtbvIdsFromVerified);
            
            if (!tdForAuthError && translatedDocsForAuth) {
              // Criar mapa auxiliar
              const dtbvMapForAuth = new Map(verifiedDocsData.map(d => [d.id, d.original_document_id]));
              
              translatedDocsForAuth.forEach(td => {
                const dtbvId = td.original_document_id;
                const originalDocId = dtbvMapForAuth.get(dtbvId);
                
                const authData = {
                  authenticated_by_name: td.authenticated_by_name,
                  authenticated_by_email: td.authenticated_by_email,
                  authentication_date: td.authentication_date,
                  is_authenticated: td.is_authenticated,
                  status: td.status
                };
                
                // Mapear pelo dtbv.id (para autenticadores) e pelo original_document_id
                if (dtbvId) {
                  authenticationMap.set(dtbvId, authData);
                }
                if (originalDocId) {
                  authenticationMap.set(originalDocId, authData);
                }
              });
            }
          }
        }
        
        // Log removido - apenas para documentos específicos

        // Buscar payment_amount da tabela payments (sem filtrar por status para pegar todos)
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('payments')
          .select('document_id, amount')
          .in('document_id', documentIds);
        
        if (!paymentsError && paymentsData) {
          paymentsData.forEach(payment => {
            paymentsMap.set(payment.document_id, payment.amount); // Valor líquido recebido
          });
        }

        // Para autenticadores, buscar pagamentos pelo original_document_id
        if (verifiedDocsData) {
          const originalDocIds = verifiedDocsData
            .map(doc => doc.original_document_id)
            .filter(Boolean);
          
          if (originalDocIds.length > 0) {
            const { data: authPaymentsData, error: authPaymentsError } = await supabase
              .from('payments')
              .select('document_id, amount')
              .in('document_id', originalDocIds);
            
            if (!authPaymentsError && authPaymentsData) {
              authPaymentsData.forEach(payment => {
                // Mapear pelo original_document_id
                paymentsMap.set(payment.document_id, payment.amount);
                // Também mapear pelo ID do dtbv para facilitar lookup
                verifiedDocsData.forEach(dtbvDoc => {
                  if (dtbvDoc.original_document_id === payment.document_id) {
                    paymentsMap.set(dtbvDoc.id, payment.amount);
                  }
                });
              });
            }
          }
        }
      }

      // Filtrar pagamentos: excluir refunded/failed, e excluir Luiz como usuário
      // IMPORTANTE: Não filtrar por 'completed' aqui - usar os filtros já aplicados na UI
      const paymentsToExport = filteredPayments.filter(payment => {
        // 1. Excluir pagamentos REFUNDED (reembolsados - não são receita real)
        const paymentStatus = (payment.status || '').toLowerCase();
        if (paymentStatus === 'refunded') {
          return false; // Excluir pagamentos reembolsados
        }
        
        // 2. Excluir pagamentos FAILED
        if (paymentStatus === 'failed') {
          return false; // Excluir pagamentos falhados
        }

        // 3. Excluir apenas documentos onde o Luiz é o USUÁRIO (não o autenticador)
        // O Luiz pode autenticar documentos de outros usuários, isso é permitido
        const userEmail = (payment.user_email || '').toLowerCase();
        const userName = (payment.user_name || '').toLowerCase();

        const isLuizUser = 
          userEmail.includes('luizeduardomcsantos') ||
          userEmail.includes('luizeduardogouveia7') ||
          userName.includes('luiz eduardo');

        // Excluir apenas se o Luiz for o usuário (não o autenticador)
        return !isLuizUser;
      });

      // Log removido - apenas para documentos específicos

      if (paymentsToExport.length === 0) {
        alert('Nenhum pagamento encontrado para exportar.\n\nA exportação exclui:\n• Pagamentos REFUNDED (reembolsados)\n• Pagamentos FAILED (falhados)\n• Pagamentos onde o Luiz é o usuário (não o autenticador)\n\nVerifique os filtros aplicados.');
        return;
      }

      // Obter informações do período de data para incluir no arquivo
      const formatDateForFileName = (date: Date | null) => {
        if (!date) return null;
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };

      const startDateStr = formatDateForFileName(dateFilter?.startDate);
      const endDateStr = formatDateForFileName(dateFilter?.endDate);
      const hasDateFilter = startDateStr || endDateStr;

      // Criar um novo workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Payments');

      // Adicionar informações do período exportado como primeira linha (antes dos cabeçalhos)
      if (hasDateFilter) {
        const periodInfo = startDateStr && endDateStr
          ? `Período: ${startDateStr} até ${endDateStr}`
          : startDateStr
          ? `A partir de: ${startDateStr}`
          : `Até: ${endDateStr}`;
        
        worksheet.insertRow(1, [periodInfo]);
        const infoRow = worksheet.getRow(1);
        infoRow.font = { bold: true, size: 12, color: { argb: 'FF4472C4' } };
        infoRow.height = 20;
        
        // Adicionar linha em branco
        worksheet.insertRow(2, []);
      }

      // Definir colunas com larguras e formatação (apenas as colunas necessárias - EXATAMENTE IGUAL AO ADMIN)
      worksheet.columns = [
        { header: 'Document Name', key: 'documentName', width: 30 },
        { header: 'User Name', key: 'userName', width: 20 },
        { header: 'User Email', key: 'userEmail', width: 25 },
        { header: 'Translation Status', key: 'translationStatus', width: 18 },
        { header: 'Pages', key: 'pages', width: 8 },
        { header: 'Amount', key: 'amount', width: 12 },
        { header: 'Tax', key: 'tax', width: 12 },
        { header: 'Net Value', key: 'netValue', width: 12 },
        { header: 'Payment Method', key: 'paymentMethod', width: 15 },
        { header: 'Payment Status', key: 'paymentStatus', width: 15 },
        { header: 'Authenticator Name', key: 'authenticatorName', width: 20 },
        { header: 'Authentication Date', key: 'authenticationDate', width: 20 },
        { header: 'Payment Date', key: 'paymentDate', width: 20 },
      ];

      // Mesclar células da linha de informações de período (se existir)
      if (hasDateFilter) {
        const infoRow = worksheet.getRow(1);
        // Mesclar todas as 13 colunas
        worksheet.mergeCells(1, 1, 1, 13);
        infoRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
      }

      // Estilizar cabeçalhos (ajustar número da linha se tiver informações de período)
      const headerRowNumber = hasDateFilter ? 3 : 1;
      const headerRow = worksheet.getRow(headerRowNumber);
      
      // Garantir que os cabeçalhos estejam explicitamente definidos
      const headers = [
        'Document Name', 'User Name', 'User Email', 'Translation Status', 'Pages',
        'Amount', 'Tax', 'Net Value',
        'Payment Method', 'Payment Status',
        'Authenticator Name', 'Authentication Date', 'Payment Date'
      ];
      headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = header;
      });
      
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' } // Azul
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      headerRow.height = 25; // Altura maior para melhor legibilidade

      // Função auxiliar para formatar datas de forma segura
      const formatDateSafely = (dateValue: string | Date | null | undefined): string => {
        if (!dateValue) return '';
        try {
          const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
          if (isNaN(date.getTime())) return ''; // Data inválida
          return date.toLocaleString('pt-BR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
        } catch (error) {
          console.warn('Erro ao formatar data:', dateValue, error);
          return '';
        }
      };

      // Função auxiliar para garantir valores numéricos válidos
      const safeNumber = (value: any, defaultValue: number = 0): number => {
        if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
          return value;
        }
        return defaultValue;
      };

      // Adicionar dados (já filtrados, sem registros do Luiz)
      paymentsToExport.forEach((payment) => {
        // Buscar dados do documento para obter total_cost, payment_amount e pages
        const docData = documentsMap.get(payment.document_id);
        
        // Para autenticadores: payment.document_id é o ID do dtbv
        // O pagamento está vinculado ao original_document_id (tabela documents)
        let totalCost = docData?.total_cost || 0;
        let netValue = 0;
        
        // Buscar payment_amount da tabela payments
        // Primeiro tentar pelo document_id direto (para usuários regulares)
        netValue = paymentsMap.get(payment.document_id) || 0;
        
        // Se não encontrou, pode ser autenticador - buscar pelo original_document_id
        if (netValue === 0 && docData?.original_document_id) {
          netValue = paymentsMap.get(docData.original_document_id) || 0;
          // Se encontrou pelo original_document_id, buscar total_cost do documento original também
          if (netValue > 0) {
            const originalDocData = documentsMap.get(docData.original_document_id);
            if (originalDocData?.total_cost) {
              totalCost = originalDocData.total_cost;
            }
          }
        }
        
        // Se ainda não encontrou netValue, usar o amount do payment como fallback
        if (netValue === 0) {
          netValue = payment.amount || 0;
        }
        
        // Se total_cost não foi encontrado, usar netValue como fallback
        // (para pagamentos sem taxa Stripe, total_cost = netValue)
        if (totalCost === 0) {
          totalCost = netValue || payment.amount || 0;
        }
        
        // Calcular valores: Amount (bruto), Tax (taxa Stripe), Net Value (líquido)
        // EXATAMENTE IGUAL AO ADMIN DASHBOARD
        const amount = totalCost; // Valor bruto que o cliente pagou
        const netValueFinal = netValue; // Valor líquido recebido
        const tax = amount - netValueFinal; // Taxa do Stripe
        
        const pages = docData?.pages || 0;

        // Determinar translation_status (usar document_status como base)
        const translationStatus = payment.document_status || 'pending';

        // ✅ BUSCAR DADOS DE AUTENTICAÇÃO (EXATAMENTE IGUAL AO ADMIN DASHBOARD)
        // Buscar diretamente usando o ID do documento (já mapeado corretamente)
        // No admin dashboard: authenticationMap.get(doc.id) onde doc.id é documents.id
        let authData = null;
        
        // Tentar múltiplas chaves para garantir que encontramos os dados
        // 1. Tentar pelo document_id direto (pode ser documents.id ou dtbv.id)
        authData = authenticationMap.get(payment.document_id);
        
        // 2. Se não encontrou e temos original_document_id, tentar por ele (documents.id)
        if (!authData && docData?.original_document_id) {
          authData = authenticationMap.get(docData.original_document_id);
        }
        
        // 3. Se ainda não encontrou, pode ser que payment.document_id seja dtbv.id
        // Nesse caso, precisamos buscar o original_document_id do dtbv
        if (!authData && verifiedDocsDataForLookup.length > 0) {
          const dtbvDoc = verifiedDocsDataForLookup.find(d => d.id === payment.document_id);
          if (dtbvDoc?.original_document_id) {
            authData = authenticationMap.get(dtbvDoc.original_document_id);
          }
        }
        
        // 4. Se ainda não encontrou, verificar se há dados diretamente na tabela documents (marcado manualmente)
        // Isso é para documentos que foram autenticados fora da plataforma mas têm dados marcados manualmente
        if (!authData && docData && (docData.authenticated_by_name || docData.authenticated_by_email || docData.is_authenticated)) {
          authData = {
            authenticated_by_name: docData.authenticated_by_name,
            authenticated_by_email: docData.authenticated_by_email,
            authentication_date: docData.authentication_date,
            is_authenticated: docData.is_authenticated,
            status: docData.is_authenticated ? 'completed' : null
          };
          
          // Log para documentos específicos
          if (payment.document_filename && (payment.document_filename.includes('GC2GNN') || payment.document_filename.includes('HZBDQR'))) {
            console.log('✅ [GC2GNN/HZBDQR] Dados de autenticação encontrados diretamente na tabela documents (marcado manualmente):', authData);
          }
        }
        
        // Debug detalhado para os dois documentos específicos
        if (payment.document_filename && (payment.document_filename.includes('GC2GNN') || payment.document_filename.includes('HZBDQR'))) {
          const dtbvDocForDebug = verifiedDocsDataForLookup.find(d => d.id === payment.document_id);
          const authFromPaymentDocId = authenticationMap.get(payment.document_id);
          const authFromDocDataOriginal = docData?.original_document_id ? authenticationMap.get(docData.original_document_id) : null;
          const authFromDtbvOriginal = dtbvDocForDebug?.original_document_id 
            ? authenticationMap.get(dtbvDocForDebug.original_document_id) 
            : null;
          
          // Verificar se o document_id está na lista de documentIds coletados
          const isInDocumentIds = documentIds.includes(payment.document_id);
          
          console.log('🔍 [GC2GNN/HZBDQR] ===== DEBUG COMPLETO =====');
          console.log('📄 Document:', payment.document_filename);
          console.log('🆔 payment.document_id:', payment.document_id);
          console.log('❓ document_id está na lista de documentIds coletados?', isInDocumentIds);
          console.log('📋 docData:', docData ? { id: docData.id, original_document_id: docData.original_document_id } : 'null');
          console.log('📋 dtbvDocForDebug:', dtbvDocForDebug ? { id: dtbvDocForDebug.id, original_document_id: dtbvDocForDebug.original_document_id } : 'null');
          console.log('🔑 Tentativa 1 - authData_from_payment.document_id:', authFromPaymentDocId);
          console.log('🔑 Tentativa 2 - authData_from_docData.original_document_id:', authFromDocDataOriginal);
          console.log('🔑 Tentativa 3 - authData_from_dtbv.original_document_id:', authFromDtbvOriginal);
          console.log('💾 payment.authenticated_by_name:', payment.authenticated_by_name);
          console.log('💾 payment.authenticated_by_email:', payment.authenticated_by_email);
          console.log('💾 payment.authentication_date:', payment.authentication_date);
          console.log('📋 docData.authenticated_by_name (direto da tabela):', docData?.authenticated_by_name);
          console.log('📋 docData.authenticated_by_email (direto da tabela):', docData?.authenticated_by_email);
          console.log('📋 docData.authentication_date (direto da tabela):', docData?.authentication_date);
          console.log('✅ authData encontrado ANTES do fallback:', authData);
          console.log('📊 authenticationMap tem', authenticationMap.size, 'chaves');
          console.log('🔍 [GC2GNN/HZBDQR] ===== FIM DEBUG =====');
        }
        
        // 4. Se ainda não encontrou, usar dados do payment (pode ter vindo do loadPayments)
        if (!authData && (payment.authenticated_by_name || payment.authenticated_by_email)) {
          authData = {
            authenticated_by_name: payment.authenticated_by_name,
            authenticated_by_email: payment.authenticated_by_email,
            authentication_date: payment.authentication_date
          };
          
          // Log para documentos específicos quando usa dados do payment
          if (payment.document_filename && (payment.document_filename.includes('GC2GNN') || payment.document_filename.includes('HZBDQR'))) {
            console.log('✅ [GC2GNN/HZBDQR] Usando dados do payment (fallback):');
            console.log('  - authenticated_by_name:', payment.authenticated_by_name);
            console.log('  - authenticated_by_email:', payment.authenticated_by_email);
            console.log('  - authentication_date:', payment.authentication_date);
            console.log('✅ authData FINAL após fallback:', authData);
          }
        }
        
        const authenticatedByName = authData?.authenticated_by_name || '';
        const authenticatedByEmail = authData?.authenticated_by_email || '';
        const authenticationDate = authData?.authentication_date || null;

        // Log final para documentos específicos
        if (payment.document_filename && (payment.document_filename.includes('GC2GNN') || payment.document_filename.includes('HZBDQR'))) {
          console.log('📝 [GC2GNN/HZBDQR] Dados FINAIS que serão exportados:');
          console.log('  - authenticatorName:', authenticatedByName);
          console.log('  - authenticatorEmail:', authenticatedByEmail);
          console.log('  - authenticationDate:', authenticationDate);
        }

        worksheet.addRow({
          documentName: String(payment.document_filename || ''),
          userName: String(payment.user_name || ''),
          userEmail: String(payment.user_email || ''),
          translationStatus: String(translationStatus),
          pages: safeNumber(pages, 0),
          amount: safeNumber(amount, 0), // Amount - Valor total que o cliente pagou
          tax: safeNumber(tax, 0), // Tax - Taxa do Stripe
          netValue: safeNumber(netValueFinal, 0), // Net Value - Valor líquido recebido
          paymentMethod: String(payment.payment_method || ''),
          paymentStatus: String(payment.status || ''),
          authenticatorName: String(authenticatedByName),
          authenticationDate: formatDateSafely(authenticationDate),
          paymentDate: formatDateSafely(payment.payment_date || payment.created_at) // Usar created_at como fallback se payment_date não existir
        });
      });

      // Formatar colunas numéricas
      const amountColumn = worksheet.getColumn('amount');
      const taxColumn = worksheet.getColumn('tax');
      const netValueColumn = worksheet.getColumn('netValue');
      const pagesColumn = worksheet.getColumn('pages');

      amountColumn.numFmt = '$#,##0.00';
      taxColumn.numFmt = '$#,##0.00';
      netValueColumn.numFmt = '$#,##0.00';
      pagesColumn.numFmt = '0';

      // Aplicar formatação condicional para status de pagamento e melhorar espaçamento
      const dataStartRow = hasDateFilter ? 4 : 2; // Linha onde começam os dados (após período, linha em branco e cabeçalho)
      worksheet.eachRow((row, rowNumber) => {
        // Pular linhas de informação de período, linha em branco e cabeçalho
        if (rowNumber < dataStartRow) return;

        // Definir altura mínima das linhas para melhor legibilidade
        row.height = 18;

        const paymentStatusCell = row.getCell('paymentStatus');
        const paymentStatus = paymentStatusCell.value?.toString().toLowerCase();

        // Colorir células de status de pagamento
        if (paymentStatus === 'completed') {
          paymentStatusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFC6EFCE' } // Verde claro
          };
        } else if (paymentStatus === 'pending' || paymentStatus === 'pending_verification') {
          paymentStatusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFEB9C' } // Amarelo claro
          };
        } else if (paymentStatus === 'failed') {
          paymentStatusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFC7CE' } // Vermelho claro
          };
        } else if (paymentStatus === 'refunded') {
          paymentStatusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' } // Cinza claro
          };
        }

        // Configurar alinhamento e wrap text para todas as células
        row.eachCell((cell) => {
          const columnKey = cell.column?.key || '';
          
          // Alinhamento específico por tipo de coluna
          if (columnKey === 'pages') {
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          } else if (columnKey === 'amount' || columnKey === 'tax' || columnKey === 'netValue') {
            cell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true };
          } else {
            cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
          }
        });
      });

      // Congelar linha do cabeçalho (ajustar se tiver informações de período)
      const freezeRow = hasDateFilter ? 3 : 1;
      worksheet.views = [{ state: 'frozen', ySplit: freezeRow }];

      // Adicionar filtros automáticos (ajustar linha do cabeçalho)
      worksheet.autoFilter = {
        from: { row: freezeRow, column: 1 },
        to: { row: freezeRow, column: 13 } // 13 colunas no total
      };

      // Função para calcular largura automática das colunas baseada no conteúdo
      const calculateColumnWidth = (column: ExcelJS.Column, minWidth: number = 10, maxWidth: number = 60) => {
        let maxLength = 0;
        
        // Verificar largura do cabeçalho (ajustar se tiver informações de período)
        const headerRowNumber = hasDateFilter ? 3 : 1;
        const headerCell = worksheet.getRow(headerRowNumber).getCell(column.number);
        if (headerCell.value) {
          const headerLength = String(headerCell.value).length;
          maxLength = Math.max(maxLength, headerLength);
        }

        // Verificar largura de todas as células da coluna
        worksheet.eachRow((row, rowNumber) => {
          const dataStartRow = hasDateFilter ? 4 : 2; // Ajustar para pular período, linha em branco e cabeçalho
          if (rowNumber < dataStartRow) return;
          
          try {
            const cell = row.getCell(column.number);
            if (cell && cell.value !== null && cell.value !== undefined) {
              let cellLength = 0;
              
              // Calcular comprimento baseado no tipo de dado
              if (typeof cell.value === 'number') {
                // Para números, considerar o formato (ex: $1,234.56)
                if (isNaN(cell.value) || !isFinite(cell.value)) {
                  cellLength = 10; // Valor padrão para NaN/Infinity
                } else {
                  cellLength = String(cell.value).length + 3;
                }
              } else if (cell.value instanceof Date) {
                // Para datas, considerar formato brasileiro
                if (isNaN(cell.value.getTime())) {
                  cellLength = 10; // Data inválida
                } else {
                  cellLength = cell.value.toLocaleString('pt-BR').length;
                }
              } else {
                // Para strings, usar o comprimento direto
                cellLength = String(cell.value).length;
              }
              
              maxLength = Math.max(maxLength, cellLength);
            }
          } catch (error) {
            console.warn(`Erro ao calcular largura da coluna ${column.number}, linha ${rowNumber}:`, error);
          }
        });

        // Aplicar padding extra (1.2x para espaçamento) e limitar entre min e max
        const calculatedWidth = Math.min(Math.max(maxLength * 1.2, minWidth), maxWidth);
        column.width = calculatedWidth;
      };

      // Aplicar auto-ajuste para todas as colunas
      worksheet.columns.forEach((column) => {
        if (column && column.number) {
          // Definir larguras mínimas e máximas específicas por tipo de coluna
          let minWidth = 10;
          let maxWidth = 60;

          // Ajustar limites baseado no tipo de coluna
          const columnKey = column.key || '';
          if (columnKey === 'documentName' || columnKey === 'documentId') {
            minWidth = 20;
            maxWidth = 80; // Nomes de arquivos podem ser longos
          } else if (columnKey === 'userEmail' || columnKey === 'authenticatorEmail') {
            minWidth = 25;
            maxWidth = 50; // Emails podem ser longos
          } else if (columnKey === 'userName' || columnKey === 'authenticatorName' || columnKey === 'clientName') {
            minWidth = 15;
            maxWidth = 40; // Nomes podem variar
          } else if (columnKey === 'authenticationDate' || columnKey === 'paymentDate') {
            minWidth = 18;
            maxWidth = 25; // Datas têm tamanho fixo
          } else if (columnKey === 'amount' || columnKey === 'tax' || columnKey === 'netValue') {
            minWidth = 12;
            maxWidth = 18; // Valores monetários
          } else if (columnKey === 'pages') {
            minWidth = 8;
            maxWidth = 10; // Números pequenos
          }

          calculateColumnWidth(column, minWidth, maxWidth);
        }
      });

      // Ajustar padding das células e adicionar bordas para melhor separação visual
      const borderStartRow = hasDateFilter ? 4 : 2; // Linha onde começam os dados
      worksheet.eachRow((row, rowNumber) => {
        // Pular linhas de informação de período, linha em branco e cabeçalho
        if (rowNumber < borderStartRow) return;

        row.eachCell((cell) => {
          try {
            // Garantir que todas as células tenham wrapText e alinhamento vertical
            if (cell.alignment) {
              cell.alignment = { ...cell.alignment, vertical: 'middle', wrapText: true };
            } else {
              cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            }

            // Adicionar bordas sutis para melhor separação
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
            };
          } catch (error) {
            console.warn(`Erro ao formatar célula na linha ${rowNumber}:`, error);
          }
        });
      });

      // Gerar buffer e fazer download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      // Gerar nome do arquivo com período de data (se aplicável)
      let fileName = 'payments-report';
      if (hasDateFilter) {
        if (startDateStr && endDateStr) {
          fileName = `payments-report-${startDateStr}_to_${endDateStr}`;
        } else if (startDateStr) {
          fileName = `payments-report-from-${startDateStr}`;
        } else if (endDateStr) {
          fileName = `payments-report-until-${endDateStr}`;
        }
      } else {
        fileName = `payments-report-${new Date().toISOString().split('T')[0]}`;
      }
      fileName += '.xlsx';

      saveAs(blob, fileName);

      // Log silencioso (sem alerta de confirmação)
      console.log(`✅ Exportação concluída! ${paymentsToExport.length} pagamento(s) exportado(s). Arquivo: ${fileName}`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Erro ao exportar para Excel. Por favor, tente novamente.');
    }
  }, [filteredPayments, dateFilter, searchTerm, filterStatus, filterRole]); // Depend on filteredPayments and filters to export current view

  return (
    <div className="bg-white rounded-lg shadow w-full">
      <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h3 className="text-base sm:text-lg font-medium text-gray-900">Payments</h3>
            <p className="text-sm text-gray-500">Track all payment transactions</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Refresh payments data"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={downloadPaymentsReport}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" // Changed ring color
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
      <div className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gray-50">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
          {/* Search */}
          <div className="sm:col-span-2">
            <input
              type="text"
              placeholder="Search by name, email, filename, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm bg-white" // Changed ring color
              aria-label="Search payments"
            />
          </div>

          {/* Status Filter (Payment Status) */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400 hidden sm:block" aria-hidden="true" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm" // Changed ring color
              aria-label="Filter by payment status"
            >
              <option value="all">All Payment Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          {/* Role Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400 hidden sm:block" aria-hidden="true" />
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              aria-label="Filter by user role"
            >
              <option value="all">All User Roles</option>
              <option value="user">User</option>
              <option value="authenticator">Authenticator</option>
            </select>
          </div>

          {/* Google Style Date Range Filter */}
          <GoogleStyleDatePicker
            dateRange={dateFilter}
            onDateRangeChange={setDateFilter}
            className="w-full"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-6">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => ( // More rows for better loading UX
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
            {paginatedPayments.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-500">
                No payments found matching your criteria.
              </div>
            ) : (
              <div className="space-y-3 p-3 sm:p-4">
                {paginatedPayments.map((payment) => (
                  <div key={payment.id} className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {payment.user_role === 'authenticator' && payment.client_name && payment.client_name !== 'Cliente Padrão'
                            ? `${payment.client_name} (${payment.user_name})`
                            : payment.authenticated_by_name && payment.client_name && payment.client_name !== 'Cliente Padrão'
                            ? `${payment.client_name} (${payment.authenticated_by_name})`
                            : payment.user_name || 'Unknown'
                          }
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {payment.user_email || 'No email'}
                        </div>

                      </div>
                      <div className="ml-2 flex-shrink-0">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(payment.status)}`}>
                          {payment.status}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-gray-500">Amount:</span>
                        <div className="font-medium text-gray-900">${payment.amount.toFixed(2)} {payment.currency}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Document:</span>
                        <div className="font-medium text-gray-900 truncate">{payment.document_filename || 'Unknown'}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Doc Status:</span> {/* Added document status */}
                        <div className="font-medium text-gray-900">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(payment.document_status)}`}>
                            {payment.document_status}
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">Payment Method:</span>
                        <div className="font-medium text-gray-900">
                          {payment.payment_method ? (
                            payment.payment_method === 'card' ? '💳 Card' :
                              payment.payment_method === 'stripe' ? '💳 Stripe' :
                              payment.payment_method === 'bank_transfer' ? '🏦 Bank' :
                              payment.payment_method === 'transfer' ? '🏦 Bank' :
                              payment.payment_method === 'zelle' ? '💰 Zelle' :
                              payment.payment_method === 'cash' ? '💵 Cash' :
                              payment.payment_method === 'paypal' ? '📱 PayPal' :
                              payment.payment_method === 'upload' ? '📋 Upload' :
                              payment.payment_method === 'other' ? '🔧 Other' :
                                payment.payment_method
                          ) : 'N/A'}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">Authenticator:</span>
                        <div className="font-medium text-gray-900 truncate">
                          {payment.authenticated_by_name || 'N/A'}
                        </div>
                      </div>

                      <div>
                        <span className="text-gray-500">Date:</span>
                        <div className="font-medium text-gray-900">
                          {payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : '-'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-300 flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        ID: {payment.id.substring(0, 8)}...
                      </div>
                      <button
                        onClick={() => handleViewDocument(payment)}
                        className="text-blue-600 hover:text-blue-900" // Changed color
                        aria-label={`Details for document ${payment.document_filename}`}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desktop: Table View */}
          <div className="hidden sm:block overflow-x-auto w-full relative">
            <div className="absolute top-0 right-0 bg-gradient-to-l from-white to-transparent w-8 h-full pointer-events-none z-10"></div>
            <table 
              className="min-w-full divide-y divide-gray-200" 
              style={{ 
                minWidth: '100%', 
                tableLayout: 'fixed',
                width: '100%'
              }}
            >
              <colgroup>
                <col style={{ width: '25%', minWidth: '25%', maxWidth: '25%' }} />
                <col style={{ width: '23%', minWidth: '23%', maxWidth: '23%' }} />
                <col style={{ width: '6%', minWidth: '6%', maxWidth: '6%' }} />
                <col style={{ width: '7%', minWidth: '7%', maxWidth: '7%' }} />
                <col style={{ width: '6%', minWidth: '6%', maxWidth: '6%' }} />
                <col style={{ width: '7%', minWidth: '7%', maxWidth: '7%' }} />
                <col style={{ width: '16%', minWidth: '16%', maxWidth: '16%' }} />
                <col style={{ width: '5%', minWidth: '5%', maxWidth: '5%' }} />
                <col style={{ width: '5%', minWidth: '5%', maxWidth: '5%' }} />
              </colgroup>
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    USER/CLIENT
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Document
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment Method
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Translations
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Authenticator
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedPayments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                      No payments found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-2 py-4">
                        <div className="text-sm font-medium text-gray-900 truncate" title={payment.user_role === 'authenticator' && payment.client_name && payment.client_name !== 'Cliente Padrão'
                            ? `${payment.client_name} (${payment.user_name})`
                            : payment.authenticated_by_name && payment.client_name && payment.client_name !== 'Cliente Padrão'
                            ? `${payment.client_name} (${payment.authenticated_by_name})`
                            : payment.user_name || 'Unknown'}>
                          {payment.user_role === 'authenticator' && payment.client_name && payment.client_name !== 'Cliente Padrão'
                            ? `${payment.client_name} (${payment.user_name})`
                            : payment.authenticated_by_name && payment.client_name && payment.client_name !== 'Cliente Padrão'
                            ? `${payment.client_name} (${payment.authenticated_by_name})`
                            : payment.user_name || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500 truncate" title={payment.user_email || 'No email'}>
                          {payment.user_email || 'No email'}
                        </div>
                      </td>
                      <td className="px-2 py-4">
                        <div className="text-sm text-gray-900 truncate" title={payment.document_filename || 'Unknown'}>
                          {payment.document_filename || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {payment.document_id ? `${payment.document_id.substring(0, 8)}...` : 'No ID'}
                        </div>
                      </td>
                      <td className="px-2 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          ${payment.amount.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {payment.currency}
                        </div>
                      </td>
                      <td className="px-2 py-4">
                        <div className="text-xs text-gray-900">
                          {payment.payment_method ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                              {payment.payment_method === 'card' ? '💳 Card' :
                                payment.payment_method === 'stripe' ? '💳 Stripe' :
                                payment.payment_method === 'bank_transfer' ? '🏦 Bank' :
                                payment.payment_method === 'transfer' ? '🏦 Bank' :
                                payment.payment_method === 'zelle' ? '💰 Zelle' :
                                payment.payment_method === 'cash' ? '💵 Cash' :
                                payment.payment_method === 'paypal' ? '📱 PayPal' :
                                payment.payment_method === 'upload' ? '📋 Upload' :
                                payment.payment_method === 'other' ? '🔧 Other' :
                                  payment.payment_method}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">N/A</span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-4">
                        <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(payment.status)}`}>
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-2 py-4">
                        <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(payment.document_status)}`}>
                          {payment.document_status}
                        </span>
                      </td>
                      <td className="px-2 py-4">
                        <div className="text-sm text-gray-900 truncate" title={payment.authenticated_by_name || 'N/A'}>
                          {payment.authenticated_by_name || 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {payment.authenticated_by_email || 'No auth'}
                        </div>
                      </td>
                      <td className="px-2 py-4 text-sm text-gray-900">
                        {(() => {
                          // Tentar diferentes campos de data em ordem de prioridade
                          const dateToShow = payment.payment_date || 
                                           payment.authentication_date || 
                                           payment.created_at;
                          
                          if (dateToShow) {
                            try {
                              return new Date(dateToShow).toLocaleDateString('pt-BR', { 
                                day: '2-digit', 
                                month: '2-digit' 
                              });
                            } catch (error) {
                              console.error('Error formatting date:', error);
                              return '-';
                            }
                          }
                          return '-';
                        })()}
                      </td>
                      <td className="px-2 py-4 text-sm font-medium">
                        <button
                          onClick={() => handleViewDocument(payment)}
                          className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                          title={`Details for document ${payment.document_filename}`}
                          aria-label={`Details for document ${payment.document_filename}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredPayments.length > 0 && (
            <div className="px-3 sm:px-4 lg:px-6 py-3 border-t border-gray-200 bg-gray-50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-gray-500">
                <span>
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredPayments.length)} of {filteredPayments.length} payments
                  {filteredPayments.length !== payments.length && ` (filtered from ${payments.length} total)`}
                </span>
                <span className="font-medium text-green-600">Total: ${filteredPayments
                  .filter(p => p.status !== 'refunded' && p.status !== 'cancelled')
                  .reduce((sum, p) => sum + p.amount, 0).toFixed(2)}</span>
              </div>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-3 py-1 text-sm border rounded-md ${
                              currentPage === pageNum
                                ? 'bg-blue-500 text-white border-blue-500'
                                : 'border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                  
                  <div className="text-sm text-gray-500">
                    Page {currentPage} of {totalPages}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Document Details Modal */}
      {showModal && selectedDocument && (
        <DocumentDetailsModal
          document={selectedDocument as any}
          onClose={() => {
            setShowModal(false);
            setSelectedDocument(null);
          }}
        />
      )}
    </div>
  );
}