import React, { useState, useEffect } from 'react';
import { UserCheck, Shield, Clock, CheckCircle, XCircle, AlertCircle, Search, Filter, ChevronDown, ChevronUp, Eye, User, Calendar, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AuthenticatorActivity {
  id: string;
  authenticator_id: string;
  authenticator_name: string;
  authenticator_email: string;
  document_id: string;
  document_name: string;
  action: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  notes?: string;
}

interface Authenticator {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string | null;
  last_activity?: string;
  documents_processed: number;
  documents_pending: number;
}

export function AuthenticatorControl() {
  const [authenticators, setAuthenticators] = useState<Authenticator[]>([]);
  const [activities, setActivities] = useState<AuthenticatorActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAuthenticator, setSelectedAuthenticator] = useState<string | null>(null);

  const fetchAuthenticators = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'authenticator')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const authenticatorsWithStats = await Promise.all(
        (data || []).map(async (auth) => {
          const { count: processedVerified } = await supabase.from('documents_to_be_verified').select('*', { count: 'exact', head: true }).eq('authenticated_by', auth.id).eq('is_authenticated', true);
          const { count: pendingVerified } = await supabase.from('documents_to_be_verified').select('*', { count: 'exact', head: true }).eq('authenticated_by', auth.id).eq('is_authenticated', false);
          const { count: processedTranslated } = await supabase.from('translated_documents').select('*', { count: 'exact', head: true }).eq('authenticated_by', auth.id).eq('is_authenticated', true);
          const { count: pendingTranslated } = await supabase.from('translated_documents').select('*', { count: 'exact', head: true }).eq('authenticated_by', auth.id).eq('is_authenticated', false);

          return {
            ...auth,
            documents_processed: (processedVerified || 0) + (processedTranslated || 0),
            documents_pending: (pendingVerified || 0) + (pendingTranslated || 0),
          };
        })
      );
      setAuthenticators(authenticatorsWithStats);
    } catch (err) {
      console.error('Error fetching authenticators:', err);
      setError('Failed to fetch authenticators');
    }
  };

  const fetchActivities = async () => {
    try {
      const { data: verifiedDocs, error: verifiedError } = await supabase.from('documents_to_be_verified').select(`id, filename, status, created_at, updated_at, authenticated_by, authenticated_by_name, authenticated_by_email, authentication_date, is_authenticated`).not('authenticated_by', 'is', null).order('updated_at', { ascending: false });
      if (verifiedError) throw verifiedError;
      
      const { data: translatedDocs, error: translatedError } = await supabase.from('translated_documents').select(`id, filename, status, created_at, updated_at, authenticated_by, authenticated_by_name, authenticated_by_email, authentication_date, is_authenticated`).not('authenticated_by', 'is', null).order('updated_at', { ascending: false });
      if (translatedError) throw translatedError;

      const verifiedActivities = (verifiedDocs || []).map(doc => ({ id: doc.id, authenticator_id: doc.authenticated_by || 'unknown', authenticator_name: doc.authenticated_by_name || 'Unknown', authenticator_email: doc.authenticated_by_email || 'Unknown', document_id: doc.id, document_name: doc.filename || 'Untitled', action: 'Document Authentication', status: doc.is_authenticated ? 'completed' : 'pending', created_at: doc.created_at, updated_at: doc.updated_at }));
      const translatedActivities = (translatedDocs || []).map(doc => ({ id: doc.id, authenticator_id: doc.authenticated_by || 'unknown', authenticator_name: doc.authenticated_by_name || 'Unknown', authenticator_email: doc.authenticated_by_email || 'Unknown', document_id: doc.id, document_name: doc.filename || 'Untitled', action: 'Translation Authentication', status: doc.is_authenticated ? 'completed' : 'pending', created_at: doc.created_at, updated_at: doc.updated_at }));
      
      const allActivities = [...verifiedActivities, ...translatedActivities].sort((a, b) => new Date(b.updated_at || '').getTime() - new Date(a.updated_at || '').getTime());
      setActivities(allActivities);
    } catch (err) {
      console.error('Error fetching activities:', err);
      setError('Failed to fetch activities');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchAuthenticators(), fetchActivities()]);
      setLoading(false);
    };
    loadData();
  }, []);

  const filteredActivities = activities.filter(activity => {
    const matchesSearch = (activity.authenticator_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || (activity.document_name?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || activity.status === statusFilter;
    const matchesAuthenticator = !selectedAuthenticator || activity.authenticator_id === selectedAuthenticator;
    return matchesSearch && matchesStatus && matchesAuthenticator;
  });

  const totalAuthenticators = authenticators.length;
  const activeAuthenticators = authenticators.filter(auth => auth.documents_pending > 0).length;
  const totalDocumentsProcessed = authenticators.reduce((sum, auth) => sum + auth.documents_processed, 0);
  const totalDocumentsPending = authenticators.reduce((sum, auth) => sum + auth.documents_pending, 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">Loading authenticator data...</p>
      </div>
    );
  }

  return (
    <div className="py-4 sm:py-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Authenticator Control</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Monitor and control authenticator activities</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
            {/* Card 1 */}
            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 border border-gray-100"><div className="flex items-center justify-between"><div className="min-w-0"><p className="text-xs sm:text-sm text-gray-600 font-medium truncate">Total</p><p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{totalAuthenticators}</p></div><div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 ml-2"><UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-blue-800" /></div></div></div>
            {/* Card 2 */}
            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 border border-gray-100"><div className="flex items-center justify-between"><div className="min-w-0"><p className="text-xs sm:text-sm text-gray-600 font-medium truncate">Active</p><p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{activeAuthenticators}</p></div><div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0 ml-2"><Shield className="w-4 h-4 sm:w-5 sm:h-5 text-green-800" /></div></div></div>
            {/* Card 3 */}
            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 border border-gray-100"><div className="flex items-center justify-between"><div className="min-w-0"><p className="text-xs sm:text-sm text-gray-600 font-medium truncate">Processed</p><p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{totalDocumentsProcessed}</p></div><div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0 ml-2"><CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-purple-800" /></div></div></div>
            {/* Card 4 */}
            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 border border-gray-100"><div className="flex items-center justify-between"><div className="min-w-0"><p className="text-xs sm:text-sm text-gray-600 font-medium truncate">Pending</p><p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{totalDocumentsPending}</p></div><div className="w-8 h-8 sm:w-10 sm:h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0 ml-2"><Clock className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-800" /></div></div></div>
        </div>

        {/* Authenticators List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 sm:mb-6">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200"><h3 className="text-lg font-semibold text-gray-900">Authenticators Overview</h3></div>
          
          {/* Mobile View: Cards - Mostra em telas pequenas e esconde em 'lg' para cima */}
          <div className="divide-y divide-gray-200 lg:hidden">
            {authenticators.map((auth) => (
              <div key={auth.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center min-w-0">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0"><span className="text-base font-medium text-gray-700">{auth.name.charAt(0).toUpperCase()}</span></div>
                    <div className="ml-3 min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{auth.name}</p><p className="text-sm text-gray-500 truncate">{auth.email}</p></div>
                  </div>
                  <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${auth.documents_pending > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{auth.documents_pending > 0 ? 'Active' : 'Idle'}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div><p className="text-gray-500">Processed</p><p className="font-medium text-gray-900">{auth.documents_processed}</p></div>
                  <div><p className="text-gray-500">Pending</p><p className="font-medium text-gray-900">{auth.documents_pending}</p></div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Desktop View: Table - Escondido em telas pequenas, vira tabela em 'lg' */}
          <div className="hidden lg:block">
            <table className="w-full">
              <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Authenticator</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Processed</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pending</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th></tr></thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {authenticators.map((auth) => (<tr key={auth.id} className="hover:bg-gray-50"><td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center"><div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0"><span className="text-base font-medium text-gray-700">{auth.name.charAt(0).toUpperCase()}</span></div><div className="ml-4"><div className="text-sm font-medium text-gray-900">{auth.name}</div><div className="text-sm text-gray-500">{auth.email}</div></div></div></td><td className="px-6 py-4 whitespace-nowrap"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${auth.documents_pending > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{auth.documents_pending > 0 ? 'Active' : 'Idle'}</span></td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{auth.documents_processed}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{auth.documents_pending}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(auth.created_at || '').toLocaleDateString()}</td></tr>))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activities Monitor */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-lg font-semibold text-gray-900">Activity Monitor</h3>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm w-full" /></div>
                <button onClick={() => setShowFilters(!showFilters)} className="flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"><Filter className="w-4 h-4" />Filter{showFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}</button>
              </div>
            </div>
            {showFilters && (<div className="mt-4 pt-4 border-t border-gray-200"><div className="flex flex-col sm:flex-row gap-2"><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm w-full"><option value="all">All Status</option><option value="pending">Pending</option><option value="completed">Completed</option><option value="rejected">Rejected</option><option value="draft">Draft</option></select><select value={selectedAuthenticator || ''} onChange={(e) => setSelectedAuthenticator(e.target.value || null)} className="py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm w-full"><option value="">All Authenticators</option>{authenticators.map((auth) => (<option key={auth.id} value={auth.id}>{auth.name}</option>))}</select></div></div>)}
          </div>
          <div className="px-4 sm:px-6 py-2 bg-gray-50 border-b border-gray-200"><p className="text-xs text-gray-500">Showing {filteredActivities.length} of {activities.length} activities</p></div>
          
          {/* Mobile View: Cards */}
          <div className="divide-y divide-gray-200 lg:hidden">
            {filteredActivities.map((activity) => (
              <div key={activity.id} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-gray-500 uppercase font-semibold">Authenticator</p>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(activity.status)}`}>{getStatusIcon(activity.status)}<span className="capitalize">{activity.status}</span></span>
                </div>
                <div className="flex items-center min-w-0 mb-3"><div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0"><span className="text-sm font-medium text-gray-700">{activity.authenticator_name.charAt(0).toUpperCase()}</span></div><div className="ml-3 min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{activity.authenticator_name}</p><p className="text-xs text-gray-500 truncate">{activity.authenticator_email}</p></div></div>
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Document</p>
                  <div className="flex items-center text-sm text-gray-800"><FileText className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" /><span className="truncate">{activity.document_name}</span></div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop View: Table */}
          <div className="hidden lg:block">
            <table className="w-full">
              <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Authenticator</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Document</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Activity</th></tr></thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredActivities.map((activity) => (<tr key={activity.id} className="hover:bg-gray-50"><td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center"><div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0"><span className="text-base font-medium text-gray-700">{activity.authenticator_name.charAt(0).toUpperCase()}</span></div><div className="ml-4"><div className="text-sm font-medium text-gray-900">{activity.authenticator_name}</div><div className="text-sm text-gray-500">{activity.authenticator_email}</div></div></div></td><td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center"><FileText className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" /><span className="text-sm text-gray-900" title={activity.document_name}>{activity.document_name}</span></div></td><td className="px-6 py-4 whitespace-nowrap"><span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(activity.status)}`}>{getStatusIcon(activity.status)}<span className="capitalize">{activity.status}</span></span></td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{activity.updated_at ? new Date(activity.updated_at).toLocaleString() : 'N/A'}</td></tr>))}
              </tbody>
            </table>
          </div>

          {filteredActivities.length === 0 && (<div className="p-8 text-center text-gray-500"><Search className="w-10 h-10 mx-auto mb-3 text-gray-300" /><p className="text-base font-medium">No activities found</p><p className="text-sm text-gray-400 mt-1">Try adjusting your search or filters.</p></div>)}
        </div>
      </div>
    </div>
  );
}