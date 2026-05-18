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

      // 1. Buscar a lista de todos os documentos (apenas user_id para performance)
      const { data: docList, error: docListError } = await supabase
        .from('documents')
        .select('user_id');

      if (docListError) throw docListError;

      // Mapear contagem de documentos por usuário
      const docCountsMap: Record<string, number> = {};
      if (docList) {
        docList.forEach((doc) => {
          if (doc.user_id) {
            docCountsMap[doc.user_id] = (docCountsMap[doc.user_id] || 0) + 1;
          }
        });
      }

      // 2. Buscar a lista de logs de atividades (ordenados por mais recente)
      const { data: recentLogs, error: logsError } = await supabase
        .from('action_logs')
        .select('created_at, performed_by, affected_user_id')
        .order('created_at', { ascending: false });

      if (logsError) throw logsError;

      // Mapear última atividade por usuário (performed_by ou affected_user_id)
      const lastActivityMap: Record<string, string> = {};
      if (recentLogs) {
        recentLogs.forEach((log) => {
          if (log.performed_by && !lastActivityMap[log.performed_by]) {
            lastActivityMap[log.performed_by] = log.created_at;
          }
          if (log.affected_user_id && !lastActivityMap[log.affected_user_id]) {
            lastActivityMap[log.affected_user_id] = log.created_at;
          }
        });
      }

      // 3. Montar a resposta combinada em memória
      const clientsWithStats = (profiles || []).map((profile) => ({
        ...profile,
        documents_count: docCountsMap[profile.id] || 0,
        last_activity: lastActivityMap[profile.id] || null,
      }));

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