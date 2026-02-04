import { supabase, STORAGE_BUCKETS } from '../../../../lib/supabase';
import { Document } from '../types/authenticator.types';
import { Logger } from '../../../../lib/loggingHelpers';
import { ActionTypes } from '../../../../types/actionTypes';
import { User } from '@supabase/supabase-js';

interface CorrectionResult {
  success: boolean;
  error?: string;
  verificationId?: string;
}

/**
 * Gera um novo código de verificação único
 */
function generateVerificationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 9; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function uploadCorrection(
  document: Document,
  file: File,
  currentUser: User
): Promise<CorrectionResult> {
  try {
    // Upload para Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKETS.DOCUMENTS)
      .upload(`${currentUser.id}/${document.id}_${Date.now()}_${file.name}`, file, { upsert: true });

    if (uploadError) {
      throw uploadError;
    }

    const filePath = uploadData?.path;
    const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKETS.DOCUMENTS).getPublicUrl(filePath);
    const publicUrl = publicUrlData.publicUrl;

    // Se tem verification_id, usar ele; senão, usar o id principal do documento
    const verificationId = document.verification_id || document.id;

    // Buscar verification_code do documento original
    let originalDoc: any;
    let fetchError: any;
    let finalVerificationId = verificationId;

    if (document.verification_id) {
      // Documento já está na tabela documents_to_be_verified
      const { data, error } = await supabase
        .from('documents_to_be_verified')
        .select('verification_code')
        .eq('id', verificationId)
        .single();
      originalDoc = data;
      fetchError = error;
    } else {
      // Documento existe apenas na tabela documents - precisa criar entrada em documents_to_be_verified
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', document.id)
        .single();

      if (docError || !docData) {
        throw new Error('Não foi possível obter dados do documento original.');
      }

      // Criar entrada na tabela documents_to_be_verified
      const { data: newVerifiedDoc, error: createError } = await supabase
        .from('documents_to_be_verified')
        .insert({
          user_id: docData.user_id,
          filename: docData.filename,
          pages: docData.pages,
          total_cost: docData.total_cost || docData.valor || 0,
          status: 'pending',
          verification_code: docData.verification_code,
          source_language: docData.idioma_raiz,
          target_language: docData.idioma_destino,
          is_bank_statement: docData.is_bank_statement || false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id, verification_code')
        .single();

      if (createError || !newVerifiedDoc) {
        throw new Error('Não foi possível criar entrada na tabela de verificação.');
      }

      finalVerificationId = newVerifiedDoc.id;
      originalDoc = newVerifiedDoc;
      fetchError = null;
    }

    if (fetchError || !originalDoc) {
      throw new Error('Não foi possível obter o verification_code do documento original.');
    }

    // Dados do autenticador
    const authData = {
      authenticated_by: currentUser?.id,
      authenticated_by_name: currentUser?.user_metadata?.name || currentUser?.email,
      authenticated_by_email: currentUser?.email,
      authentication_date: new Date().toISOString()
    };

    // Gerar novo código de verificação único para a correção
    const newVerificationCode = generateVerificationCode();

    // Debug: verificar os valores dos idiomas antes da inserção
    console.log('DEBUG: Idiomas antes da inserção em translated_documents:');
    console.log('doc.source_language:', document.source_language);
    console.log('doc.target_language:', document.target_language);
    console.log('Valores finais que serão inseridos:');
    console.log('source_language:', document.source_language || 'Portuguese');
    console.log('target_language:', document.target_language || 'English');
    console.log('Novo verification_code:', newVerificationCode);

    // Inserir na tabela translated_documents com dados do autenticador
    const { error: insertError } = await supabase.from('translated_documents').insert({
      original_document_id: finalVerificationId,
      user_id: document.user_id,
      filename: file.name,
      translated_file_url: publicUrl,
      source_language: document.source_language || 'Portuguese',
      target_language: document.target_language || 'English',
      pages: document.pages,
      status: 'completed',
      total_cost: document.total_cost,
      is_authenticated: true,
      verification_code: newVerificationCode,
      ...authData
    } as any);

    if (insertError) {
      throw insertError;
    }

    // Log da rejeição do documento pelo autenticador
    try {
      await Logger.log(
        ActionTypes.DOCUMENT.REJECTED,
        `Document rejected by authenticator: ${document.filename}`,
        {
          entityType: 'document',
          entityId: finalVerificationId,
          metadata: {
            document_id: finalVerificationId,
            original_document_id: document.id,
            filename: document.filename,
            original_verification_code: originalDoc.verification_code,
            new_verification_code: newVerificationCode,
            user_id: document.user_id,
            pages: document.pages,
            total_cost: document.total_cost,
            source_language: document.source_language,
            target_language: document.target_language,
            is_bank_statement: document.is_bank_statement,
            correction_file_url: publicUrl,
            correction_filename: file.name,
            authenticated_by: authData.authenticated_by,
            authenticated_by_name: authData.authenticated_by_name,
            authenticated_by_email: authData.authenticated_by_email,
            authentication_date: authData.authentication_date,
            reason: 'Document correction after rejection',
            timestamp: new Date().toISOString()
          },
          affectedUserId: document.user_id,
          performerType: 'authenticator'
        }
      );
      console.log('✅ Document rejection logged successfully');
    } catch (logError) {
      console.error('Error logging document rejection:', logError);
    }

    // Log da mudança de status para completed após correção
    try {
      await Logger.log(
        ActionTypes.DOCUMENT.STATUS_CHANGED,
        `Document status changed to completed after correction: ${document.filename}`,
        {
          entityType: 'document',
          entityId: finalVerificationId,
          metadata: {
            document_id: finalVerificationId,
            filename: document.filename,
            previous_status: 'pending',
            new_status: 'completed',
            correction_file_url: publicUrl,
            correction_filename: file.name,
            authenticated_by: authData.authenticated_by,
            authenticated_by_name: authData.authenticated_by_name,
            timestamp: new Date().toISOString()
          },
          affectedUserId: document.user_id,
          performerType: 'authenticator'
        }
      );
      console.log('✅ Document status change after correction logged successfully');
    } catch (logError) {
      console.error('Error logging document status change after correction:', logError);
    }

    // Atualizar status do documento original para 'completed' com dados do autenticador
    if (document.verification_id) {
      // Documento estava na tabela documents_to_be_verified
      await supabase
        .from('documents_to_be_verified')
        .update({
          status: 'completed',
          ...authData
        })
        .eq('id', document.verification_id);
    } else {
      // Documento foi criado em documents_to_be_verified, atualizar ambas as tabelas
      await supabase
        .from('documents_to_be_verified')
        .update({
          status: 'completed',
          ...authData
        })
        .eq('id', finalVerificationId);

      await supabase
        .from('documents')
        .update({
          status: 'completed',
          ...authData
        })
        .eq('id', document.id);
    }

    // Log de upload manual pelo autenticador
    try {
      await Logger.log(
        ActionTypes.DOCUMENT.MANUAL_UPLOAD_BY_AUTHENTICATOR,
        `Authenticator uploaded corrected document: ${file.name}`,
        {
          entityType: 'document',
          entityId: finalVerificationId,
          metadata: {
            original_document_id: document.id,
            new_document_id: finalVerificationId,
            filename: file.name,
            file_size: file.size,
            file_type: file.type,
            verification_code: document.verification_code,
            user_id: document.user_id,
            authenticator_id: currentUser?.id,
            authenticator_name: currentUser?.user_metadata?.name || currentUser?.email,
            reason: 'Document correction after rejection',
            timestamp: new Date().toISOString()
          },
          affectedUserId: document.user_id,
          performerType: 'authenticator'
        }
      );
      console.log('✅ Manual upload by authenticator logged successfully');
    } catch (logError) {
      console.error('Error logging manual upload by authenticator:', logError);
    }

    return { success: true, verificationId: finalVerificationId };
  } catch (error) {
    console.error('[documentCorrectionService] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao fazer upload da correção.'
    };
  }
}
