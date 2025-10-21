import { useState, useEffect } from 'react';

export interface CachedClient {
  data: any[];
  timestamp: number;
}

export interface ClientsCache {
  [affiliateId: string]: CachedClient;
}

/**
 * Hook para gerenciar cache de clientes de afiliados
 * Cache válido por 5 minutos
 */
export const useClientsCache = () => {
  const [clientsCache, setClientsCache] = useState<ClientsCache>({});

  // Carrega cache do localStorage na inicialização
  useEffect(() => {
    loadClientsCache();
  }, []);

  /**
   * Carrega cache do localStorage
   */
  const loadClientsCache = () => {
    try {
      const cached = localStorage.getItem('affiliateClientsCache');
      if (cached) {
        const parsedCache = JSON.parse(cached);
        setClientsCache(parsedCache);
      }
    } catch (error) {
      console.error('Error loading clients cache:', error);
    }
  };

  /**
   * Salva dados de clientes no cache
   */
  const saveClientsCache = (affiliateId: string, clients: any[]) => {
    const newCache = {
      ...clientsCache,
      [affiliateId]: {
        data: clients,
        timestamp: Date.now()
      }
    };
    setClientsCache(newCache);
    try {
      localStorage.setItem('affiliateClientsCache', JSON.stringify(newCache));
    } catch (error) {
      console.error('Error saving clients cache:', error);
    }
  };

  /**
   * Verifica se o cache é válido (5 minutos)
   */
  const isCacheValid = (affiliateId: string): boolean => {
    const cached = clientsCache[affiliateId];
    if (!cached) return false;
    const fiveMinutes = 5 * 60 * 1000;
    return Date.now() - cached.timestamp < fiveMinutes;
  };

  /**
   * Obtém dados do cache se válido
   */
  const getCachedClients = (affiliateId: string): any[] | null => {
    const cached = clientsCache[affiliateId];
    if (cached && isCacheValid(affiliateId)) {
      return cached.data;
    }
    return null;
  };

  /**
   * Limpa cache de um afiliado específico
   */
  const clearAffiliateCache = (affiliateId: string) => {
    const newCache = { ...clientsCache };
    delete newCache[affiliateId];
    setClientsCache(newCache);
    try {
      localStorage.setItem('affiliateClientsCache', JSON.stringify(newCache));
    } catch (error) {
      console.error('Error clearing affiliate cache:', error);
    }
  };

  /**
   * Limpa todo o cache
   */
  const clearAllCache = () => {
    setClientsCache({});
    try {
      localStorage.removeItem('affiliateClientsCache');
    } catch (error) {
      console.error('Error clearing all cache:', error);
    }
  };

  return {
    clientsCache,
    saveClientsCache,
    isCacheValid,
    getCachedClients,
    clearAffiliateCache,
    clearAllCache,
    loadClientsCache
  };
};
