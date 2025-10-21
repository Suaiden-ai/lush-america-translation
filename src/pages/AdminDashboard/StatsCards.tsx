import { useState, useEffect } from 'react';
import { FileText, CheckCircle, Clock, DollarSign, Users, AlertCircle } from 'lucide-react';
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
  
  // Filtrar documentos com pagamentos cancelados ou reembolsados
  const validDocuments = documents.filter(doc => {
    const paymentStatus = paymentStatuses.get(doc.id);
    // Se não há payment_status, incluir o documento (pode ser de autenticador)
    if (!paymentStatus) return true;
    // Excluir documentos com pagamentos cancelados ou reembolsados
    return paymentStatus !== 'cancelled' && paymentStatus !== 'refunded';
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
  
  const totalRevenue = validDocuments.reduce((sum, doc) => sum + (doc.total_cost || 0), 0);
  const completedDocuments = validDocuments.filter(doc => doc.status === 'completed').length;
  const pendingDocuments = validDocuments.filter(doc => doc.status === 'pending').length;
  const processingDocuments = validDocuments.filter(doc => doc.status === 'processing').length;
  
  // Calcular métricas adicionais
  const uniqueUsers = new Set(validDocuments.map(doc => doc.user_id)).size;
  const avgRevenuePerDoc = validDocuments.length > 0 ? totalRevenue / validDocuments.length : 0;

  // Buscar estatísticas estendidas do banco de dados
  useEffect(() => {
    fetchExtendedStats();
  }, []);

  const fetchExtendedStats = async () => {
    setLoading(true);
    try {
      // Buscar estatísticas de todas as tabelas relevantes
      const [documentsResult, verifiedResult, translatedResult, profilesResult] = await Promise.all([
        supabase.from('documents').select('id, status, total_cost, user_id, filename, profiles!inner(role)'),
        supabase.from('documents_to_be_verified').select('id, status, user_id, filename'),
        supabase.from('translated_documents').select('status, user_id'),
        supabase.from('profiles').select('id, role, created_at')
      ]);

      if (documentsResult.data && verifiedResult.data && translatedResult.data && profilesResult.data) {
        const mainDocuments = documentsResult.data;
        const verifiedDocuments = verifiedResult.data;
        const allProfiles = profilesResult.data;

        // Debug: mostrar os dados reais
        console.log('Total documents in documents table:', mainDocuments.length);
        console.log('Total documents in verified table:', verifiedDocuments.length);
        console.log('Total users in profiles table:', allProfiles.length);
        console.log('Verified documents:', verifiedDocuments);

        // Para cada documento principal, verificar primeiro se existe em documents_to_be_verified
        // Relacionamento por filename ao invés de document_id
        const documentsWithCorrectStatus = mainDocuments.map((doc: any) => {
          const verifiedDoc = verifiedDocuments.find((vDoc: any) => vDoc.filename === doc.filename);
          const actualStatus = verifiedDoc ? verifiedDoc.status : doc.status;
          
          console.log(`Document ${doc.filename}: original status = ${doc.status}, verified status = ${verifiedDoc?.status || 'not found'}, final status = ${actualStatus}`);
          
          return {
            ...doc,
            actualStatus: actualStatus
          };
        });

        // Calcular estatísticas estendidas usando o status correto
        // Active Users agora é o número real de usuários do sistema
        const stats = {
          total_documents: mainDocuments.length,
          completed: documentsWithCorrectStatus.filter((d: any) => d.actualStatus === 'completed').length,
          pending: documentsWithCorrectStatus.filter((d: any) => d.actualStatus === 'pending').length,
          processing: documentsWithCorrectStatus.filter((d: any) => d.actualStatus === 'processing').length,
          translated: translatedResult.data.length,
          active_users: allProfiles.length
        };

        console.log('Final stats:', stats);
        setExtendedStats(stats);
      }
    } catch (error) {
      console.error('Error fetching extended stats:', error);
    } finally {
      setLoading(false);
    }
  };

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
      value: extendedStats?.completed || completedDocuments,
      icon: CheckCircle,
      bgColor: 'bg-green-100',
      iconColor: 'text-green-900',
      textColor: 'text-green-700',
      description: t('admin.stats.completedDescription')
    },
    {
      title: t('admin.stats.processing'), 
      value: extendedStats?.processing || processingDocuments,
      icon: Clock,
      bgColor: 'bg-blue-100',
      iconColor: 'text-blue-900',
      textColor: 'text-blue-700',
      description: t('admin.stats.processingDescription')
    },
    {
      title: t('admin.stats.pending'),
      value: extendedStats?.pending || pendingDocuments,
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

        {/* Summary Information */}
        {extendedStats && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="min-w-0">
                <p className="text-lg font-bold text-gray-900">{extendedStats.total_documents}</p>
                <p className="text-xs text-gray-500 truncate">{t('admin.stats.totalDocuments')}</p>
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-green-600">{extendedStats.translated}</p>
                <p className="text-xs text-gray-500 truncate">{t('admin.stats.translated')}</p>
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-blue-600">{((extendedStats.completed / extendedStats.total_documents) * 100).toFixed(1)}%</p>
                <p className="text-xs text-gray-500 truncate">{t('admin.stats.successRate')}</p>
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-purple-600">{extendedStats.active_users}</p>
                <p className="text-xs text-gray-500 truncate">{t('admin.stats.activeUsers')}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}