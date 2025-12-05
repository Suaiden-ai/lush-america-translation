import { useState, useEffect } from 'react';
import StatsCards from './StatsCards';
import { DocumentsTable } from './DocumentsTable';
import { DocumentDetailsModal } from './DocumentDetailsModal';
import { ZelleReceiptsAdmin } from '../../components/ZelleReceiptsAdmin';
import DraftCleanupApproval from './DraftCleanupApproval';
import { UploadSimulationPanel } from './UploadSimulationPanel';
import { Document } from '../../App';
import { Home, Receipt, FileText, Trash2, TestTube } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DateRange } from '../../components/DateRangeFilter';
import { useI18n } from '../../contexts/I18nContext';

interface AdminDashboardProps {
  documents: Document[];
}

export function AdminDashboard({ documents }: AdminDashboardProps) {
  const { t } = useI18n();
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'zelle-receipts' | 'draft-cleanup' | 'test-tools'>('overview');
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
    preset: 'all'
  });
  const navigate = useNavigate();
  const location = useLocation();

  // Detectar aba ativa pela URL (similar ao FinanceDashboard)
  useEffect(() => {
    if (location.hash === '#zelle-receipts') {
      setActiveTab('zelle-receipts');
    } else if (location.hash === '#draft-cleanup') {
      setActiveTab('draft-cleanup');
    } else if (location.hash === '#test-tools' && SHOW_TEST_TOOLS) {
      // Só permite ativar test-tools se a flag estiver habilitada
      setActiveTab('test-tools');
    } else {
      setActiveTab('overview');
    }
  }, [location.hash]);

  const handleViewDocument = (document: Document) => {
    setSelectedDocument(document);
  };

  const handleCloseModal = () => {
    setSelectedDocument(null);
  };

  const handleTabChange = (tab: 'overview' | 'zelle-receipts' | 'draft-cleanup' | 'test-tools') => {
    setActiveTab(tab);
    // Atualizar a URL para refletir a aba ativa
    if (tab === 'overview') {
      navigate('/admin');
    } else {
      navigate(`/admin#${tab}`);
    }
  };

  // Aba Test Tools oculta temporariamente - código mantido para uso futuro
  const SHOW_TEST_TOOLS = false; // Altere para true para reativar a aba
  
  const allTabs = [
    { id: 'overview', label: t('admin.dashboard.tabs.overview'), icon: Home },
    { id: 'zelle-receipts', label: t('admin.dashboard.tabs.zelleReceipts'), icon: Receipt },
    { id: 'draft-cleanup', label: 'Draft Cleanup', icon: Trash2 },
    { id: 'test-tools', label: 'Test Tools', icon: TestTube },
  ];
  
  // Filtrar tabs para ocultar Test Tools se necessário
  const tabs = allTabs.filter(tab => tab.id !== 'test-tools' || SHOW_TEST_TOOLS);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-3 sm:p-4 lg:p-6 w-full max-w-none">
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{t('admin.dashboard.title')}</h1>
          <p className="text-sm sm:text-base lg:text-lg text-gray-600 mt-1 sm:mt-2">{t('admin.dashboard.subtitle')}</p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-4 sm:mb-6">
          {/* Mobile: Dropdown */}
          <div className="sm:hidden">
            <select
              value={activeTab}
              onChange={(e) => handleTabChange(e.target.value as 'overview' | 'zelle-receipts' | 'draft-cleanup' | 'test-tools')}
              className="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-tfe-blue-500 focus:outline-none focus:ring-tfe-blue-500"
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
                  onClick={() => handleTabChange(tab.id as 'overview' | 'zelle-receipts' | 'draft-cleanup' | 'test-tools')}
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
              <StatsCards documents={documents} dateRange={dateRange} />
              <DocumentsTable 
                documents={documents}
                onViewDocument={handleViewDocument}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />
            </div>
          )}


          {activeTab === 'zelle-receipts' && (
            <div className="space-y-4 sm:space-y-6 w-full">
              <ZelleReceiptsAdmin />
            </div>
          )}

          {activeTab === 'draft-cleanup' && (
            <div className="space-y-4 sm:space-y-6 w-full">
              <DraftCleanupApproval />
            </div>
          )}

          {/* Test Tools - Oculto temporariamente, código mantido para uso futuro */}
          {SHOW_TEST_TOOLS && activeTab === 'test-tools' && (
            <div className="space-y-4 sm:space-y-6 w-full">
              <UploadSimulationPanel />
            </div>
          )}

        </div>
      </div>
      <DocumentDetailsModal 
        document={selectedDocument}
        onClose={handleCloseModal}
      />
    </div>
  );
}