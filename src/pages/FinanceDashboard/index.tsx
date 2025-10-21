import { useState, useEffect } from 'react';
import { StatsCards } from './StatsCards';
import { PaymentsTable } from './PaymentsTable';
import { PaymentStatsCards } from './PaymentStatsCards';
import { FinanceCharts } from './FinanceCharts';
import { DocumentDetailsModal } from './DocumentDetailsModal';
import { ZelleReceiptsAdmin } from '../../components/ZelleReceiptsAdmin';
import { Chatbot } from '../../components/Chatbot';
import { Document } from '../../App';
import { Home, CreditCard, Receipt, Users } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface FinanceDashboardProps {
  documents: Document[];
}

export function FinanceDashboard({ }: FinanceDashboardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'payments' | 'zelle-receipts'>('overview');

  // Detectar se o usuário veio de um link específico da sidebar
  useEffect(() => {
    const hash = location.hash;
    if (hash === '#payments') {
      setActiveTab('payments');
    } else if (hash === '#zelle-receipts') {
      setActiveTab('zelle-receipts');
    } else {
      // Se não há hash específico, vai para Overview (padrão)
      setActiveTab('overview');
    }
  }, [location.hash]);

  const handleCloseModal = () => {
    setSelectedDocument(null);
  };

  const handleTabChange = (tab: 'overview' | 'payments' | 'zelle-receipts') => {
    setActiveTab(tab);
    // Atualizar a URL para refletir a aba ativa
    if (tab === 'overview') {
      navigate('/finance');
    } else {
      navigate(`/finance#${tab}`);
    }
  };


  const tabs = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'zelle-receipts', label: 'Zelle Receipts', icon: Receipt },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-3 sm:p-4 lg:p-6 w-full max-w-none overflow-x-hidden">
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Finance Dashboard</h1>
          <p className="text-sm sm:text-base lg:text-lg text-gray-600 mt-1 sm:mt-2">Monitor payments, track translations, and generate business reports</p>
        </div>

        {/* Tabs - Mobile Responsive */}
        <div className="mb-4 sm:mb-6">
          {/* Mobile: Dropdown */}
          <div className="sm:hidden">
            <select
              value={activeTab}
              onChange={(e) => handleTabChange(e.target.value as any)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-tfe-blue-500 focus:border-tfe-blue-500 bg-white"
            >
              {tabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Desktop: Horizontal tabs */}
          <nav className="hidden sm:flex space-x-4 lg:space-x-8 overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as 'overview' | 'payments' | 'zelle-receipts')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-tfe-blue-500 text-tfe-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden lg:inline">{tab.label}</span>
                  <span className="lg:hidden">{tab.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="w-full">
          {activeTab === 'overview' && (
            <div className="space-y-4 sm:space-y-6 w-full">
              <StatsCards />
              <FinanceCharts />
              <PaymentsTable />
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="space-y-4 sm:space-y-6 w-full">
              <PaymentStatsCards />
              <PaymentsTable />
            </div>
          )}

          {activeTab === 'zelle-receipts' && (
            <div className="space-y-4 sm:space-y-6 w-full">
              <ZelleReceiptsAdmin />
            </div>
          )}


        </div>
      </div>
      {selectedDocument && (
        <DocumentDetailsModal 
          document={{
            ...selectedDocument,
            status: (selectedDocument.status === 'pending' || selectedDocument.status === 'processing' || selectedDocument.status === 'completed')
              ? selectedDocument.status 
              : 'pending'
          } as Document}
          onClose={handleCloseModal}
        />
      )}
      <Chatbot />
    </div>
  );
}
