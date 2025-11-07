import { supabase } from '../lib/supabase';
import { ActionTypes } from '../types/actionTypes';

/**
 * Busca erros e problemas de um usuário específico
 */
export async function getUserErrors(userId: string, hoursBack: number = 24) {
  try {
    const since = new Date();
    since.setHours(since.getHours() - hoursBack);

    // Buscar todos os erros desse usuário
    const { data: errors, error: errorsError } = await supabase
      .from('action_logs')
      .select('*')
      .or(`affected_user_id.eq.${userId},performed_by.eq.${userId}`)
      .in('action_type', [
        ActionTypes.ERROR.AUTHENTICATION_ERROR,
        ActionTypes.ERROR.DOWNLOAD_ERROR,
        ActionTypes.ERROR.UPLOAD_ERROR,
        ActionTypes.ERROR.NETWORK_ERROR,
        ActionTypes.ERROR.SYSTEM_ERROR,
        ActionTypes.ERROR.FILE_NOT_FOUND,
      ])
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    if (errorsError) {
      console.error('[getUserErrors] Erro ao buscar erros:', errorsError);
      return { errors: [], error: errorsError };
    }

    return { errors: errors || [], error: null };
  } catch (error) {
    console.error('[getUserErrors] Erro inesperado:', error);
    return { errors: [], error };
  }
}

/**
 * Busca tentativas de download/view de um usuário específico
 */
export async function getUserDownloadAttempts(userId: string, hoursBack: number = 24) {
  try {
    const since = new Date();
    since.setHours(since.getHours() - hoursBack);

    // Buscar tentativas de download e visualização
    const { data: attempts, error: attemptsError } = await supabase
      .from('action_logs')
      .select('*')
      .or(`affected_user_id.eq.${userId},performed_by.eq.${userId}`)
      .in('action_type', [
        ActionTypes.DOCUMENT.DOWNLOADED,
        ActionTypes.DOCUMENT.VIEWED,
        ActionTypes.DOCUMENT.DOWNLOAD,
        ActionTypes.DOCUMENT.VIEW,
      ])
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(200);

    if (attemptsError) {
      console.error('[getUserDownloadAttempts] Erro ao buscar tentativas:', attemptsError);
      return { attempts: [], error: attemptsError };
    }

    return { attempts: attempts || [], error: null };
  } catch (error) {
    console.error('[getUserDownloadAttempts] Erro inesperado:', error);
    return { attempts: [], error };
  }
}

/**
 * Diagnóstico completo de um usuário
 */
export async function diagnoseUser(userId: string, hoursBack: number = 24) {
  try {
    console.log(`[diagnoseUser] Iniciando diagnóstico para usuário: ${userId}`);
    
    const [errorsResult, attemptsResult] = await Promise.all([
      getUserErrors(userId, hoursBack),
      getUserDownloadAttempts(userId, hoursBack),
    ]);

    const errors = errorsResult.errors;
    const attempts = attemptsResult.attempts;

    // Agrupar erros por tipo
    const errorsByType: Record<string, number> = {};
    errors.forEach(error => {
      const type = error.action_type || 'unknown';
      errorsByType[type] = (errorsByType[type] || 0) + 1;
    });

    // Contar tentativas por documento
    const attemptsByDocument: Record<string, number> = {};
    attempts.forEach(attempt => {
      const docId = attempt.entity_id || 'unknown';
      attemptsByDocument[docId] = (attemptsByDocument[docId] || 0) + 1;
    });

    // Encontrar documentos com mais tentativas
    const topDocuments = Object.entries(attemptsByDocument)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([docId, count]) => ({ documentId: docId, attempts: count }));

    // Analisar padrões
    const patterns = {
      hasAuthErrors: errors.some(e => e.action_type === ActionTypes.ERROR.AUTHENTICATION_ERROR),
      hasDownloadErrors: errors.some(e => e.action_type === ActionTypes.ERROR.DOWNLOAD_ERROR),
      hasUploadErrors: errors.some(e => e.action_type === ActionTypes.ERROR.UPLOAD_ERROR),
      hasNetworkErrors: errors.some(e => e.action_type === ActionTypes.ERROR.NETWORK_ERROR),
      totalErrors: errors.length,
      totalAttempts: attempts.length,
      errorRate: attempts.length > 0 ? (errors.length / attempts.length) * 100 : 0,
      mostProblematicDocument: topDocuments[0] || null,
    };

    const diagnosis = {
      userId,
      period: `${hoursBack} horas`,
      summary: {
        totalErrors: errors.length,
        totalAttempts: attempts.length,
        errorRate: `${patterns.errorRate.toFixed(2)}%`,
        errorsByType,
        topDocuments,
        patterns,
      },
      errors: errors.slice(0, 20), // Últimos 20 erros
      recentAttempts: attempts.slice(0, 20), // Últimas 20 tentativas
    };

    console.log('[diagnoseUser] Diagnóstico completo:', diagnosis);
    return diagnosis;
  } catch (error) {
    console.error('[diagnoseUser] Erro ao fazer diagnóstico:', error);
    throw error;
  }
}

/**
 * Função para executar diagnóstico e retornar resultado formatado
 */
export async function runUserDiagnostics(userId: string) {
  try {
    const diagnosis = await diagnoseUser(userId, 24);
    
    console.log('\n=== DIAGNÓSTICO DO USUÁRIO ===');
    console.log(`User ID: ${userId}`);
    console.log(`Período: ${diagnosis.period}`);
    console.log(`\n📊 RESUMO:`);
    console.log(`- Total de erros: ${diagnosis.summary.totalErrors}`);
    console.log(`- Total de tentativas: ${diagnosis.summary.totalAttempts}`);
    console.log(`- Taxa de erro: ${diagnosis.summary.errorRate}`);
    
    if (Object.keys(diagnosis.summary.errorsByType).length > 0) {
      console.log(`\n❌ ERROS POR TIPO:`);
      Object.entries(diagnosis.summary.errorsByType).forEach(([type, count]) => {
        console.log(`  - ${type}: ${count}`);
      });
    }
    
    if (diagnosis.summary.topDocuments.length > 0) {
      console.log(`\n📄 DOCUMENTOS COM MAIS TENTATIVAS:`);
      diagnosis.summary.topDocuments.forEach((doc, index) => {
        console.log(`  ${index + 1}. Document ID: ${doc.documentId} - ${doc.attempts} tentativas`);
      });
    }
    
    if (diagnosis.errors.length > 0) {
      console.log(`\n🔍 ÚLTIMOS ERROS:`);
      diagnosis.errors.forEach((error, index) => {
        console.log(`\n${index + 1}. ${error.action_type}`);
        console.log(`   Descrição: ${error.action_description}`);
        console.log(`   Data: ${new Date(error.created_at).toLocaleString('pt-BR')}`);
        if (error.metadata) {
          console.log(`   Metadata:`, JSON.stringify(error.metadata, null, 2));
        }
      });
    }
    
    return diagnosis;
  } catch (error) {
    console.error('[runUserDiagnostics] Erro:', error);
    throw error;
  }
}

