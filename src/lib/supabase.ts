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
    // Primeiro tentar na tabela document_verifications
    const { data: verification, error: vError } = await supabase
      .from('document_verifications')
      .select('verification_code, is_authenticated, authentication_date, authenticated_by_name')
      .eq('document_id', documentId)
      .single();

    if (!vError && verification) {
      // Buscar a URL do arquivo traduzido na tabela translated_documents
      const { data: translated } = await supabase
        .from('translated_documents')
        .select('translated_file_url')
        .eq('document_id', documentId)
        .single();

      return {
        ...verification,
        translated_file_url: translated?.translated_file_url || ''
      };
    }

    // Fallback: tentar na tabela documents se o código estiver lá
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