import { useState, useEffect, useCallback, useMemo } from 'react';
import { FileText, Eye, Download, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Document } from '../../App';
import { DateRange } from '../../components/DateRangeFilter';
import { GoogleStyleDatePicker } from '../../components/GoogleStyleDatePicker';
import { formatDate } from '../../utils/dateUtils';
import { useI18n } from '../../contexts/I18nContext';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// Interface estendida para incluir dados de tabelas relacionadas
interface ExtendedDocument extends Omit<Document, 'client_name' | 'payment_method'> {
  user_name?: string;
  user_email?: string;
  user_phone?: string;
  document_type?: 'regular' | 'verified';
  authenticated_by_name?: string;
  authenticated_by_email?: string;
  authentication_date?: string;
  source_language?: string;
  target_language?: string;
  payment_method?: string | null;
  payment_status?: string | null;
  payment_amount?: number | null;
  payment_amount_total?: number | null;
  payment_date?: string | null;
  translation_status?: string | null; // ✅ NOVO CAMPO para status da tradução
  client_name?: string | null;
  display_name?: string | null; // Nome formatado para exibição na coluna USER/CLIENT
  user_role?: string | null; // Role do usuário para filtros
}

// Propriedades do componente
interface DocumentsTableProps {
  documents: Document[]; // Mantido para conformidade, embora os dados sejam buscados internamente
  onViewDocument: (document: Document) => void;
  dateRange?: DateRange;
  onDateRangeChange?: (dateRange: DateRange) => void;
}

export function DocumentsTable({ onViewDocument, dateRange, onDateRangeChange }: DocumentsTableProps) {
  const { t } = useI18n();
  const [extendedDocuments, setExtendedDocuments] = useState<ExtendedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
  const [internalDateRange, setInternalDateRange] = useState<DateRange>(dateRange || {
    startDate: null,
    endDate: null,
    preset: 'all'
  });

  // ✅ Função simplificada com JOIN direto (reversão para query original)
  const loadExtendedDocuments = useCallback(async () => {
    setLoading(true);
    try {
      // Aplicar filtros de data se fornecidos
      let startDateParam = null;
      let endDateParam = null;

      if (internalDateRange?.startDate) {
        const startDate = new Date(internalDateRange.startDate);
        startDate.setHours(0, 0, 0, 0);
        startDateParam = startDate.toISOString();
      }

      if (internalDateRange?.endDate) {
        const endDate = new Date(internalDateRange.endDate);
        endDate.setHours(23, 59, 59, 999);
        endDateParam = endDate.toISOString();
      }

      // ✅ QUERY CORRIGIDA PARA INCLUIR DADOS DE DOCUMENTS_TO_BE_VERIFIED
      // Excluir documentos de uso pessoal (is_internal_use = true) das estatísticas
      let query = supabase
        .from('documents')
        .select(`
          *,
          profiles!documents_user_id_fkey(name, email, phone, role),
          payments!payments_document_id_fkey(payment_method, status, amount, currency)
        `)
        .or('is_internal_use.is.null,is_internal_use.eq.false')
        .order('created_at', { ascending: false });

      // Aplicar filtros de data
      if (startDateParam) {
        query = query.gte('created_at', startDateParam);
      }
      if (endDateParam) {
        query = query.lte('created_at', endDateParam);
      }

      const { data: documents, error } = await query;

      if (error) {
        console.error('Error loading documents:', error);
        return;
      }

      console.log('🔍 DEBUG - Documents loaded:', documents?.length || 0);
      console.log('🔍 DEBUG - Sample documents:', documents?.slice(0, 3));

      // ✅ BUSCAR DADOS DE DOCUMENTS_TO_BE_VERIFIED E TRANSLATED_DOCUMENTS SEPARADAMENTE
      const documentIds = documents?.map(doc => doc.id) || [];
      let documentsToBeVerified: any[] = [];
      let translatedDocuments: any[] = [];

      if (documentIds.length > 0) {
        // Buscar dados de documents_to_be_verified
        const { data: dtbvData, error: dtbvError } = await supabase
          .from('documents_to_be_verified')
          .select('original_document_id, translation_status')
          .in('original_document_id', documentIds);

        if (dtbvError) {
          console.error('Error loading documents_to_be_verified:', dtbvError);
        } else {
          documentsToBeVerified = dtbvData || [];
        }

        // ✅ BUSCAR DADOS DE AUTENTICAÇÃO DE translated_documents
        // Primeiro, buscar os IDs de documents_to_be_verified correspondentes aos documentos
        const { data: dtbvFullData, error: dtbvFullError } = await supabase
          .from('documents_to_be_verified')
          .select('id, original_document_id')
          .in('original_document_id', documentIds);

        if (dtbvFullError) {
          console.error('Error loading full documents_to_be_verified:', dtbvFullError);
        } else if (dtbvFullData && dtbvFullData.length > 0) {
          // Agora buscar translated_documents usando os IDs de documents_to_be_verified
          const dtbvIds = dtbvFullData.map(d => d.id);

          const { data: tdData, error: tdError } = await supabase
            .from('translated_documents')
            .select('original_document_id, authenticated_by_name, authenticated_by_email, authentication_date, is_authenticated, status')
            .in('original_document_id', dtbvIds);

          if (tdError) {
            console.error('Error loading translated_documents:', tdError);
          } else {
            translatedDocuments = tdData || [];
            // Criar um mapa auxiliar para relacionar dtbv.id -> dtbv.original_document_id
            const dtbvMap = new Map(dtbvFullData.map(d => [d.id, d.original_document_id]));
            // Adicionar original_document_id dos documents ao translatedDocuments para facilitar lookup
            translatedDocuments = translatedDocuments.map(td => ({
              ...td,
              document_id: dtbvMap.get(td.original_document_id) // document_id agora aponta para documents.id
            }));
          }
        }
      }

      // Criar mapas para acesso rápido
      const translationStatusMap = new Map(
        documentsToBeVerified.map(dtbv => [dtbv.original_document_id, dtbv.translation_status])
      );

      // ✅ Mapa de dados de autenticação: key = document_id (de documents)
      const authenticationMap = new Map(
        translatedDocuments.map(td => [
          (td as any).document_id, // Usar document_id que aponta para documents.id
          {
            authenticated_by_name: td.authenticated_by_name,
            authenticated_by_email: td.authenticated_by_email,
            authentication_date: td.authentication_date,
            is_authenticated: td.is_authenticated,
            status: td.status
          }
        ])
      );

      // Processar dados com lógica corrigida para translation_status e dados de autenticação
      const processedDocuments = documents?.map(doc => {
        // Lógica original: usar payment_method do documento se não houver na tabela payments
        const paymentMethod = doc.payments?.[0]?.payment_method || doc.payment_method || null;
        const paymentStatus = doc.payments?.[0]?.status || 'pending';
        const paymentAmount = typeof doc.payments?.[0]?.amount === 'number' ? doc.payments?.[0]?.amount : null;
        const paymentDate = doc.payments?.[0]?.payment_date || null;
        const paymentAmountTotal = Array.isArray((doc as any).payments)
          ? (doc as any).payments.reduce((sum: number, p: any) => {
            const st = (p?.status || '').toLowerCase();
            if (['cancelled', 'refunded', 'pending'].includes(st)) return sum;
            return sum + (typeof p?.amount === 'number' ? p.amount : 0);
          }, 0)
          : null;

        // ✅ CORREÇÃO: Usar translation_status da tabela documents_to_be_verified
        let translationStatus = translationStatusMap.get(doc.id) || doc.status || 'pending';

        // ✅ BUSCAR DADOS DE AUTENTICAÇÃO DE translated_documents
        // Buscar diretamente usando o ID do documento (já mapeado corretamente)
        const authData = authenticationMap.get(doc.id);

        // Se o documento foi autenticado, deve mostrar "completed" independentemente do translation_status
        if (authData && (authData.is_authenticated === true || authData.status === 'completed')) {
          translationStatus = 'completed';
        }

        return {
          ...doc,
          user_name: doc.profiles?.name || null,
          user_email: doc.profiles?.email || null,
          user_phone: doc.profiles?.phone || null,
          user_role: doc.profiles?.role || 'user',
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          payment_amount: paymentAmount,
          payment_amount_total: paymentAmountTotal,
          payment_date: paymentDate,
          translation_status: translationStatus,
          // ✅ DADOS DE AUTENTICAÇÃO VINDOS DE translated_documents
          authenticated_by_name: authData?.authenticated_by_name || doc.authenticated_by_name || null,
          authenticated_by_email: authData?.authenticated_by_email || doc.authenticated_by_email || null,
          authentication_date: authData?.authentication_date || doc.authentication_date || null,
          is_authenticated: authData?.is_authenticated ?? doc.is_authenticated ?? false,
          display_name: (doc.client_name && doc.client_name !== 'Cliente Padrão' && doc.client_name !== doc.profiles?.name)
            ? `${doc.client_name} (${doc.profiles?.name || 'N/A'})`
            : (doc.profiles?.name || doc.client_name || 'N/A'),
          document_type: 'regular' as const,
          client_name: doc.client_name || null,
        };
      }) || [];

      console.log('🔍 DEBUG - Processed documents:', processedDocuments.length);

      // ✅ FILTRAR DOCUMENTOS QUE NÃO DEVEM CONTAR NO TOTAL 
      // Regra Unificada: Excluir rascunhos e uso interno.
      // Refunded/Cancelled DEVEM aparecer conforme solicitado ("ficar ali como -1").
      const finalDocs = processedDocuments.filter(doc => {
        const docStatus = (doc.status || '').toLowerCase();
        if (docStatus === 'draft') return false;

        const transStatus = (doc.translation_status || '').toLowerCase();
        if (transStatus === 'draft') return false;

        return true;
      });

      console.log('🔍 DEBUG - Final documents for table:', finalDocs.length);
      setExtendedDocuments(finalDocs);
    } catch (error) {
      console.error('Error loading extended documents:', error);
    } finally {
      setLoading(false);
    }
  }, [internalDateRange]);

  // Sincronizar dateRange externo com interno
  useEffect(() => {
    if (dateRange) {
      setInternalDateRange(dateRange);
    }
  }, [dateRange]);

  useEffect(() => {
    loadExtendedDocuments();
  }, [loadExtendedDocuments]);

  // Aplica os filtros de busca, status e role
  const filteredDocuments = useMemo(() => {
    const filtered = extendedDocuments.filter(doc => {
      // Filtro de busca textual
      const matchesSearch = searchTerm === '' ||
        doc.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.display_name?.toLowerCase().includes(searchTerm.toLowerCase());

      // Filtro de status: por padrão (all), esconder drafts
      const effectiveStatus = (doc.translation_status || doc.status || '').toLowerCase();
      const matchesStatus = (
        (statusFilter === 'all' && effectiveStatus !== 'draft') ||
        (statusFilter !== 'all' && effectiveStatus === statusFilter)
      );

      // Filtro de role - usar o role real do usuário
      let matchesRole = true;
      if (roleFilter !== 'all') {
        const userRole = doc.user_role || 'user'; // Default para 'user' se não tiver role

        // Debug log detalhado para todos os documentos quando filtro user está ativo
        if (roleFilter === 'user') {
          console.log(`[Role Filter Debug - USER] Document: ${doc.filename}, user_role: ${userRole}, matchesRole: ${userRole === 'user'}`);
          console.log(`  - user_name: ${doc.user_name}`);
          console.log(`  - user_email: ${doc.user_email}`);
        }

        if (roleFilter === 'authenticator') {
          matchesRole = userRole === 'authenticator';
        } else if (roleFilter === 'user') {
          matchesRole = userRole === 'user';
        }
      }

      // Filtro de Payment Status
      let matchesPaymentStatus = true;
      if (paymentStatusFilter !== 'all') {
        const docPaymentStatus = (doc.payment_status || '').toLowerCase();
        matchesPaymentStatus = docPaymentStatus === paymentStatusFilter.toLowerCase();
      }

      // Filtro de Payment Method
      let matchesPaymentMethod = true;
      if (paymentMethodFilter !== 'all') {
        const docPaymentMethod = (doc.payment_method || '').toLowerCase();
        matchesPaymentMethod = docPaymentMethod === paymentMethodFilter.toLowerCase();
      }

      return matchesSearch && matchesStatus && matchesRole && matchesPaymentStatus && matchesPaymentMethod;
    });

    // Debug log para mostrar quantos documentos foram filtrados
    if (roleFilter === 'user') {
      console.log(`[Role Filter Debug] Total documents: ${extendedDocuments.length}, Filtered for 'user': ${filtered.length}`);
    }

    return filtered;
  }, [extendedDocuments, searchTerm, statusFilter, roleFilter, paymentStatusFilter, paymentMethodFilter]);

  // Total dinâmico baseado nos filtros atuais
  const totalAmountFiltered = useMemo(() => {
    // Regra: apenas pagamentos com status 'completed' de usuários regulares
    // NÃO incluir receita de autenticador pois não é lucro (valores ficam pending e não são pagos)
    let userSum = 0;
    const total = filteredDocuments
      .filter(doc => {
        // Excluir drafts
        if ((doc.status || '') === 'draft') return false;
        // Excluir documentos REFUNDED (reembolsados - não são receita real)
        const paymentStatus = (doc.payment_status || '').toLowerCase();
        if (paymentStatus === 'refunded') return false;
        return true;
      })
      .reduce((sum, doc) => {
        const isAuthenticator = (doc.user_role || 'user') === 'authenticator';
        // Não somar receita de autenticador
        if (isAuthenticator) {
          return sum;
        }
        // Considerar apenas pagamentos vinculados que foram 'completed'
        // IMPORTANTE: Usar payment_amount_total (soma de todos os pagamentos LÍQUIDOS da tabela payments)
        // Isso resolve a diferença quando um documento tem múltiplos pagamentos
        const paymentStatus = (doc.payment_status || '').toLowerCase();

        if (paymentStatus === 'completed') {
          const amount = (typeof (doc as any).payment_amount_total === 'number' && (doc as any).payment_amount_total > 0)
            ? (doc as any).payment_amount_total
            : (doc.total_cost || 0);
          userSum += amount;
          return sum + amount;
        }
        return sum;
      }, 0);
    try {
      // Log detalhado para análise
      const refundedCount = filteredDocuments.filter(d => (d.payment_status || '').toLowerCase() === 'refunded').length;
      const completedDocs = filteredDocuments.filter(d => {
        const paymentStatus = (d.payment_status || '').toLowerCase();
        return paymentStatus === 'completed' && (d.user_role || 'user') !== 'authenticator';
      });

      console.log('💰 [Site Total] Análise do cálculo:');
      console.log(`  - Total documentos filtrados: ${filteredDocuments.length}`);
      console.log(`  - Documentos refunded (excluídos): ${refundedCount}`);
      console.log(`  - Documentos completed incluídos: ${completedDocs.length}`);
      console.log(`  - Total calculado (valor LÍQUIDO): $${total.toFixed(2)}`);
      console.log(`  - Soma dos usuários (valor LÍQUIDO): $${userSum.toFixed(2)}`);

      // Mostrar amostra de valores para verificar se está usando payment_amount
      const samples = completedDocs.slice(0, 5).map(d => {
        const paymentAmount = d.payment_amount || 0;
        const totalCost = d.total_cost || 0;
        const difference = totalCost - paymentAmount;
        return {
          filename: d.filename,
          payment_amount: paymentAmount.toFixed(2), // Valor LÍQUIDO usado no cálculo
          total_cost: totalCost.toFixed(2), // Valor BRUTO (não usado)
          stripe_fee: difference > 0 ? difference.toFixed(2) : '0.00'
        };
      });
      console.log('💰 [Site Total] Amostra de valores (primeiros 5):', samples);
    } catch { }
    return total;
  }, [filteredDocuments]);

  // Define a cor de fundo e texto com base no status de pagamento
  const getPaymentStatusColor = (paymentStatus: string | null | undefined) => {
    switch (paymentStatus) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'pending_verification': return 'bg-orange-100 text-orange-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'refunded': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Formata o texto do status de pagamento
  const getPaymentStatusText = (paymentStatus: string | null | undefined) => {
    switch (paymentStatus) {
      case 'completed': return t('admin.documents.table.status.paid');
      case 'pending': return t('admin.documents.table.status.pending');
      case 'pending_verification': return t('admin.documents.table.status.pendingVerification');
      case 'failed': return t('admin.documents.table.status.failed');
      case 'refunded': return t('admin.documents.table.status.refunded');
      default: return t('admin.documents.table.status.unknown');
    }
  };

  // Define a cor de fundo e texto com base no status do documento
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'pending_manual_review': return 'bg-orange-100 text-orange-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Gera e inicia o download de um relatório Excel dos documentos filtrados
  const downloadDocumentsReport = useCallback(async () => {
    console.log('📊 [Export] Iniciando exportação...');
    console.log('📊 [Export] Total de documentos filtrados:', filteredDocuments.length);
    console.log('📊 [Export] Filtros ativos:', {
      searchTerm,
      statusFilter,
      roleFilter,
      paymentStatusFilter,
      paymentMethodFilter,
      dateRange: internalDateRange
    });

    if (filteredDocuments.length === 0) {
      alert(t('admin.documents.table.noDataToExport') || 'No data to export');
      return;
    }

    try {
      // Filtrar documentos: apenas pagos (completed), excluir refunded/failed, e excluir Luiz
      const documentsToExport = filteredDocuments.filter(doc => {
        // 1. Excluir documentos REFUNDED (reembolsados - não são receita real)
        const paymentStatus = (doc.payment_status || '').toLowerCase();
        if (paymentStatus === 'refunded') {
          return false; // Excluir documentos reembolsados
        }

        // 2. Filtrar apenas documentos com pagamento completed (excluir failed, pending, etc)
        if (paymentStatus !== 'completed') {
          return false; // Excluir se não for 'completed'
        }

        // 3. Excluir apenas documentos onde o Luiz é o USUÁRIO (não o autenticador)
        // O Luiz pode autenticar documentos de outros usuários, isso é permitido
        const userEmail = (doc.user_email || '').toLowerCase();
        const userName = (doc.user_name || '').toLowerCase();

        const isLuizUser =
          userEmail.includes('luizeduardomcsantos') ||
          userEmail.includes('luizeduardogouveia7') ||
          userName.includes('luiz eduardo');

        // Excluir apenas se o Luiz for o usuário (não o autenticador)
        return !isLuizUser;
      });

      console.log('📊 [Export] Documentos após filtrar (completed, sem refunded/failed, sem Luiz como usuário):', documentsToExport.length);
      console.log('📊 [Export] Amostra de documentos a exportar:', documentsToExport.slice(0, 3).map(d => ({
        filename: d.filename,
        user_name: d.user_name,
        payment_status: d.payment_status,
        authenticated_by_name: d.authenticated_by_name,
        status: d.status
      })));

      if (documentsToExport.length === 0) {
        alert('Nenhum documento pago encontrado para exportar.\n\nA exportação inclui apenas documentos com pagamento "completed" e exclui:\n• Documentos REFUNDED (reembolsados)\n• Documentos FAILED (falhados)\n• Documentos onde o Luiz é o usuário (não o autenticador)\n\nVerifique os filtros aplicados.');
        return;
      }

      // Obter informações do período de data para incluir no arquivo
      const formatDateForFileName = (date: Date | null) => {
        if (!date) return null;
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };

      const startDateStr = formatDateForFileName(internalDateRange?.startDate);
      const endDateStr = formatDateForFileName(internalDateRange?.endDate);
      const hasDateFilter = startDateStr || endDateStr;

      // Criar um novo workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Documents');

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

      // Definir colunas com larguras e formatação (apenas as colunas necessárias)
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

      // Adicionar dados (já filtrados, sem registros do Luiz)
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

      documentsToExport.forEach((doc) => {
        // Calcular valores: Amount (bruto), Tax (taxa Stripe), Net Value (líquido)
        const amount = doc.total_cost || 0; // Valor bruto que o cliente pagou
        const netValue = doc.payment_amount || 0; // Valor líquido recebido
        const tax = amount - netValue; // Taxa do Stripe

        worksheet.addRow({
          documentName: String(doc.filename || ''),
          userName: String(doc.user_name || ''),
          userEmail: String(doc.user_email || ''),
          translationStatus: String(doc.translation_status || doc.status || 'pending'),
          pages: safeNumber(doc.pages, 0),
          amount: safeNumber(amount, 0), // Amount - Valor total que o cliente pagou
          tax: safeNumber(tax, 0), // Tax - Taxa do Stripe
          netValue: safeNumber(netValue, 0), // Net Value - Valor líquido recebido
          paymentMethod: String(doc.payment_method || ''),
          paymentStatus: String(doc.payment_status || ''),
          authenticatorName: String(doc.authenticated_by_name || ''),
          authenticationDate: formatDateSafely(doc.authentication_date),
          paymentDate: formatDateSafely(doc.payment_date || doc.created_at) // Usar created_at como fallback se payment_date não existir
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
      let fileName = 'documents-report';
      if (hasDateFilter) {
        if (startDateStr && endDateStr) {
          fileName = `documents-report-${startDateStr}_to_${endDateStr}`;
        } else if (startDateStr) {
          fileName = `documents-report-from-${startDateStr}`;
        } else if (endDateStr) {
          fileName = `documents-report-until-${endDateStr}`;
        }
      } else {
        fileName = `documents-report-${new Date().toISOString().split('T')[0]}`;
      }
      fileName += '.xlsx';

      saveAs(blob, fileName);

      // Log silencioso (sem alerta de confirmação)
      console.log(`✅ Exportação concluída! ${documentsToExport.length} documento(s) exportado(s). Arquivo: ${fileName}`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Erro ao exportar para Excel. Por favor, tente novamente.');
    }
  }, [filteredDocuments, internalDateRange, t]);

  // Renderiza um esqueleto de carregamento enquanto os dados são buscados
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow w-full p-6">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow w-full">
      {/* Cabeçalho */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-lg font-medium text-gray-900">{t('admin.documents.title')}</h3>
            <p className="text-sm text-gray-500">
              {t('admin.documents.table.showing', { filtered: filteredDocuments.length, total: extendedDocuments.length })}
              <span className="mx-2">•</span>
              <span className="font-medium text-green-600">{t('admin.documents.table.total')}: ${totalAmountFiltered.toFixed(2)}</span>
              <span className="mx-2">•</span>
              <span className="text-xs text-gray-500">Total excludes drafts</span>
            </p>
          </div>
          <button
            onClick={downloadDocumentsReport}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tfe-blue-500"
          >
            <Download className="w-4 h-4 mr-2" />
            <span>{t('admin.documents.table.exportExcel') || 'Export Excel'}</span>
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gray-50">
        <div className="space-y-3">
          {/* Primeira linha: Search e Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
            {/* Search */}
            <div className="sm:col-span-2 lg:col-span-1">
              <input
                type="text"
                placeholder={t('admin.documents.table.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                aria-label="Search documents"
              />
            </div>

            {/* Google Style Date Range Filter */}
            <GoogleStyleDatePicker
              dateRange={internalDateRange}
              onDateRangeChange={(newDateRange) => {
                setInternalDateRange(newDateRange);
                if (onDateRangeChange) {
                  onDateRangeChange(newDateRange);
                }
              }}
              className="w-full"
            />
          </div>

          {/* Segunda linha: Filtros de Status, Role, Payment Status e Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
            {/* Status Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-400 hidden sm:block" aria-hidden="true" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                aria-label="Filter by document status"
              >
                <option value="all">{t('admin.documents.table.filters.allStatus')}</option>
                <option value="completed">{t('admin.documents.table.status.completed')}</option>
                <option value="pending">{t('admin.documents.table.status.pending')}</option>
                <option value="processing">{t('admin.documents.table.status.processing')}</option>
                <option value="failed">{t('admin.documents.table.status.failed')}</option>
                <option value="draft">{t('admin.documents.table.status.draft')}</option>
              </select>
            </div>

            {/* Role Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-400 hidden sm:block" aria-hidden="true" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                aria-label="Filter by user role"
              >
                <option value="all">{t('admin.documents.table.filters.allUserRoles')}</option>
                <option value="user">{t('admin.documents.table.filters.user')}</option>
                <option value="authenticator">{t('admin.documents.table.filters.authenticator')}</option>
              </select>
            </div>

            {/* Payment Status Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-400 hidden sm:block" aria-hidden="true" />
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                aria-label="Filter by payment status"
              >
                <option value="all">All Payment Status</option>
                <option value="completed">Paid</option>
                <option value="pending">Pending</option>
                <option value="pending_verification">Pending Verification</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>

            {/* Payment Method Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-400 hidden sm:block" aria-hidden="true" />
              <select
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                aria-label="Filter by payment method"
              >
                <option value="all">All Payment Methods</option>
                <option value="card">💳 Card</option>
                <option value="stripe">💳 Stripe</option>
                <option value="zelle">💰 Zelle</option>
                <option value="bank_transfer">🏦 Bank Transfer</option>
                <option value="paypal">📱 PayPal</option>
                <option value="upload">📋 Upload</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo: Tabela para Desktop e Cartões para Mobile */}
      {filteredDocuments.length === 0 ? (
        <div className="text-center py-8 px-4">
          <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-base font-medium text-gray-700">{t('admin.documents.table.noDocuments')}</p>
          <p className="text-sm text-gray-500">{t('admin.documents.table.noDocumentsDescription')}</p>
        </div>
      ) : (
        <>
          {/* Mobile: Cards View */}
          <div className="sm:hidden px-3 py-2 space-y-2">
            {filteredDocuments.map((doc) => (
              <div key={doc.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {doc.display_name || doc.user_name || doc.user_email || 'Unknown user'}
                    </p>
                  </div>
                  <span className={`ml-2 flex-shrink-0 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(doc.status || 'pending')}`}>
                    {doc.status || 'pending'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                  <div>
                    <span className="text-gray-500">Amount:</span>
                    <p className="font-medium text-gray-900">${doc.total_cost?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Payment Method:</span>
                    <p className="font-medium text-gray-900 truncate">
                      {doc.payment_method ? (
                        doc.payment_method === 'card' ? '💳 Card' :
                          doc.payment_method === 'stripe' ? '💳 Stripe' :
                            doc.payment_method === 'bank_transfer' ? '🏦 Bank' :
                              doc.payment_method === 'paypal' ? '📱 PayPal' :
                                doc.payment_method === 'zelle' ? '💰 Zelle' :
                                  doc.payment_method === 'upload' ? '📋 Upload' :
                                    doc.payment_method
                      ) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Translation:</span>
                    <p className="font-medium text-gray-900">
                      {doc.translation_status || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Authenticator:</span>
                    <p className="font-medium text-gray-900 truncate">
                      {doc.authenticated_by_name || 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                  <p className="text-xs text-gray-500">{formatDate(doc.created_at || '')}</p>
                  <button onClick={() => onViewDocument(doc as Document)} className="text-blue-600 hover:text-blue-900">
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    USER/CLIENT
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                    Document
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Amount
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                    Payment Method
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Payment Status
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    TRANSLATIONS
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    AUTHENTICATOR
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Date
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    {/* USER/CLIENT */}
                    <td className="px-3 py-3 text-xs">
                      <div>
                        <div className="font-medium text-gray-900 truncate">
                          {doc.display_name || doc.user_name || 'N/A'}
                        </div>
                        <div className="text-gray-500 truncate">
                          {doc.user_email || 'No email'}
                        </div>
                      </div>
                    </td>

                    {/* Document */}
                    <td className="px-3 py-3 text-xs">
                      <div className="flex items-center">
                        <FileText className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {doc.filename}
                          </div>
                          <div className="text-gray-500">
                            {doc.pages} páginas
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="px-3 py-3 text-xs font-medium text-gray-900">
                      ${doc.total_cost?.toFixed(2) || '0.00'}
                    </td>

                    {/* Payment Method */}
                    <td className="px-3 py-3 text-xs">
                      {doc.payment_method ? (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          {doc.payment_method === 'card' ? '💳 Card' :
                            doc.payment_method === 'stripe' ? '💳 Stripe' :
                              doc.payment_method === 'bank_transfer' ? '🏦 Bank' :
                                doc.payment_method === 'paypal' ? '📱 PayPal' :
                                  doc.payment_method === 'zelle' ? '💰 Zelle' :
                                    doc.payment_method === 'upload' ? '📋 Upload' :
                                      doc.payment_method}
                        </span>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>

                    {/* Payment Status */}
                    <td className="px-3 py-3 text-xs">
                      <span className={`inline-flex px-2 py-1 font-medium rounded-full ${getPaymentStatusColor(doc.payment_status)}`}>
                        {getPaymentStatusText(doc.payment_status)}
                      </span>
                    </td>

                    {/* TRANSLATIONS */}
                    <td className="px-3 py-3 text-xs">
                      <span className={`inline-flex px-2 py-1 font-semibold rounded-full ${getStatusColor(doc.translation_status || 'pending')}`}>
                        {doc.translation_status || 'N/A'}
                      </span>
                    </td>

                    {/* AUTHENTICATOR */}
                    <td className="px-3 py-3 text-xs">
                      <div className="truncate">
                        <div className="font-medium text-gray-900">
                          {doc.authenticated_by_name || 'N/A'}
                        </div>
                        <div className="text-gray-500 truncate">
                          {doc.authenticated_by_email || 'No authenticator'}
                        </div>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-3 py-3 text-xs text-gray-500">
                      {formatDate(doc.created_at || '')}
                    </td>

                    {/* Details */}
                    <td className="px-3 py-3 text-xs text-right">
                      <button
                        onClick={() => onViewDocument(doc as Document)}
                        className="text-blue-600 hover:text-blue-900 font-medium p-1"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer removido para evitar duplicação do total */}
        </>
      )}
    </div>
  );
}