import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { supabase } from '../../lib/supabase';
import { DateRange } from '../../components/DateRangeFilter';
import { TrendingUp, PieChart as PieChartIcon, BarChart3 } from 'lucide-react';

interface FinanceChartsProps {
  dateRange?: DateRange;
}

interface PaymentTrendData {
  date: string;
  payments: number;
  revenue: number;
}

interface PaymentStatusData {
  name: string;
  value: number;
  color: string;
}

interface RevenueByUserTypeData {
  userType: string;
  revenue: number;
  color: string;
}

export function FinanceCharts({ dateRange }: FinanceChartsProps) {
  const [paymentTrendData, setPaymentTrendData] = useState<PaymentTrendData[]>([]);
  const [paymentStatusData, setPaymentStatusData] = useState<PaymentStatusData[]>([]);
  const [revenueByUserTypeData, setRevenueByUserTypeData] = useState<RevenueByUserTypeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChartsData();
  }, [dateRange]);

  const loadChartsData = async () => {
    try {
      setLoading(true);
      console.log('📊 Carregando dados para gráficos...', { dateRange });

      // 1. Dados para gráfico de evolução de pagamentos (últimos 30 dias)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: paymentsData } = await supabase
        .from('payments')
        .select('created_at, amount, status')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      // Agrupar pagamentos por dia
      const dailyPayments: { [key: string]: { date: string; payments: number; revenue: number } } = {};
      
      paymentsData?.forEach(payment => {
        // Excluir pagamentos cancelados ou reembolsados
        if (payment.status === 'cancelled' || payment.status === 'refunded') {
          return;
        }
        
        const date = new Date(payment.created_at).toLocaleDateString('pt-BR');
        if (!dailyPayments[date]) {
          dailyPayments[date] = { date, payments: 0, revenue: 0 };
        }
        dailyPayments[date].payments += 1;
        if (payment.status === 'completed') {
          dailyPayments[date].revenue += payment.amount || 0;
        }
      });

      const trendData = Object.values(dailyPayments).slice(-14); // Últimos 14 dias
      setPaymentTrendData(trendData);

      // 2. Dados para gráfico de status de pagamentos
      let statusQuery = supabase.from('payments').select('status');
      
      if (dateRange?.startDate) {
        statusQuery = statusQuery.gte('created_at', dateRange.startDate.toISOString());
      }
      if (dateRange?.endDate) {
        statusQuery = statusQuery.lte('created_at', dateRange.endDate.toISOString());
      }

      const { data: statusData } = await statusQuery;

      const statusCount: { [key: string]: number } = {};
      statusData?.forEach(payment => {
        // Excluir pagamentos cancelados ou reembolsados do gráfico
        if (payment.status === 'cancelled' || payment.status === 'refunded') {
          return;
        }
        const status = payment.status || 'unknown';
        statusCount[status] = (statusCount[status] || 0) + 1;
      });

      const pieData = Object.entries(statusCount).map(([status, count]) => ({
        name: status === 'completed' ? 'Completed' : 
              status === 'pending' ? 'Pending' : 
              status === 'failed' ? 'Failed' : 'Other',
        value: count,
        color: status === 'completed' ? '#10b981' : 
               status === 'pending' ? '#f59e0b' : 
               status === 'failed' ? '#ef4444' : '#6b7280'
      }));

      setPaymentStatusData(pieData);

      // 3. Dados para receita por tipo de usuário
      // Usar dados da tabela payments para usuários regulares (apenas status 'completed')
      // NÃO incluir receita de autenticadores pois não é lucro
      
      // Buscar pagamentos dentro do dateRange fornecido
      let revenuePaymentsQuery = supabase
        .from('payments')
        .select('document_id, amount, status');
      
      if (dateRange?.startDate) {
        revenuePaymentsQuery = revenuePaymentsQuery.gte('created_at', dateRange.startDate.toISOString());
      }
      if (dateRange?.endDate) {
        revenuePaymentsQuery = revenuePaymentsQuery.lte('created_at', dateRange.endDate.toISOString());
      }

      const { data: revenuePaymentsData } = await revenuePaymentsQuery;

      // Buscar documentos para identificar qual pagamento pertence a qual tipo de usuário
      let documentsQuery = supabase
        .from('documents')
        .select('id, profiles:user_id(role)');
      
      if (dateRange?.startDate) {
        documentsQuery = documentsQuery.gte('created_at', dateRange.startDate.toISOString());
      }
      if (dateRange?.endDate) {
        documentsQuery = documentsQuery.lte('created_at', dateRange.endDate.toISOString());
      }

      const { data: documentsData } = await documentsQuery;

      const userTypeRevenue = {
        'Regular Users': 0,
        'Authenticators': 0 // Mantido para exibição, mas sempre será 0
      };

      // Calcular receita apenas de pagamentos completed de usuários regulares
      revenuePaymentsData?.forEach(payment => {
        if (payment.status === 'completed' && payment.document_id) {
          const userDoc = documentsData?.find(doc => doc.id === payment.document_id);
          if (userDoc && userDoc.profiles?.role === 'user') {
            userTypeRevenue['Regular Users'] += payment.amount || 0;
          }
        }
      });

      const revenueData = Object.entries(userTypeRevenue).map(([userType, revenue]) => ({
        userType,
        revenue,
        color: userType === 'Regular Users' ? '#8b5cf6' : '#f97316'
      }));

      setRevenueByUserTypeData(revenueData);

    } catch (error) {
      console.error('💥 Erro ao carregar dados dos gráficos:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6 mt-6 sm:mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 animate-pulse">
              <div className="h-5 sm:h-6 bg-gray-200 rounded w-36 sm:w-48 mb-3 sm:mb-4"></div>
              <div className="h-48 sm:h-64 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 mt-6 sm:mt-8">
      <div className="flex items-center gap-2 mb-4 sm:mb-6">
        <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
        <h3 className="text-base sm:text-lg font-semibold text-gray-900">Analytics Overview</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
        {/* Gráfico de Evolução de Pagamentos */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 lg:p-6">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <BarChart3 className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <h4 className="text-sm sm:text-base font-medium text-gray-900">Payment Trends (Last 14 Days)</h4>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={paymentTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fill: '#6b7280', fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#f9fafb', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
              />
              <Legend fontSize={11} />
              <Line 
                type="monotone" 
                dataKey="payments" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Payments"
                dot={{ r: 3 }}
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#10b981" 
                strokeWidth={2}
                name="Revenue ($)"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico de Status de Pagamentos */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 lg:p-6">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <PieChartIcon className="w-4 h-4 text-green-600 flex-shrink-0" />
            <h4 className="text-sm sm:text-base font-medium text-gray-900">Payment Status Distribution</h4>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={paymentStatusData}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={60}
                dataKey="value"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                labelStyle={{ fontSize: '10px' }}
              >
                {paymentStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#f9fafb', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico de Receita por Tipo de Usuário */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 lg:p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <BarChart3 className="w-4 h-4 text-purple-600 flex-shrink-0" />
            <h4 className="text-sm sm:text-base font-medium text-gray-900">Revenue by User Type</h4>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={revenueByUserTypeData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} />
              <YAxis 
                type="category" 
                dataKey="userType" 
                tick={{ fill: '#6b7280', fontSize: 10 }}
                width={100}
              />
              <Tooltip 
                formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Revenue']}
                contentStyle={{ 
                  backgroundColor: '#f9fafb', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
              />
              <Bar dataKey="revenue" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
