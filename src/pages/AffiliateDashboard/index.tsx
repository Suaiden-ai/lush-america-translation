import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, 
  Users, 
  DollarSign, 
  CreditCard, 
  Menu, 
  X,
  LogOut,
  User,
  Share2
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAffiliate } from '../../hooks/useAffiliate';
import { useI18n } from '../../contexts/I18nContext';
import LanguageSelector from '../../components/LanguageSelector';
import { AffiliateOverview } from './AffiliateOverview';
import { AffiliateClients } from './AffiliateClients';
import { AffiliateEarnings } from './AffiliateEarnings';
import { AffiliateTools } from './AffiliateTools';

type TabType = 'overview' | 'clients' | 'earnings' | 'tools';

export function AffiliateDashboard() {
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { stats, loading } = useAffiliate(user?.id);

  // Detect tab from URL hash
  useEffect(() => {
    const hash = location.hash.replace('#', '') as TabType;
    if (['overview', 'clients', 'earnings', 'tools'].includes(hash)) {
      setActiveTab(hash);
    }
  }, [location.hash]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    navigate(`/affiliate#${tab}`);
    setIsMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const tabs = [
    { id: 'overview', label: t('affiliate.overview'), icon: Home },
    { id: 'tools', label: t('affiliate.tools'), icon: Share2 },
    { id: 'clients', label: t('affiliate.clients'), icon: Users },
    { id: 'earnings', label: t('affiliate.earnings'), icon: DollarSign },
  ];

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="flex flex-col items-center space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <img 
                src="/logo.png" 
                alt="Lush America Translations" 
                className="w-8 h-8 flex-shrink-0 object-contain"
              />
              <h3 className="text-xl font-bold">
                <span className="text-tfe-blue-950">LUSH</span>
                <span className="text-tfe-red-950"> AMERICA TRANSLATIONS</span>
              </h3>
            </div>
          </div>
          <p className="text-gray-600 mt-4">{t('affiliate.loadingAffiliateDashboard')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="lg:hidden bg-white shadow-sm border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img 
              src="/logo.png" 
              alt="Lush America Translations" 
              className="w-6 h-6 flex-shrink-0 object-contain"
            />
            <h1 className="text-lg font-bold text-gray-900">Affiliate</h1>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="flex h-screen bg-gray-50">
        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="fixed inset-0 bg-black bg-opacity-25" onClick={() => setIsMobileMenuOpen(false)} />
            <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg">
              <div className="flex flex-col h-full">
                {/* Mobile Header */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img 
                        src="/logo.png" 
                        alt="Lush America Translations" 
                        className="w-8 h-8 flex-shrink-0 object-contain"
                      />
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">Dashboard</h2>
                        <p className="text-sm text-gray-600">Affiliate</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Mobile User Info */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-tfe-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-tfe-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                      <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    </div>
                  </div>
                </div>

                {/* Mobile Navigation */}
                <nav className="flex-1 p-4 space-y-2">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id as TabType)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                          activeTab === tab.id
                            ? 'bg-tfe-blue-100 text-tfe-blue-700 border border-tfe-blue-200'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm font-medium">{tab.label}</span>
                      </button>
                    );
                  })}

                  {/* Mobile Language Selector */}
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <LanguageSelector />
                  </div>
                </nav>

                {/* Mobile Logout */}
                <div className="mt-4 pt-4 border-t border-gray-200 px-4">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                  >
                    <LogOut className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-medium">{t('affiliate.signOut')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Desktop Sidebar */}
        <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
          <div className="flex flex-col flex-grow bg-white shadow-sm border-r border-gray-200">
            {/* Logo */}
            <div className="flex items-center justify-center p-6 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <img 
                  src="/logo.png" 
                  alt="Lush America Translations" 
                  className="w-8 h-8 flex-shrink-0 object-contain"
                />
                <h3 className="text-xl font-bold">
                  <span className="text-tfe-blue-950">LUSH</span>
                  <span className="text-tfe-red-950"> AMERICA</span>
                </h3>
              </div>
            </div>

            {/* User Info */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-tfe-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-tfe-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id as TabType)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeTab === tab.id
                        ? 'bg-tfe-blue-100 text-tfe-blue-700 border border-tfe-blue-200'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-medium">{tab.label}</span>
                  </button>
                );
              })}

              {/* Language Selector */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <LanguageSelector />
              </div>
            </nav>

            {/* Logout - Fixed at bottom */}
            <div className="flex-shrink-0 mt-4 pt-4 border-t border-gray-200 px-4 pb-4">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{t('affiliate.signOut')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 lg:ml-64">
          <div className="p-4 sm:p-6 lg:p-8">
            {/* Desktop Header */}
            <div className="hidden lg:block mb-6">
              <h1 className="text-2xl font-bold text-gray-900">{t('affiliate.dashboard')}</h1>
              <p className="text-gray-600 mt-1">{t('affiliate.manageCommissions')}</p>
            </div>

            {/* Tab Content */}
            <div className="w-full">
              {activeTab === 'overview' && <AffiliateOverview />}
              {activeTab === 'tools' && <AffiliateTools />}
              {activeTab === 'clients' && <AffiliateClients />}
              {activeTab === 'earnings' && <AffiliateEarnings />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
