import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface OverviewStats {
  totalDocuments: number;
  pendingDocuments: number;
  approvedDocuments: number;
  rejectedDocuments: number;
  totalValue: number;
  totalPages: number;
  myAuthentications: number;
  myAuthenticationsThisMonth: number;
  myTranslations: number; // Documentos enviados pelo autenticador para tradução
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

interface OverviewContextType {
  stats: OverviewStats;
  loading: boolean;
  error: string | null;
  refreshStats: () => Promise<void>;
  lastUpdated: Date | null;
}

const OverviewContext = createContext<OverviewContextType | undefined>(undefined);

export function OverviewProvider({ children }: { children: React.ReactNode }) {
  const { user: currentUser } = useAuth();
  const [stats, setStats] = useState<OverviewStats>({
    totalDocuments: 0,
    pendingDocuments: 0,
    approvedDocuments: 0,
    rejectedDocuments: 0,
    totalValue: 0,
    totalPages: 0,
    myAuthentications: 0,
    myAuthenticationsThisMonth: 0,
    myTranslations: 0,
    myTranslationsThisMonth: 0,
    averageProcessingTime: 0,
    topLanguages: [],
    recentActivity: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchOverviewStats = useCallback(async (forceRefresh = false) => {
    if (!currentUser) return;

    // Check if we have recent data (less than 30 seconds old)
    const now = new Date();
    const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);
    
    if (!forceRefresh && lastUpdated && lastUpdated > thirtySecondsAgo) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch documents based on user role
      let allDocumentsQuery = supabase.from('documents_to_be_verified').select('*');
      let translatedDocsQuery = supabase.from('translated_documents').select('*');
      let myUploadedDocsQuery = supabase.from('documents_to_be_verified').select('*');

      // If not admin, filter by authenticated_by for translated docs
      if (currentUser.role !== 'admin') {
        translatedDocsQuery = translatedDocsQuery.eq('authenticated_by', currentUser.id);
        // Also get documents uploaded by this authenticator
        myUploadedDocsQuery = myUploadedDocsQuery.eq('user_id', currentUser.id);
      }

      const { data: allDocuments, error: allError } = await allDocumentsQuery;
      if (allError) throw allError;

      const { data: translatedDocs, error: translatedError } = await translatedDocsQuery;
      if (translatedError) throw translatedError;

      const { data: myUploadedDocs, error: uploadError } = await myUploadedDocsQuery;
      if (uploadError) throw uploadError;

      // Calculate statistics based on user role
      let totalDocs, pendingDocs, approvedDocs, rejectedDocs, totalValue, totalPages;

      if (currentUser.role === 'admin') {
        // Admin sees all documents
        totalDocs = allDocuments?.length || 0;
        pendingDocs = allDocuments?.filter(doc => doc.status === 'pending').length || 0;
        approvedDocs = allDocuments?.filter(doc => doc.status === 'completed').length || 0;
        rejectedDocs = allDocuments?.filter(doc => doc.status === 'rejected').length || 0;
        // Filtrar documentos com pagamentos cancelados ou reembolsados
        const validAllDocuments = allDocuments?.filter(doc => {
          if (!doc.payment_status) return true; // Incluir se não há payment_status
          return doc.payment_status !== 'cancelled' && doc.payment_status !== 'refunded';
        }) || [];
        
        const validTranslatedDocs = translatedDocs?.filter(doc => {
          if (!doc.payment_status) return true; // Incluir se não há payment_status
          return doc.payment_status !== 'cancelled' && doc.payment_status !== 'refunded';
        }) || [];
        
        totalValue = (validAllDocuments.reduce((sum, doc) => sum + (doc.total_cost || 0), 0)) +
                    (validTranslatedDocs.reduce((sum, doc) => sum + (doc.total_cost || 0), 0));
        totalPages = (allDocuments?.reduce((sum, doc) => sum + (doc.pages || 0), 0) || 0) +
                    (translatedDocs?.reduce((sum, doc) => sum + (doc.pages || 0), 0) || 0);
      } else {
        // Authenticator sees their authenticated documents + pending documents they can review
        totalDocs = translatedDocs?.length || 0;
        pendingDocs = allDocuments?.filter(doc => doc.status === 'pending').length || 0; // All pending docs
        approvedDocs = translatedDocs?.length || 0; // All translated docs are approved
        rejectedDocs = 0; // Rejected docs are not in translated_documents
        // Filtrar documentos com pagamentos cancelados ou reembolsados para autenticadores
        const validTranslatedDocsForAuth = translatedDocs?.filter(doc => {
          if (!doc.payment_status) return true; // Incluir se não há payment_status
          return doc.payment_status !== 'cancelled' && doc.payment_status !== 'refunded';
        }) || [];
        
        totalValue = validTranslatedDocsForAuth.reduce((sum, doc) => sum + (doc.total_cost || 0), 0);
        totalPages = translatedDocs?.reduce((sum, doc) => sum + (doc.pages || 0), 0) || 0;
      }

      // My authentications (always based on current user)
      const myAuths = translatedDocs?.filter(doc => doc.authenticated_by === currentUser.id).length || 0;

      // My translations (documents uploaded by authenticator)
      const myTranslations = currentUser.role !== 'admin' ? (myUploadedDocs?.length || 0) : 0;

      // Authentications this month
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);

      const myAuthsThisMonth = translatedDocs?.filter(doc =>
        doc.authenticated_by === currentUser.id &&
        doc.authentication_date &&
        new Date(doc.authentication_date) >= thisMonth
      ).length || 0;

      // My translations this month (documents uploaded by authenticator this month)
      const myTranslationsThisMonth = currentUser.role !== 'admin' ? (myUploadedDocs?.filter(doc =>
        doc.created_at &&
        new Date(doc.created_at) >= thisMonth
      ).length || 0) : 0;

      // Calculate average processing time (mock data for now)
      const averageProcessingTime = 2.5; // hours

      // Top languages (based on available documents)
      const languageCounts: { [key: string]: number } = {};
      const docsForLanguages = currentUser.role === 'admin' ? allDocuments : translatedDocs;
      
      docsForLanguages?.forEach(doc => {
        if (doc.source_language && doc.target_language) {
          const langPair = `${doc.source_language} → ${doc.target_language}`;
          languageCounts[langPair] = (languageCounts[langPair] || 0) + 1;
        }
      });

      const topLanguages = Object.entries(languageCounts)
        .map(([language, count]) => ({ language, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Recent activity (my authentications + my uploads)
      const authActivity = translatedDocs
        ?.filter(doc => doc.authenticated_by === currentUser.id)
        .map(doc => ({
          id: doc.id,
          filename: doc.filename,
          action: 'Authenticated',
          date: doc.authentication_date || '',
          user_name: 'You',
          type: 'auth' as const
        })) || [];

      const uploadActivity = currentUser.role !== 'admin' ? (myUploadedDocs
        ?.map(doc => ({
          id: doc.id,
          filename: doc.filename,
          action: doc.client_name ? `Uploaded for ${doc.client_name}` : 'Uploaded for translation',
          date: doc.created_at || '',
          user_name: 'You',
          type: 'upload' as const
        })) || []) : [];

      const recentActivity = [...authActivity, ...uploadActivity]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 8)
        .map(({ type, ...activity }) => activity);

      const newStats = {
        totalDocuments: totalDocs,
        pendingDocuments: pendingDocs,
        approvedDocuments: approvedDocs,
        rejectedDocuments: rejectedDocs,
        totalValue,
        totalPages,
        myAuthentications: myAuths,
        myAuthenticationsThisMonth: myAuthsThisMonth,
        myTranslations,
        myTranslationsThisMonth,
        averageProcessingTime,
        topLanguages,
        recentActivity
      };

      setStats(newStats);
      setLastUpdated(now);

    } catch (err: any) {
      console.error('[OverviewContext] Error fetching stats:', err);
      setError(err.message || 'Error fetching overview statistics');
    } finally {
      setLoading(false);
    }
  }, [currentUser, lastUpdated]);

  const refreshStats = useCallback(async () => {
    await fetchOverviewStats(true);
  }, [fetchOverviewStats]);

  // Initial fetch
  useEffect(() => {
    fetchOverviewStats();
  }, [fetchOverviewStats]);

  return (
    <OverviewContext.Provider value={{
      stats,
      loading,
      error,
      refreshStats,
      lastUpdated
    }}>
      {children}
    </OverviewContext.Provider>
  );
}

export function useOverview() {
  const context = useContext(OverviewContext);
  if (context === undefined) {
    throw new Error('useOverview must be used within an OverviewProvider');
  }
  return context;
} 