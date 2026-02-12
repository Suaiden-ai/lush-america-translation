import { createClient } from '@supabase/supabase-js';

/**
 * Constantes para os nomes dos buckets do Supabase Storage.
 * Centralizar aqui evita erros de "Bucket not found" e facilita renomeações futuras.
 */
export const STORAGE_BUCKETS = {
  DOCUMENTS: 'documents',
  FINAL_FILES: 'arquivosfinaislush',
  PAYMENT_RECEIPTS: 'payment-receipts',
  LOGOS: 'logos'
} as const;

export type StorageBucket = typeof STORAGE_BUCKETS[keyof typeof STORAGE_BUCKETS];

// Verificar variáveis de ambiente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Criar cliente Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Testar conexão
const testConnection = async () => {
  try {
    const { error } = await supabase.auth.getSession();
    if (error) {
      console.error('Supabase auth connection failed:', error);
    } else {
      console.log('Supabase auth connection successful');
    }
  } catch (err) {
    console.error('Supabase connection test failed:', err);
  }
};

testConnection();

export const storageUtils = {
  getPublicUrl: (bucket: string, path: string) => {
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  },

  detectBucket: (filePathOrUrl: string): string => {
    // Se for URL, extrair o bucket do caminho
    if (filePathOrUrl.includes(STORAGE_BUCKETS.FINAL_FILES)) {
      return STORAGE_BUCKETS.FINAL_FILES;
    }
    if (filePathOrUrl.includes(STORAGE_BUCKETS.PAYMENT_RECEIPTS)) {
      return STORAGE_BUCKETS.PAYMENT_RECEIPTS;
    }
    // Fallback para documents
    return STORAGE_BUCKETS.DOCUMENTS;
  },

  /**
   * Obtém uma URL pública ou assinada baseada no bucket
   */
  getSecureUrl: async (bucket: string, path: string, useSignedUrl: boolean = false) => {
    if (useSignedUrl) {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600); // 1 hora
      if (error) throw error;
      return data.signedUrl;
    }
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }
};

/**
 * Helper object 'db' to maintain compatibility with existing code
 */
export const db = {
  /**
   * Busca o código de verificação e informações do documento traduzido
   */
  getVerificationCode: async (documentId: string) => {
    // 1. Primeiro, buscar na tabela documents_to_be_verified (dtbv) que liga a documents
    const { data: dtbv, error: dtbvError } = await supabase
      .from('documents_to_be_verified')
      .select('id, verification_code, status, translated_file_url, authentication_date, authenticated_by_name')
      .eq('original_document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(); // maybeSingle para não dar erro se não existir

    if (!dtbvError && dtbv) {
      // 2. Tentar buscar na tabela translated_documents usando o ID do dtbv
      const { data: translated, error: tError } = await supabase
        .from('translated_documents')
        .select('translated_file_url, verification_code, authentication_date, authenticated_by_name, is_authenticated')
        .eq('original_document_id', dtbv.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!tError && translated) {
        return {
          verification_code: translated.verification_code || dtbv.verification_code || '',
          translated_file_url: translated.translated_file_url || dtbv.translated_file_url || '',
          is_authenticated: translated.is_authenticated ?? (dtbv.status === 'completed'),
          authentication_date: translated.authentication_date || dtbv.authentication_date || null,
          authenticated_by_name: translated.authenticated_by_name || dtbv.authenticated_by_name || null
        };
      }

      // Se não encontrou em translated_documents, retornar os dados do dtbv (que podem ter vindo do n8n)
      return {
        verification_code: dtbv.verification_code || '',
        translated_file_url: dtbv.translated_file_url || '',
        is_authenticated: dtbv.status === 'completed',
        authentication_date: dtbv.authentication_date || null,
        authenticated_by_name: dtbv.authenticated_by_name || null
      };
    }

    // Fallback: tentar na tabela documents se o código estiver lá (casos legados ou simplificados)
    const { data: doc, error: dError } = await supabase
      .from('documents')
      .select('verification_code, file_url, status')
      .eq('id', documentId)
      .single();

    if (!dError && doc) {
      return {
        verification_code: doc.verification_code || '',
        translated_file_url: doc.file_url || '',
        is_authenticated: doc.status === 'completed',
        authentication_date: null,
        authenticated_by_name: null
      };
    }

    return null;
  },

  /**
   * Baixa um arquivo do storage e retorna como Blob
   * Tenta primeiro via SDK (respeita RLS) e faz fallback para Proxy
   */
  downloadFile: async (path: string, bucket: string = STORAGE_BUCKETS.DOCUMENTS) => {
    try {
      // 1. Tentar download direto via SDK (mais rápido e respeita RLS do usuário)
      const { data, error } = await supabase.storage.from(bucket).download(path);
      if (!error && data) return data;

      console.warn('SDK download failed, trying proxy fallback for:', path);

      // 2. Fallback: Tentar via Proxy (Edge Function)
      const proxyUrl = `${supabaseUrl}/functions/v1/serve-document?bucket=${bucket}&path=${encodeURIComponent(path)}`;
      const response = await fetch(proxyUrl);

      if (response.ok) {
        return await response.blob();
      }

      return null;
    } catch (error) {
      console.error('Error in downloadFile:', error);
      return null;
    }
  },

  /**
   * Baixa um arquivo e dispara o download no navegador
   */
  downloadFileAndTrigger: async (path: string, filename: string, bucket: string = STORAGE_BUCKETS.DOCUMENTS) => {
    const blob = await db.downloadFile(path, bucket);
    if (!blob) return false;

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    return true;
  },

  /**
   * Gera uma URL de visualização temporária (signed) ou proxy
   */
  generateViewUrl: async (url: string) => {
    if (!url) return null;
    if (!url.includes('supabase.co')) return url;

    try {
      const { extractFilePathFromUrl } = await import('../utils/fileUtils');
      const pathInfo = extractFilePathFromUrl(url);
      if (!pathInfo) return url;

      // 1. Tentar gerar Signed URL
      const { data, error } = await supabase.storage
        .from(pathInfo.bucket)
        .createSignedUrl(pathInfo.filePath, 3600);

      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }

      // 2. Fallback: Proxy URL
      console.warn('Signed URL failed, using proxy fallback');
      return `${supabaseUrl}/functions/v1/serve-document?bucket=${pathInfo.bucket}&path=${encodeURIComponent(pathInfo.filePath)}`;
    } catch (e) {
      console.error('Error generating view URL:', e);
      return null;
    }
  }
};