import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

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
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Supabase auth connection failed:', error);
    }
  } catch (err) {
    console.error('Supabase connection test failed:', err);
  }
};

testConnection();

// Auth helpers
export const auth = {
  signUp: async (email: string, password: string, name: string) => {
    console.log('[auth.signUp] Iniciando signup', { email });
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name
        }
      }
    });
    if (authError) {
      console.error('[auth.signUp] Erro no signup:', authError);
        throw authError;
    }
    console.log('[auth.signUp] Signup realizado com sucesso', { authData });
    return authData;
  },

  signIn: async (email: string, password: string) => {
    console.log('[auth.signIn] Iniciando login', { email });
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      console.error('[auth.signIn] Erro no login:', error);
      throw error;
    }
    console.log('[auth.signIn] Login realizado com sucesso', { data });
    return data;
  },

  signOut: async () => {
    console.log('[auth.signOut] Iniciando signout');
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[auth.signOut] Erro no signout:', error);
      throw error;
    }
    console.log('[auth.signOut] Signout realizado com sucesso');
  },

  getCurrentUser: async () => {
    console.log('[auth.getCurrentUser] Buscando usuário atual');
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.error('[auth.getCurrentUser] Erro ao buscar usuário:', error);
      throw error;
    }
    if (user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (profileError) {
        console.error('[auth.getCurrentUser] Erro ao buscar profile:', profileError);
        throw profileError;
      }
      console.log('[auth.getCurrentUser] Profile encontrado', { profile });
      return profile;
    }
    console.log('[auth.getCurrentUser] Nenhum usuário logado');
    return null;
  }
};

// Database helpers
export const db = {
  // Documents
  getDocuments: async (userId: string) => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getAllDocuments(): Promise<Document[]> {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching all documents:', error);
        throw error;
      }

      return data || [];
    } catch (err) {
      console.error('Error in getAllDocuments:', err);
      throw err;
    }
  },

  createDocument: async (document: {
    user_id: string;
    folder_id?: string | null;
    filename: string;
    pages: number;
    total_cost: number;
    file_url?: string;
    verification_code: string; // Adicionar campo obrigatório
    client_name?: string | null;
  }) => {
    console.log('[db.createDocument] Inserindo documento:', JSON.stringify(document, null, 2));
    const { data, error } = await supabase
      .from('documents')
      .insert(document)
      .select()
      .single();
    if (error) {
      console.error('[db.createDocument] Erro no insert:', error, JSON.stringify(error, null, 2));
      throw error;
    }
    return data;
  },

  updateDocumentStatus: async (documentId: string, status: 'pending' | 'processing' | 'completed') => {
    const { data, error } = await supabase
      .from('documents')
      .update({ status })
      .eq('id', documentId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  verifyDocument: async (verificationCode: string) => {
    const { data, error } = await supabase
      .from('translated_documents')
      .select('*')
      .ilike('verification_code', verificationCode)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }
    
    return data;
  },

  // Folders
  getFolders: async (userId: string) => {
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  createFolder: async (folder: {
    user_id: string;
    name: string;
    parent_id?: string;
    color?: string;
  }) => {
    const { data, error } = await supabase
      .from('folders')
      .insert(folder)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  updateFolder: async (folderId: string, updates: { name?: string; color?: string; parent_id?: string | null }) => {
    const { data, error } = await supabase
      .from('folders')
      .update(updates)
      .eq('id', folderId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  deleteFolder: async (folderId: string) => {
    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', folderId);
    
    if (error) throw error;
  },

  getTranslatedDocuments: async (userId: string) => {
    const { data, error } = await supabase
      .from('translated_documents')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  getVerificationCode: async (documentId: string) => {
    // Busca o código de verificação real na tabela translated_documents
    // Primeiro busca o documento em documents_to_be_verified que corresponde ao documento original
    const { data: toBeVerifiedData, error: toBeVerifiedError } = await supabase
      .from('documents_to_be_verified')
      .select('id, filename, status')
      .eq('id', documentId)
      .single();
    
    if (toBeVerifiedError) {
      if (toBeVerifiedError.code === 'PGRST116') {
        // Documento não encontrado na tabela de documentos a serem verificados
        return null;
      }
      throw toBeVerifiedError;
    }
    
    // Agora busca o documento traduzido usando o ID do documento a ser verificado
    const { data, error } = await supabase
      .from('translated_documents')
      .select('verification_code, original_document_id, filename, translated_file_url, is_authenticated, authentication_date, authenticated_by_name')
      .eq('original_document_id', toBeVerifiedData.id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // Documento não encontrado na tabela de traduzidos
        return null;
      }
      throw error;
    }
    
    return data;
  },

  // Função helper para detectar bucket baseado no filePath ou URL
  detectBucket: (filePathOrUrl: string): string => {
    // Se for URL, extrair o bucket do caminho
    if (filePathOrUrl.includes('arquivosfinaislush')) {
      return 'arquivosfinaislush';
    }
    if (filePathOrUrl.includes('payment-receipts')) {
      return 'payment-receipts';
    }
    // Fallback para documents
    return 'documents';
  },

  // Função para download direto do arquivo (bucket público - sem autenticação necessária)
  downloadFile: async (filePath: string, bucketName?: string): Promise<Blob | null> => {
    try {
      const bucket = bucketName || db.detectBucket(filePath);
      
      // Limpar filePath de possíveis duplicatas de bucket
      let cleanFilePath = filePath;
      if (cleanFilePath.startsWith(`${bucket}/`)) {
        cleanFilePath = cleanFilePath.substring(bucket.length + 1);
      }
      
      console.log('[downloadFile] Tentando fazer download:', { bucket, cleanFilePath });
      
      // Tentar download direto (funciona para buckets públicos)
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(cleanFilePath);
      
      if (error) {
        console.error('[downloadFile] Erro ao fazer download do arquivo:', {
          error,
          message: error.message,
          name: error.name,
          bucket,
          filePath: cleanFilePath
        });
        
        // Se erro de acesso, tentar usar URL pública como fallback
        if (error.message?.includes('JWT') || error.message?.includes('token') ||
            error.message?.includes('authentication') || error.message?.includes('unauthorized') ||
            error.message?.includes('401') || error.message?.includes('403')) {
          console.log('[downloadFile] Erro de autenticação, tentando URL pública como fallback');
          
          // Gerar URL pública e fazer fetch direto
          const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(cleanFilePath);
          
          try {
            const response = await fetch(publicUrl);
            if (response.ok) {
              const blob = await response.blob();
              console.log('[downloadFile] Download via URL pública realizado com sucesso.');
              return blob;
            }
          } catch (fetchError) {
            console.error('[downloadFile] Erro ao fazer fetch da URL pública:', fetchError);
          }
        }
        
        throw new Error('DOWNLOAD_ERROR');
      }
      
      if (!data) {
        console.error('[downloadFile] Download retornou null sem erro.');
        throw new Error('FILE_NOT_FOUND');
      }
      
      console.log('[downloadFile] Download realizado com sucesso.');
      return data;
    } catch (error: any) {
      console.error('[downloadFile] Erro ao fazer download do arquivo:', error);
      
      // Se já é um erro genérico (DOWNLOAD_ERROR, FILE_NOT_FOUND), apenas re-lançar
      if (error?.message === 'DOWNLOAD_ERROR' || error?.message === 'FILE_NOT_FOUND') {
        throw error;
      }
      
      // Para outros erros, converter para erro genérico
      throw new Error('DOWNLOAD_ERROR');
    }
  },

  // Função para download e iniciar download automático (bucket público - sem autenticação necessária)
  downloadFileAndTrigger: async (filePath: string, filename: string, bucketName?: string): Promise<boolean> => {
    try {
      console.log('[downloadFileAndTrigger] Iniciando download:', { filePath, filename, bucketName });
      
      // Importar helpers dinamicamente para evitar dependência circular
      const { logError, showUserFriendlyError } = await import('../utils/errorHelpers');
      
      const blob = await db.downloadFile(filePath, bucketName);
      
      if (!blob) {
        console.error('[downloadFileAndTrigger] Download retornou null.');
        
        // Obter userId para logging (se disponível, mas não obrigatório)
        let userId: string | undefined;
        try {
          const { data: { user } } = await supabase.auth.getUser();
          userId = user?.id;
        } catch (e) {
          // Ignorar erro de autenticação - não é necessário para download
        }
        
        // Logar erro
        await logError('download', new Error('Download retornou null'), {
          userId,
          filePath,
          filename,
          bucket: bucketName,
        });
        
        // Mostrar mensagem amigável
        showUserFriendlyError('DOWNLOAD_ERROR');
        
        return false;
      }
      
      // Criar URL local do blob para download
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      console.log('[downloadFileAndTrigger] Download iniciado com sucesso.');
      return true;
    } catch (error: any) {
      console.error('[downloadFileAndTrigger] Erro ao fazer download e iniciar download:', {
        error,
        message: error?.message,
        filePath,
        filename
      });
      
      // Importar helpers dinamicamente
      const { logError, showUserFriendlyError } = await import('../utils/errorHelpers');
      
      // Obter userId para logging (se disponível, mas não obrigatório)
      let userId: string | undefined;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id;
      } catch (e) {
        // Ignorar erro de autenticação - não é necessário para download
      }
      
      // Logar erro
      await logError('download', error, {
        userId,
        filePath,
        filename,
        bucket: bucketName,
        additionalInfo: {
          error_code: error?.code,
          error_name: error?.name,
        },
      });
      
      // Mostrar mensagem amigável
      showUserFriendlyError('DOWNLOAD_ERROR');
      
      return false;
    }
  },

  // Função para gerar URL pública permanente (não expira)
  // Funciona para buckets públicos - não requer autenticação
  generatePublicUrl: async (filePath: string, bucketName: string = 'documents') => {
    try {
      // Limpar filePath de possíveis duplicatas de bucket
      let cleanFilePath = filePath;
      if (cleanFilePath.startsWith(`${bucketName}/`)) {
        cleanFilePath = cleanFilePath.substring(bucketName.length + 1);
      }
      
      const { data } = await supabase.storage
        .from(bucketName)
        .getPublicUrl(cleanFilePath);
      
      if (!data?.publicUrl) {
        console.error('[generatePublicUrl] Erro ao gerar URL pública: data ou publicUrl não disponível');
        return null;
      }
      
      return data.publicUrl;
    } catch (error) {
      console.error('[generatePublicUrl] Erro ao gerar URL pública:', error);
      return null;
    }
  },

  // Função para gerar URL pré-assinado com tempo maior (30 dias)
  generateSignedUrl: async (filePath: string, bucketName: string = 'documents') => {
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, 2592000); // 30 dias de validade
      
      if (error) {
        console.error('Erro ao gerar URL:', error);
        return null;
      }
      
      return data.signedUrl;
    } catch (error) {
      console.error('Erro ao gerar URL do arquivo:', error);
      return null;
    }
  },

  // Função helper para gerar URL pública para visualização (bucket público - não requer autenticação)
  // Extrai filePath da URL, gera URL pública permanente e retorna
  // Se não conseguir extrair filePath, tenta usar URL original (para S3 externo)
  generateViewUrl: async (url: string): Promise<string | null> => {
    try {
      // Importar helpers dinamicamente para evitar dependência circular
      const { extractFilePathFromUrl } = await import('../utils/fileUtils');
      const { logError } = await import('../utils/errorHelpers');
      
      const pathInfo = extractFilePathFromUrl(url);
      
      if (!pathInfo) {
        // Se não conseguir extrair filePath, pode ser URL externa (S3) ou URL malformada
        if (url.includes('supabase.co')) {
          // Logar erro de URL malformada do Supabase (se usuário estiver logado)
          try {
            const { data: { user } } = await supabase.auth.getUser();
            await logError('system', new Error('Não foi possível extrair filePath de URL do Supabase'), {
              userId: user?.id,
              additionalInfo: {
                url,
                error_type: 'url_parsing_failed',
              },
            });
          } catch (e) {
            // Ignorar erro de autenticação - não é necessário
          }
          return null;
        }
        // Se for URL externa (S3), retornar como está
        return url;
      }
      
      // Gerar URL pública permanente (não expira) para visualização
      const { data: publicUrlData } = await supabase.storage
        .from(pathInfo.bucket)
        .getPublicUrl(pathInfo.filePath);
      
      if (publicUrlData?.publicUrl) {
        return publicUrlData.publicUrl;
      } else {
        console.error('Erro ao gerar URL pública para visualização: data ou publicUrl não disponível');
        
        // Logar erro de geração de URL pública (se usuário estiver logado)
        try {
          const { data: { user } } = await supabase.auth.getUser();
          await logError('system', new Error('Não foi possível gerar URL pública'), {
            userId: user?.id,
            filePath: pathInfo.filePath,
            bucket: pathInfo.bucket,
            additionalInfo: {
              operation: 'generate_view_url',
            },
          });
        } catch (e) {
          // Ignorar erro de autenticação - não é necessário
        }
        
        // Tentar buscar o arquivo na raiz do bucket como fallback
        const rootFile = pathInfo.filePath.split('/').pop();
        if (rootFile && rootFile !== pathInfo.filePath) {
          const { data: altPublicUrlData } = await supabase.storage
            .from(pathInfo.bucket)
            .getPublicUrl(rootFile);
          if (altPublicUrlData?.publicUrl) {
            return altPublicUrlData.publicUrl;
          }
        }
        
        return null;
      }
    } catch (error) {
      console.error('Erro ao gerar URL para visualização:', error);
      
      // Logar erro inesperado (se usuário estiver logado)
      try {
        const { logError } = await import('../utils/errorHelpers');
        const { data: { user } } = await supabase.auth.getUser();
        await logError('system', error, {
          userId: user?.id,
          additionalInfo: {
            url,
            operation: 'generate_view_url',
          },
        });
      } catch (e) {
        // Ignorar erro de autenticação - não é necessário
      }
      
      return null;
    }
  },

  // Função para gerar signed URL para arquivos finais (arquivosfinaislush)
  generateSignedUrlForFinalFiles: async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('arquivosfinaislush')
        .createSignedUrl(filePath, 2592000); // 30 dias de validade
      
      if (error) {
        console.error('Erro ao gerar URL para arquivos finais:', error);
        return null;
      }
      
      return data.signedUrl;
    } catch (error) {
      console.error('Erro ao gerar URL do arquivo final:', error);
      return null;
    }
  },

  // Função para verificar se arquivo está acessível
  checkFileAccessibility: async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .list(filePath.split('/').slice(0, -1).join('/'));
      
      if (error) return false;
      
      const fileName = filePath.split('/').pop();
      return data?.some(file => file.name === fileName) || false;
    } catch (error) {
      console.error('Erro ao verificar acessibilidade:', error);
      return false;
    }
  },

  // Função para regenerar URL se necessário
  // DEPRECATED: Use generatePublicUrl() ou downloadFile() em vez disso
  regenerateFileUrl: async (filePath: string, useSignedUrl: boolean = true) => {
    console.warn('regenerateFileUrl está deprecated. Use generatePublicUrl() ou downloadFile() em vez disso.');
    // Manter compatibilidade temporária, mas retornar null
    return null;
  }
};

// @ts-ignore
window.supabase = supabase;