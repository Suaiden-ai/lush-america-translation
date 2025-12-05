import React from 'react';
import { useOverview } from '../../contexts/OverviewContext';
import { useAuth } from '../../hooks/useAuth';
import { useDocumentsWithMissingFiles } from '../../hooks/useDocumentsWithMissingFiles';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  DollarSign, 
  ShieldCheck, 
  TrendingUp, 
  Globe, 
  RefreshCw,
  Home as HomeIcon,
  FileText as FileTextIcon,
  CheckCircle as CheckCircleIcon,
  XCircle,
  BarChart3,
  Home,
  Upload
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useNavigate } from 'react-router-dom';

interface OverviewStats {
  totalDocuments: number;
  pendingDocuments: number;
  approvedDocuments: number;
  rejectedDocuments: number;
  totalValue: number;
  totalPages: number;
  myAuthentications: number;
  myAuthenticationsThisMonth: number;
  myTranslations: number;
  myTranslationsThisMonth: number;
  averageProcessingTime: number;
  topLanguages: Array<{ language: string; count: number }>;
  recentActivity: Array<{
    id: string;
    filename: string;
    action: string;
    date: string;
    user_name: string;
  }>;
}

interface AuthenticatorOverviewProps {
  onNavigate?: (page: 'authenticate' | 'translated' | 'upload') => void;
}

export default function AuthenticatorOverview({ onNavigate }: AuthenticatorOverviewProps) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { stats, loading, error, refreshStats, lastUpdated } = useOverview();
  // Buscar documentos pendentes de reupload (para clientes)
  const { documents: missingFileDocuments, count: missingFileCount, loading: loadingMissingFiles } = useDocumentsWithMissingFiles();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" color="blue" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-tfe-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-tfe-red-600" />
          </div>
          <p className="text-tfe-red-600">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-4 sm:py-8 px-3 sm:px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 mb-6 sm:mb-8 p-4 sm:p-6 bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4 sm:gap-6">
            <ShieldCheck className="w-10 h-10 sm:w-12 sm:h-12 text-gray-600" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
                {currentUser?.role === 'admin' ? 'Admin Overview' : 'Authenticator Overview'}
              </h1>
              <p className="text-sm sm:text-base text-gray-600">
                {currentUser?.role === 'admin' 
                  ? 'Welcome back! Here\'s your complete system overview.' 
                  : 'Welcome back! Here\'s your personal authentication dashboard.'
                }
                {lastUpdated && (
                  <span className="block text-xs text-gray-500 mt-1">
                    Last updated: {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={refreshStats}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              title="Refresh data"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="blue" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Main Stats Cards */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${currentUser?.role !== 'admin' && missingFileCount > 0 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4 sm:gap-6 mb-6 sm:mb-8`}>
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm sm:text-base text-gray-600 mb-1">
                  {currentUser?.role === 'admin' ? 'Total Documents' : 'My Authenticated'}
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-tfe-blue-600">{stats.myAuthentications}</p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-tfe-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm sm:text-base text-gray-600 mb-1">Pending</p>
                <p className="text-2xl sm:text-3xl font-bold text-tfe-red-600">{stats.pendingDocuments}</p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-tfe-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm sm:text-base text-gray-600 mb-1">
                  {currentUser?.role === 'admin' ? 'Approved' : 'Completed'}
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-tfe-blue-600">{stats.approvedDocuments}</p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-tfe-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm sm:text-base text-gray-600 mb-1">
                  {currentUser?.role === 'admin' ? 'Total Value' : 'My Value'}
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-tfe-red-600">${stats.totalValue.toFixed(2)}</p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-tfe-red-600" />
              </div>
            </div>
          </div>

          {/* Pending Reupload Card - Only for Authenticators */}
          {currentUser?.role !== 'admin' && missingFileCount > 0 && (
            <div 
              onClick={() => navigate('/authenticator/failed-uploads')}
              className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm sm:text-base text-gray-600 mb-1">Pending Reupload</p>
                  <p className="text-2xl sm:text-3xl font-bold text-tfe-red-600">{missingFileCount}</p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center">
                  <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Top Languages */}
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-gray-600" />
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                {currentUser?.role === 'admin' ? 'Top Languages' : 'My Top Languages'}
              </h2>
            </div>
            
            <div className="space-y-3">
              {stats.topLanguages.length > 0 ? (
                stats.topLanguages.map((lang, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                    <span className="text-sm sm:text-base font-medium text-gray-700">{lang.language}</span>
                    <span className="text-sm sm:text-base font-bold text-gray-900">{lang.count}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm sm:text-base text-gray-500 text-center py-4">No language data available</p>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-gray-600" />
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                {currentUser?.role === 'admin' ? 'Recent Activity' : 'My Recent Activity'}
              </h2>
            </div>
            
            <div className="space-y-3">
              {stats.recentActivity.length > 0 ? (
                stats.recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm sm:text-base font-medium text-gray-900 truncate">{activity.filename}</p>
                      <p className="text-xs sm:text-sm text-gray-500">
                        {activity.action} • {new Date(activity.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm sm:text-base text-gray-500 text-center py-4">No recent activity</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 