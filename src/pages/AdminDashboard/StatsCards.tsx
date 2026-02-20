import { useState, useEffect } from 'react';
import { FileText, CheckCircle, Clock, DollarSign, Users, AlertCircle, UserCheck } from 'lucide-react';
import { Document } from '../../App';
import { supabase } from '../../lib/supabase';
import { DateRange } from '../../components/DateRangeFilter';
import { useI18n } from '../../contexts/I18nContext';

interface StatsCardsProps {
  documents: Document[];
  dateRange?: DateRange;
}

export function StatsCards({ documents, dateRange }: StatsCardsProps) {
  const { t } = useI18n();
  const [extendedStats, setExtendedStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [overrideRevenue, setOverrideRevenue] = useState<number | null>(null);
  // 🔍 BUSCAR STATUS DE PAGAMENTOS PARA FILTRAR CORRETAMENTE
  const [paymentStatuses, setPaymentStatuses] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const fetchPaymentStatuses = async () => {
      try {
        const { data: payments, error } = await supabase
          .from('payments')
          .select('document_id, user_id, status, amount');

        if (error) {
          console.error('Error fetching payment statuses:', error);
          return;
        }

        const statusMap = new Map<string, string>();
        payments?.forEach(payment => {
          // Mapear por document_id primeiro, depois por user_id + amount
          if (payment.document_id) {
            statusMap.set(payment.document_id, payment.status);
          }
        });

        setPaymentStatuses(statusMap);
        console.log('🔍 DEBUG - Payment statuses loaded:', statusMap.size);
      } catch (err) {
        console.error('Error loading payment statuses:', err);
      }
    };

    fetchPaymentStatuses();
  }, []);

  // Buscar dados exatos para receita (apenas pagamentos com status 'completed', excluindo refunded)
  // IMPORTANTE: Diferenciar Receita de Usuários vs Receita de Autenticadores
  const [authenticatorRevenue, setAuthenticatorRevenue] = useState<number>(0);
  useEffect(() => {
    const fetchRevenueData = async () => {
      try {
        // 1. Buscar todos os pagamentos completed
        const { data: paymentsData, error: payErr } = await supabase
          .from('payments')
          .select('amount, status, user_id, created_at')
          .eq('status', 'completed');

        if (payErr) throw payErr;

        // 2. Buscar roles dos usuários envolvidos nos pagamentos
        const userIds = Array.from(new Set(paymentsData.map(p => p.user_id)));
        const { data: profilesData, error: profErr } = await supabase
          .from('profiles')
          .select('id, role')
          .in('id', userIds);

        if (profErr) throw profErr;

        const roleMap = new Map(profilesData?.map(p => [p.id, p.role]));

        let userRev = 0;
        let authRev = 0;

        (paymentsData || []).forEach((p: any) => {
          // Filtrar por data manualmente para garantir precisão
          const payDate = new Date(p.created_at);
          if (dateRange?.startDate && payDate < new Date(dateRange.startDate)) return;
          if (dateRange?.endDate) {
            const end = new Date(dateRange.endDate);
            end.setHours(23, 59, 59, 999);
            if (payDate > end) return;
          }

          const amount = Number(p.amount || 0);
          const role = roleMap.get(p.user_id);

          if (role === 'authenticator') {
            authRev += amount;
          } else {
            userRev += amount;
          }
        });

        setOverrideRevenue(userRev);
        setAuthenticatorRevenue(authRev);
      } catch (e) {
        console.warn('Revenue fetch failed', e);
      }
    };
    fetchRevenueData();
  }, [dateRange]);

  // Filtrar documentos: excluir apenas drafts e uso interno
  // Refunded/Cancelled DEVEM contar no total ("ficar ali como -1")
  const validDocuments = documents.filter(doc => {
    if ((doc.status || '') === 'draft') return false;
    if (doc.is_internal_use === true) return false;
    return true;
  });

  // 🔍 LOG PARA VERIFICAR FILTRO DE DOCUMENTOS VÁLIDOS
  console.log('🔍 DEBUG - Total documents:', documents.length);
  console.log('🔍 DEBUG - Valid documents (after filter):', validDocuments.length);
  console.log('🔍 DEBUG - Excluded documents:', documents.length - validDocuments.length);

  // Verificar se há documentos com status refunded/cancelled
  const excludedDocs = documents.filter(doc => {
    const paymentStatus = paymentStatuses.get(doc.id);
    return paymentStatus === 'cancelled' || paymentStatus === 'refunded';
  });
  if (excludedDocs.length > 0) {
    console.log('🔍 DEBUG - Excluded documents details:', excludedDocs.map(doc => ({
      id: doc.id,
      filename: doc.filename,
      payment_status: paymentStatuses.get(doc.id),
      total_cost: doc.total_cost
    })));
  }

  // Fallback: calcular usando total_cost dos documentos (valor BRUTO - menos preciso)
  // NOTA: Excluir Refunded/Cancelled da Receita mesmo que contem no Total de Docs
  const totalRevenueDoc = validDocuments.reduce((sum, doc) => {
    const payStatus = paymentStatuses.get(doc.id);
    if (payStatus === 'cancelled' || payStatus === 'refunded') return sum;
    return sum + (doc.total_cost || 0);
  }, 0);
  const totalRevenue = overrideRevenue ?? totalRevenueDoc;

  // Debug detalhado para reconciliar valores
  try {
    console.log('💰 [StatsCards] Análise do cálculo de receita:');
    console.log(`  - Documentos válidos (sem drafts/cancelled/refunded): ${validDocuments.length}`);
    if (overrideRevenue !== null) {
      console.log(`  - ✅ Usando valor da tabela payments (LÍQUIDO): $${overrideRevenue.toFixed(2)}`);
      console.log(`  - ⚠️ Fallback (valor BRUTO dos docs): $${totalRevenueDoc.toFixed(2)} (não usado)`);
    } else {
      console.log(`  - ⚠️ ATENÇÃO: Usando fallback (valor BRUTO dos docs): $${totalRevenueDoc.toFixed(2)}`);
      console.log(`  - ⚠️ Isso significa que a query de payments falhou ou não retornou dados`);
    }
    console.log(`  - Total Revenue final: $${totalRevenue.toFixed(2)}`);
  } catch { }

  // Calcular métricas adicionais
  const uniqueUsers = new Set(validDocuments.map(doc => doc.user_id)).size;
  const avgRevenuePerDoc = validDocuments.length > 0 ? totalRevenue / validDocuments.length : 0;

  // Buscar estatísticas estendidas do banco de dados
  const fetchExtendedStats = async () => {
    setLoading(true);
    try {
      let docQuery = supabase.from('documents')
        .select('id, status, is_internal_use, created_at')
        .or('is_internal_use.is.null,is_internal_use.eq.false')
        .neq('status', 'draft');

      if (dateRange?.startDate) docQuery = docQuery.gte('created_at', new Date(dateRange.startDate).toISOString());
      if (dateRange?.endDate) {
        const end = new Date(dateRange.endDate);
        end.setHours(23, 59, 59, 999);
        docQuery = docQuery.lte('created_at', end.toISOString());
      }

      const [documentsResult, profilesResult, dtbvResult, translatedDocsResult] = await Promise.all([
        docQuery,
        supabase.from('profiles').select('id, role'),
        supabase.from('documents_to_be_verified').select('id, original_document_id, translation_status'),
        supabase.from('translated_documents').select('original_document_id, is_authenticated, status')
      ]);

      if (documentsResult.data && profilesResult.data) {
        // Mapear doc.id -> dtbv info
        const docToDtbvMap = new Map(dtbvResult.data?.map(d => [d.original_document_id, { id: d.id, translation_status: d.translation_status }]));

        // Mapear dtbv.id -> auth info
        const dtbvIdToAuthMap = new Map(translatedDocsResult.data?.map(d => [d.original_document_id, {
          is_authenticated: d.is_authenticated,
          status: d.status
        }]));

        const docsWithCorrectStatus = documentsResult.data.map(doc => {
          const dtbvInfo = docToDtbvMap.get(doc.id);
          const dtbvId = dtbvInfo?.id;

          let status = dtbvInfo?.translation_status || doc.status || 'pending';
          const authData = dtbvId ? dtbvIdToAuthMap.get(dtbvId) : null;

          if (authData && (authData.is_authenticated === true || authData.status === 'completed')) {
            status = 'completed';
          }
          return { ...doc, final_status: status };
        });

        const stats = {
          total_documents: docsWithCorrectStatus.length,
          completed: docsWithCorrectStatus.filter(d => d.final_status === 'completed').length,
          pending: docsWithCorrectStatus.filter(d => d.final_status === 'pending').length,
          processing: docsWithCorrectStatus.filter(d => d.final_status === 'processing').length,
          translated: translatedDocsResult.data?.length || 0,
          active_users: profilesResult.data.length
        };

        console.log('Final unified stats with DocumentsTable logic:', stats);
        setExtendedStats(stats);
      }
    } catch (error) {
      console.error('Error fetching extended stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExtendedStats();
  }, [dateRange]);

  const stats = [
    {
      title: t('admin.stats.totalDocuments'),
      value: validDocuments.length,
      subtitle: t('admin.stats.allTime'),
      icon: FileText,
      bgColor: 'bg-tfe-blue-100',
      iconColor: 'text-tfe-blue-950',
      trend: null
    },
    {
      title: t('admin.stats.totalRevenue'),
      value: `$${totalRevenue.toLocaleString()}`,
      subtitle: `${t('admin.stats.average')}: $${avgRevenuePerDoc.toFixed(0)}/doc`,
      icon: DollarSign,
      bgColor: 'bg-green-100',
      iconColor: 'text-green-900',
      trend: 'up'
    },
    {
      title: 'Authenticator Revenue',
      value: `$${authenticatorRevenue.toLocaleString()}`,
      subtitle: 'Internal use (not in Total)',
      icon: UserCheck, // Preciso verificar se UserCheck está disponível, se não uso Users ou CheckCircle
      bgColor: 'bg-orange-100',
      iconColor: 'text-orange-900',
      trend: null
    },
    {
      title: t('admin.stats.activeUsers'),
      value: extendedStats?.active_users || uniqueUsers,
      subtitle: t('admin.stats.registeredUsers'),
      icon: Users,
      bgColor: 'bg-purple-100',
      iconColor: 'text-purple-900',
      trend: null
    }
  ];

  const statusStats = [
    {
      title: t('admin.stats.completed'),
      value: extendedStats?.completed ?? (loading ? '...' : 0),
      icon: CheckCircle,
      bgColor: 'bg-green-100',
      iconColor: 'text-green-900',
      textColor: 'text-green-700',
      description: t('admin.stats.completedDescription')
    },
    {
      title: t('admin.stats.processing'),
      value: extendedStats?.processing ?? (loading ? '...' : 0),
      icon: Clock,
      bgColor: 'bg-blue-100',
      iconColor: 'text-blue-900',
      textColor: 'text-blue-700',
      description: t('admin.stats.processingDescription')
    },
    {
      title: t('admin.stats.pending'),
      value: extendedStats?.pending ?? (loading ? '...' : 0),
      icon: AlertCircle,
      bgColor: 'bg-yellow-100',
      iconColor: 'text-yellow-900',
      textColor: 'text-yellow-700',
      description: t('admin.stats.pendingDescription')
    }
  ];

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-6 mb-4 sm:mb-6 lg:mb-8 w-full">
      {/* Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 w-full">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 lg:p-5 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className={`w-8 h-8 sm:w-9 sm:h-9 ${stat.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${stat.iconColor}`} />
                </div>
              </div>
              <div className="text-xs sm:text-xs text-gray-500 uppercase tracking-wider mb-1 sm:mb-2">{stat.title}</div>
              <div className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900 mb-1 break-words leading-tight">{stat.value}</div>
              {stat.subtitle && (
                <div className="text-xs text-gray-500 break-words leading-relaxed">{stat.subtitle}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Status Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 lg:p-6 w-full">
        <div className="flex items-center gap-2 mb-3 sm:mb-4 lg:mb-6">
          <AlertCircle className="w-4 h-4 text-gray-600 flex-shrink-0" />
          <h3 className="text-sm sm:text-base font-semibold text-gray-900">{t('admin.stats.statusBreakdown')}</h3>
          {loading && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-tfe-blue-600"></div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 w-full">
          {statusStats.map((stat, index) => {
            const Icon = stat.icon;

            return (
              <div key={index} className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200 hover:bg-gray-100 transition-colors w-full">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-5 h-5 sm:w-6 sm:h-6 ${stat.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${stat.iconColor}`} />
                    </div>
                    <h4 className="text-xs sm:text-sm font-medium text-gray-900 truncate">{stat.title}</h4>
                  </div>
                  <div className="text-right">
                    <div className="text-xl sm:text-2xl font-bold text-gray-900">{stat.value}</div>
                    <div className="text-xs text-gray-500">{t('admin.stats.docs')}</div>
                  </div>
                </div>
                <div className="pt-3 border-t border-gray-300">
                  <div className="text-xs text-gray-600">{stat.description}</div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

export default StatsCards;