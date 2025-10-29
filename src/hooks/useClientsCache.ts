import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface Client {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  documents_count: number;
  last_activity: string | null;
}

interface UseClientsCacheReturn {
  clients: Client[];
  loading: boolean;
  error: string | null;
  refreshClients: () => Promise<void>;
  lastUpdated: Date | null;
}

// Cache global para evitar múltiplas instâncias
let globalClientsCache: Client[] = [];
let globalLastUpdated: Date | null = null;
let globalLoading = false;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export const useClientsCache = (): UseClientsCacheReturn => {
  const [clients, setClients] = useState<Client[]>(globalClientsCache);
  const [loading, setLoading] = useState(globalLoading);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(globalLastUpdated);

  const fetchClients = useCallback(async (forceRefresh = false) => {
    // Se já está carregando, não fazer nova requisição
    if (globalLoading) return;

    // Verificar se o cache ainda é válido
    const now = new Date();
    const isCacheValid = globalLastUpdated && 
      (now.getTime() - globalLastUpdated.getTime()) < CACHE_DURATION;

    // Se cache é válido e não é refresh forçado, usar cache
    if (isCacheValid && !forceRefresh && globalClientsCache.length > 0) {
      setClients(globalClientsCache);
      setLastUpdated(globalLastUpdated);
      return;
    }

    globalLoading = true;
    setLoading(true);
    setError(null);

    try {
      // Buscar todos os usuários que não são admin/authenticator/finance
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['user', 'affiliate'])
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Buscar contagem de documentos e última atividade para cada usuário
      const clientsWithStats = await Promise.all(
        (profiles || []).map(async (profile) => {
          // Contar documentos
          const { count } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', profile.id);

          // Buscar última atividade (logs onde o usuário é performer OU afetado)
          const { data: lastLogs } = await supabase
            .from('action_logs')
            .select('created_at')
            .or(`performed_by.eq.${profile.id},affected_user_id.eq.${profile.id}`)
            .order('created_at', { ascending: false })
            .limit(1);

          return {
            ...profile,
            documents_count: count || 0,
            last_activity: lastLogs && lastLogs.length > 0 ? lastLogs[0].created_at : null,
          };
        })
      );

      // Ordenar clientes pela última atividade (mais recente primeiro)
      const sortedClients = clientsWithStats.sort((a, b) => {
        if (!a.last_activity && !b.last_activity) return 0;
        if (!a.last_activity) return 1;
        if (!b.last_activity) return -1;
        return new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime();
      });

      // Atualizar cache global
      globalClientsCache = sortedClients;
      globalLastUpdated = new Date();
      
      // Atualizar estado local
      setClients(sortedClients);
      setLastUpdated(globalLastUpdated);
      setError(null);
    } catch (err) {
      console.error('[useClientsCache] Error fetching clients:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch clients';
      setError(errorMessage);
    } finally {
      globalLoading = false;
      setLoading(false);
    }
  }, []);

  const refreshClients = useCallback(() => {
    return fetchClients(true);
  }, [fetchClients]);

  // Carregar clientes apenas uma vez no mount
  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  return {
    clients,
    loading,
    error,
    refreshClients,
    lastUpdated,
  };
};