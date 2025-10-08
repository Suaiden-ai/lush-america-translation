import { useState, useEffect, useCallback } from 'react';
import { CreditCard, DollarSign, TrendingUp, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DateRange } from '../../components/DateRangeFilter';

interface PaymentStatsCardsProps {
  dateRange?: DateRange;
}

export function PaymentStatsCards({ dateRange }: PaymentStatsCardsProps) {
  const [stats, setStats] = useState<any>(null);
  const [weeklyStats, setWeeklyStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadPaymentStats = useCallback(async () => {
    try {
      setLoading(true);
      
      console.log('🔍 Carregando estatísticas de pagamentos incluindo documentos de autenticadores...', { dateRange });
      
      const startDateParam = dateRange?.startDate ? dateRange.startDate.toISOString() : null;
      const endDateParam = dateRange?.endDate ? dateRange.endDate.toISOString() : null;
      
      // Buscar dados da tabela de pagamentos
      let paymentsQuery = supabase.from('payments').select('*');
      
      if (startDateParam) {
        paymentsQuery = paymentsQuery.gte('created_at', startDateParam);
      }
      if (endDateParam) {
        paymentsQuery = paymentsQuery.lte('created_at', endDateParam);
      }
      
      const { data: paymentsData, error: paymentsError } = await paymentsQuery;
      
      if (paymentsError) {
        console.error('❌ Erro ao buscar pagamentos:', paymentsError);
        return;
      }
      
      // Buscar documentos dos autenticadores (documents_to_be_verified)
      let documentsQuery = supabase.from('documents_to_be_verified').select(`
        id,
        filename,
        total_cost,
        created_at,
        user_id,
        status
      `);
      
      if (startDateParam) {
        documentsQuery = documentsQuery.gte('created_at', startDateParam);
      }
      if (endDateParam) {
        documentsQuery = documentsQuery.lte('created_at', endDateParam);
      }
      
      const { data: allDocs, error: docsError } = await documentsQuery;
      
      if (docsError) {
        console.error('❌ Erro ao buscar documentos:', docsError);
      }
      
      // Filtrar apenas documentos de autenticadores
      let authenticatorDocuments: any[] = [];
      if (allDocs && allDocs.length > 0) {
        for (const doc of allDocs) {
          try {
            // Buscar dados do uploader para verificar se é autenticador
            const { data: uploaderProfile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', doc.user_id)
              .single();
            
            if (uploaderProfile && uploaderProfile.role === 'authenticator') {
              // Verificar se já existe na tabela translated_documents (documento aprovado)
              const { data: translatedDoc } = await supabase
                .from('translated_documents')
                .select('id')
                .eq('original_document_id', doc.id)
                .single();
              
              const isApproved = !!translatedDoc;
              const status = isApproved ? 'completed' : 'pending';
              
              authenticatorDocuments.push({
                id: doc.id,
                amount: doc.total_cost || 0,
                status: status,
                created_at: doc.created_at
              });
            }
          } catch (err) {
            // Ignorar erros individuais e continuar
            continue;
          }
        }
      }
      
      // Combinar todos os dados
      const allTransactions = [...(paymentsData || []), ...authenticatorDocuments];
      
      console.log('💰 Pagamentos encontrados:', paymentsData?.length || 0);
      console.log('📋 Documentos de autenticadores:', authenticatorDocuments.length);
      console.log('📊 Total de transações:', allTransactions.length);
      
      // Filtrar transações canceladas ou reembolsadas
      const validTransactions = allTransactions.filter(t => 
        t.status !== 'cancelled' && t.status !== 'refunded'
      );
      
      // Calcular estatísticas totais apenas com transações válidas
      const totalPayments = validTransactions.length;
      const totalAmount = validTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
      const avgPayment = totalPayments > 0 ? totalAmount / totalPayments : 0;
      const successfulPayments = validTransactions.filter(t => t.status === 'completed').length;
      
      const calculatedStats = {
        total_payments: totalPayments,
        total_amount: totalAmount,
        avg_payment: avgPayment,
        successful_payments: successfulPayments
      };
      
      console.log('📈 Estatísticas calculadas:', calculatedStats);
      setStats(calculatedStats);

      // Buscar estatísticas dos últimos 7 dias
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      console.log('🔍 Buscando dados dos últimos 7 dias...');
      
      // Filtrar transações dos últimos 7 dias
      const weeklyTransactions = allTransactions.filter(t => {
        const transactionDate = new Date(t.created_at);
        return transactionDate >= sevenDaysAgo && transactionDate <= new Date();
      });
      
      console.log('📅 Transações semanais encontradas:', weeklyTransactions.length);
      
      // Calcular estatísticas semanais
      const weeklyTotalPayments = weeklyTransactions.length;
      const weeklyTotalAmount = weeklyTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
      const weeklySuccessfulPayments = weeklyTransactions.filter(t => t.status === 'completed').length;
      
      const calculatedWeeklyStats = {
        total_payments: weeklyTotalPayments,
        total_amount: weeklyTotalAmount,
        successful_payments: weeklySuccessfulPayments
      };
      
      console.log('📈 Estatísticas semanais calculadas:', calculatedWeeklyStats);
      setWeeklyStats(calculatedWeeklyStats);

    } catch (error) {
      console.error('💥 Erro ao carregar estatísticas de pagamentos:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadPaymentStats();
  }, [loadPaymentStats]);

  const paymentStatsCards = [
    {
      title: 'Total Payments',
      value: stats ? stats.total_payments?.toLocaleString() || '0' : '...',
      subtitle: 'All time payments',
      icon: CreditCard,
      bgColor: 'bg-blue-100',
      iconColor: 'text-blue-900',
      loading: loading
    },
    {
      title: 'Total Amount',
      value: stats ? `$${stats.total_amount?.toFixed(2) || '0.00'}` : '...',
      subtitle: stats ? `Avg: $${(stats.avg_payment || 0).toFixed(2)}` : 'Loading...',
      icon: DollarSign,
      bgColor: 'bg-green-100',
      iconColor: 'text-green-900',
      loading: loading
    },
    {
      title: 'Last 7 Days',
      value: weeklyStats ? (weeklyStats.total_payments || 0).toLocaleString() : (loading ? '...' : '0'),
      subtitle: weeklyStats ? `$${(weeklyStats.total_amount || 0).toFixed(2)}` : (loading ? 'Loading...' : '$0.00'),
      icon: TrendingUp,
      bgColor: 'bg-purple-100',
      iconColor: 'text-purple-900',
      loading: loading
    },
    {
      title: 'Successful Payments',
      value: stats ? `${stats.successful_payments || 0}` : '...',
      subtitle: stats ? `${(stats.total_payments - stats.successful_payments) || 0} failed/pending` : 'Loading...',
      icon: Calendar,
      bgColor: 'bg-orange-100',
      iconColor: 'text-orange-900',
      loading: loading
    }
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow p-4 sm:p-6 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="h-3 sm:h-4 bg-gray-200 rounded w-20 sm:w-24 mb-2"></div>
                <div className="h-6 sm:h-8 bg-gray-200 rounded w-12 sm:w-16 mb-1"></div>
                <div className="h-2 sm:h-3 bg-gray-200 rounded w-16 sm:w-20"></div>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-200 rounded-lg"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6">
      {paymentStatsCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div key={index} className="bg-white rounded-lg shadow border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                  {stat.title}
                </div>
                <div className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 break-words">
                  {stat.loading ? (
                    <div className="h-6 sm:h-8 bg-gray-200 rounded w-12 sm:w-16 animate-pulse"></div>
                  ) : (
                    stat.value
                  )}
                </div>
                <div className="text-xs sm:text-sm text-gray-500 break-words">
                  {stat.loading ? (
                    <div className="h-3 sm:h-4 bg-gray-200 rounded w-16 sm:w-20 animate-pulse"></div>
                  ) : (
                    stat.subtitle
                  )}
                </div>
              </div>
              <div className={`w-10 h-10 sm:w-12 sm:h-12 ${stat.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${stat.iconColor}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
