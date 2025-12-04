import { supabase } from '../lib/supabase';
import { generateUniqueFileName } from './fileUtils';
import { Logger } from '../lib/loggingHelpers';
import { ActionTypes } from '../types/actionTypes';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_RETRY_ATTEMPTS = 3;

export interface RetryUploadResult {
  success: boolean;
  fileUrl?: string;
  error?: string;
  documentId?: string;
}

/**
 * Conta o número de páginas de um PDF
 */
async function countPdfPages(file: File): Promise<number> {
  try {
    // Carregar pdfjs-dist dinamicamente
    const pdfjsLib = await import('pdfjs-dist/build/pdf');
    // @ts-ignore
    const pdfjsWorkerSrc = (await import('pdfjs-dist/build/pdf.worker?url')).default;
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    return pdf.numPages;
  } catch (err) {
    console.error('[retryUpload] Erro ao contar páginas do PDF:', err);
    throw new Error('Não foi possível ler o arquivo PDF. Por favor, verifique se o arquivo está corrompido.');
  }
}

/**
 * Valida se o arquivo pode ser enviado
 */
function validateFile(file: File): { valid: boolean; error?: string } {
  // Validar tipo de arquivo (apenas PDF)
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return {
      valid: false,
      error: 'Apenas arquivos PDF são permitidos'
    };
  }

  // Validar tamanho
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Arquivo muito grande. Tamanho máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB`
    };
  }

  // Validar se arquivo não está vazio
  if (file.size === 0) {
    return {
      valid: false,
      error: 'Arquivo está vazio'
    };
  }

  return { valid: true };
}

/**
 * Valida se o número de páginas do arquivo corresponde ao número de páginas pago
 */
async function validatePageCount(
  file: File,
  expectedPages: number
): Promise<{ valid: boolean; error?: string; actualPages?: number }> {
  try {
    const actualPages = await countPdfPages(file);
    
    if (actualPages !== expectedPages) {
      return {
        valid: false,
        actualPages,
        error: `O arquivo tem ${actualPages} ${actualPages === 1 ? 'página' : 'páginas'}, mas você pagou por ${expectedPages} ${expectedPages === 1 ? 'página' : 'páginas'}. Por favor, envie um arquivo com exatamente ${expectedPages} ${expectedPages === 1 ? 'página' : 'páginas'}.`
      };
    }

    return { valid: true, actualPages };
  } catch (err: any) {
    return {
      valid: false,
      error: err.message || 'Erro ao validar número de páginas'
    };
  }
}

/**
 * Verifica se o documento tem pagamento confirmado
 */
async function verifyPayment(documentId: string): Promise<{ hasPayment: boolean; error?: string }> {
  try {
    const { data: payment, error } = await supabase
      .from('payments')
      .select('id, status, amount')
      .eq('document_id', documentId)
      .eq('status', 'completed')
      .single();

    if (error) {
      console.error('Error verifying payment:', error);
      return {
        hasPayment: false,
        error: 'Erro ao verificar pagamento'
      };
    }

    if (!payment) {
      return {
        hasPayment: false,
        error: 'Pagamento não encontrado ou não confirmado'
      };
    }

    return { hasPayment: true };
  } catch (err: any) {
    console.error('Exception verifying payment:', err);
    return {
      hasPayment: false,
      error: 'Erro ao verificar pagamento'
    };
  }
}

/**
 * Faz upload do arquivo para o Storage com retry automático
 */
async function uploadFileWithRetry(
  file: File,
  filePath: string,
  retries: number = MAX_RETRY_ATTEMPTS
): Promise<{ success: boolean; data?: any; error?: string }> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[retryUpload] Tentativa ${attempt}/${retries} de upload para: ${filePath}`);

      const { data, error } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '31536000',
          upsert: true
        });

      if (error) {
        lastError = error;
        console.error(`[retryUpload] Erro na tentativa ${attempt}:`, error);

        // Se não for erro de rede, não tentar novamente
        if (!error.message.includes('network') && !error.message.includes('timeout')) {
          return { success: false, error: error.message };
        }

        // Aguardar antes de tentar novamente (exponential backoff)
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
        continue;
      }

      console.log(`[retryUpload] Upload bem-sucedido na tentativa ${attempt}`);
      return { success: true, data };
    } catch (err: any) {
      lastError = err;
      console.error(`[retryUpload] Exceção na tentativa ${attempt}:`, err);

      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Falha no upload após múltiplas tentativas'
  };
}

/**
 * Função principal para reenviar documento após falha de upload
 */
export async function retryDocumentUpload(
  documentId: string,
  file: File
): Promise<RetryUploadResult> {
  try {
    console.log('[retryUpload] Iniciando reenvio de documento:', documentId);

    // 1. Validar arquivo
    const fileValidation = validateFile(file);
    if (!fileValidation.valid) {
      return {
        success: false,
        error: fileValidation.error
      };
    }

    // 2. Verificar pagamento
    const paymentCheck = await verifyPayment(documentId);
    if (!paymentCheck.hasPayment) {
      return {
        success: false,
        error: paymentCheck.error || 'Pagamento não confirmado'
      };
    }

    // 3. Buscar informações do documento (incluindo número de páginas pago)
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, user_id, filename, original_filename, pages')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return {
        success: false,
        error: 'Documento não encontrado'
      };
    }

    // 3.1. Validar número de páginas do arquivo
    const expectedPages = document.pages || 1;
    const pageValidation = await validatePageCount(file, expectedPages);
    
    if (!pageValidation.valid) {
      return {
        success: false,
        error: pageValidation.error || 'Número de páginas não corresponde ao pagamento'
      };
    }

    console.log(`[retryUpload] Validação de páginas OK: ${pageValidation.actualPages} páginas (esperado: ${expectedPages})`);

    // 4. Gerar nome único para arquivo
    const uniqueFileName = generateUniqueFileName(file.name);
    const filePath = `${document.user_id}/${uniqueFileName}`;

    // 5. Verificar se arquivo já existe no Storage (evitar duplicatas)
    try {
      const { data: existingFiles } = await supabase.storage
        .from('documents')
        .list(document.user_id, {
          search: uniqueFileName
        });

      if (existingFiles && existingFiles.length > 0) {
        console.log('[retryUpload] Arquivo já existe no Storage, usando URL existente');
        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath);

        // Atualizar documento mesmo que arquivo já exista
        await updateDocumentAfterUpload(documentId, publicUrl, document.user_id);
        return {
          success: true,
          fileUrl: publicUrl,
          documentId
        };
      }
    } catch (checkError) {
      console.log('[retryUpload] Erro ao verificar arquivo existente, continuando:', checkError);
    }

    // 6. Fazer upload do arquivo
    const uploadResult = await uploadFileWithRetry(file, filePath);
    if (!uploadResult.success) {
      return {
        success: false,
        error: uploadResult.error || 'Falha no upload do arquivo'
      };
    }

    // 7. Obter URL pública do arquivo
    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    // 8. Atualizar documento
    await updateDocumentAfterUpload(documentId, publicUrl, document.user_id);

    // 9. Log de sucesso
    await Logger.log(
      ActionTypes.DOCUMENT.UPLOADED,
      `Document re-uploaded successfully after initial failure: ${file.name}`,
      {
        entityType: 'document',
        entityId: documentId,
        metadata: {
          filename: file.name,
          file_size: file.size,
          file_type: file.type,
          public_url: publicUrl,
          is_retry: true,
          timestamp: new Date().toISOString()
        },
        affectedUserId: document.user_id
      }
    );

    return {
      success: true,
      fileUrl: publicUrl,
      documentId
    };
  } catch (err: any) {
    console.error('[retryUpload] Erro no reenvio:', err);

    // Log de erro
    await Logger.logError('retry_upload', err, {
      documentId,
      filename: file.name,
      additionalInfo: {
        file_size: file.size,
        file_type: file.type
      }
    });

    return {
      success: false,
      error: err.message || 'Erro inesperado ao reenviar documento'
    };
  }
}

/**
 * Atualiza documento após upload bem-sucedido
 */
async function updateDocumentAfterUpload(
  documentId: string,
  fileUrl: string,
  userId: string
): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const { data: { session } } = await supabase.auth.getSession();

  // Buscar informações do documento antes de atualizar
  const { data: document } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (!document) {
    throw new Error('Document not found');
  }

  // Usar Edge Function para atualizar com service role
  const response = await fetch(`${supabaseUrl}/functions/v1/update-document`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || ''}`
    },
    body: JSON.stringify({
      documentId,
      fileUrl,
      userId,
      clearUploadFailed: true, // Limpar upload_failed_at
      pages: document.pages,
      totalCost: document.total_cost,
      documentType: document.tipo_trad,
      isBankStatement: document.is_bank_statement,
      sourceLanguage: document.idioma_raiz,
      targetLanguage: document.idioma_destino,
      sourceCurrency: document.source_currency,
      targetCurrency: document.target_currency
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update document: ${errorText}`);
  }

  // Chamar webhook para enviar ao n8n
  try {
    const { data: document } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (document) {
      const webhookPayload = {
        filename: document.filename,
        url: fileUrl,
        mimetype: 'application/pdf',
        size: 0, // Tamanho será obtido do Storage
        user_id: userId,
        pages: document.pages || 0,
        document_type: document.tipo_trad || 'Certified',
        total_cost: document.total_cost?.toString() || '0',
        source_language: document.idioma_raiz || 'Portuguese',
        target_language: document.idioma_destino || 'English',
        is_bank_statement: document.is_bank_statement || false,
        source_currency: document.source_currency || null,
        target_currency: document.target_currency || null,
        document_id: documentId,
        original_document_id: documentId,
        original_filename: document.original_filename || document.filename,
        isPdf: true,
        fileExtension: 'pdf',
        tableName: 'profiles',
        schema: 'public'
      };

      const webhookResponse = await fetch(`${supabaseUrl}/functions/v1/send-translation-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify(webhookPayload)
      });

      if (!webhookResponse.ok) {
        console.warn('[retryUpload] Webhook falhou, mas documento foi atualizado:', await webhookResponse.text());
      }
    }
  } catch (webhookError) {
    console.warn('[retryUpload] Erro ao chamar webhook, mas documento foi atualizado:', webhookError);
  }
}

