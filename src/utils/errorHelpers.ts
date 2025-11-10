import { Logger } from '../lib/loggingHelpers';
import { ActionTypes } from '../types/actionTypes';
import { supabase } from '../lib/supabase';

/**
 * Mensagens amigáveis para o usuário (sem detalhes técnicos)
 */
export const UserFriendlyMessages = {
  DOWNLOAD_ERROR: 'Não foi possível baixar o arquivo. Por favor, tente novamente.',
  VIEW_ERROR: 'Não foi possível visualizar o arquivo. Por favor, tente novamente.',
  UPLOAD_ERROR: 'Não foi possível fazer o upload do arquivo. Por favor, tente novamente.',
  AUTH_ERROR: 'Sua sessão expirou. Por favor, faça login novamente.',
  NETWORK_ERROR: 'Problema de conexão. Verifique sua internet e tente novamente.',
  FILE_NOT_FOUND: 'Arquivo não encontrado. Entre em contato com o suporte se o problema persistir.',
  GENERIC_ERROR: 'Ocorreu um erro. Por favor, tente novamente ou entre em contato com o suporte.',
  UPLOAD_LOST: 'O upload do arquivo não foi concluído. Por favor, tente fazer o upload novamente.',
} as const;

/**
 * Mostra uma mensagem amigável ao usuário (sem detalhes técnicos)
 */
export function showUserFriendlyError(
  errorType: keyof typeof UserFriendlyMessages,
  customMessage?: string
): void {
  const message = customMessage || UserFriendlyMessages[errorType];
  
  // Usar alert temporariamente, mas idealmente deveria usar um sistema de notificações
  alert(message);
}

/**
 * Loga erros no sistema de action logs para rastreamento
 */
export async function logError(
  errorType: 'auth' | 'download' | 'view' | 'upload' | 'network' | 'generic' | 'system',
  error: Error | unknown,
  context?: {
    userId?: string;
    documentId?: string;
    filePath?: string;
    filename?: string;
    bucket?: string;
    additionalInfo?: Record<string, any>;
  }
): Promise<void> {
  try {
    // Obter informações do usuário atual se disponível
    const { data: { user } } = await supabase.auth.getUser();
    const userId = context?.userId || user?.id;

    // Extrair informações do erro
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : 'UnknownError';

    // Determinar o tipo de ação baseado no tipo de erro
    let actionType: string;
    let description: string;

    switch (errorType) {
      case 'auth':
        actionType = 'authentication_error';
        description = `Erro de autenticação: ${errorMessage}`;
        break;
      case 'download':
        actionType = 'download_error';
        description = `Erro ao baixar arquivo: ${errorMessage}`;
        break;
      case 'view':
        actionType = 'view_error';
        description = `Erro ao visualizar arquivo: ${errorMessage}`;
        break;
      case 'upload':
        actionType = 'upload_error';
        description = `Erro ao fazer upload: ${errorMessage}`;
        break;
      case 'network':
        actionType = 'network_error';
        description = `Erro de rede: ${errorMessage}`;
        break;
      default:
        actionType = 'system_error';
        description = `Erro do sistema: ${errorMessage}`;
    }

    // Preparar metadata
    const metadata: Record<string, any> = {
      error_type: errorType,
      error_name: errorName,
      error_message: errorMessage,
      timestamp: new Date().toISOString(),
      ...(errorStack && { error_stack: errorStack }),
      ...(context?.filePath && { file_path: context.filePath }),
      ...(context?.filename && { filename: context.filename }),
      ...(context?.bucket && { bucket: context.bucket }),
      ...(context?.additionalInfo),
    };

    // Logar o erro
    if (context?.documentId) {
      await Logger.logDocument(
        actionType,
        context.documentId,
        description,
        metadata
      );
    } else if (userId) {
      await Logger.log(
        actionType,
        description,
        {
          entityType: 'user',
          entityId: userId,
          affectedUserId: userId,
          metadata,
        }
      );
    } else {
      await Logger.logSystem(
        actionType,
        description,
        metadata
      );
    }

    console.error(`[ErrorLogger] ${description}`, {
      error,
      context,
      metadata,
    });
  } catch (logError) {
    // Não falhar se o logging falhar
    console.error('[ErrorLogger] Erro ao logar erro:', logError);
  }
}

/**
 * Wrapper para operações que podem falhar
 * Mostra mensagem amigável ao usuário e loga o erro
 */
export async function handleErrorWithLogging<T>(
  operation: () => Promise<T>,
  errorType: 'auth' | 'download' | 'upload' | 'network' | 'generic',
  userMessage: keyof typeof UserFriendlyMessages,
  context?: {
    userId?: string;
    documentId?: string;
    filePath?: string;
    filename?: string;
    bucket?: string;
    additionalInfo?: Record<string, any>;
  }
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    // Logar o erro
    await logError(errorType, error, context);
    
    // Mostrar mensagem amigável
    showUserFriendlyError(userMessage);
    
    return null;
  }
}

