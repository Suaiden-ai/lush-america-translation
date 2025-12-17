import { supabase } from '../../../../lib/supabase';
import { Document } from '../types/authenticator.types';
import { Logger } from '../../../../lib/loggingHelpers';
import { ActionTypes } from '../../../../types/actionTypes';
import { notifyTranslationCompleted } from '../../../../utils/webhookNotifications';
import { User } from '@supabase/supabase-js';

interface ApprovalResult {
  success: boolean;
  error?: string;
  verificationId?: string;
}

export async function approveDocument(
  documentId: string,
  document: Document,
  currentUser: User
): Promise<ApprovalResult> {
  try {
    // Se tem verification_id, usar ele; senão, primeiro inserir na tabela de verificação
    let verificationId = document.verification_id;
    
    if (!verificationId) {
      // Documento ainda não está na tabela de verificação, vamos inserir
      const { data: newVerificationDoc, error: insertError } = await supabase
        .from('documents_to_be_verified')
        .insert({
          user_id: document.user_id,
          filename: document.filename,
          file_url: document.file_url,
          translated_file_url: document.translated_file_url || document.file_url,
          source_language: document.source_language || (document as any).idioma_raiz || 'Portuguese',
          target_language: document.target_language || (document as any).idioma_destino || 'English',
          pages: document.pages,
          total_cost: document.total_cost || (document as any).valor || 0,
          status: 'pending',
          is_bank_statement: document.is_bank_statement,
          verification_code: document.verification_code,
          translation_status: document.translation_status || 'completed'
        })
        .select()
        .single();
      
      if (insertError) {
        console.error('[documentApprovalService] Erro ao inserir documento na tabela de verificação:', insertError);
        return { success: false, error: 'Erro ao processar documento. Tente novamente.' };
      }
      
      verificationId = newVerificationDoc.id;
      
      // Log de documento pronto para autenticação
      try {
        await Logger.log(
          ActionTypes.DOCUMENT.READY_FOR_AUTHENTICATION,
          `Document ready for authentication: ${document.filename}`,
          {
            entityType: 'document',
            entityId: verificationId,
            metadata: {
              document_id: verificationId,
              original_document_id: document.id,
              filename: document.filename,
              verification_code: document.verification_code,
              user_id: document.user_id,
              pages: document.pages,
              total_cost: document.total_cost,
              source_language: document.source_language || (document as any).idioma_raiz,
              target_language: document.target_language || (document as any).idioma_destino,
              is_bank_statement: document.is_bank_statement,
              timestamp: new Date().toISOString()
            },
            affectedUserId: document.user_id,
            performerType: 'system'
          }
        );
        console.log('✅ Document ready for authentication logged successfully');
      } catch (logError) {
        console.error('Error logging document ready for authentication:', logError);
      }
    }
    
    // Buscar o documento de verificação
    const { data: doc, error: fetchError } = await supabase
      .from('documents_to_be_verified')
      .select('*')
      .eq('id', verificationId)
      .single();
      
    if (fetchError || !doc) {
      console.error('[documentApprovalService] Erro ao buscar documento:', fetchError);
      return { success: false, error: 'Erro ao buscar documento.' };
    }
    
    // Dados do autenticador
    const authData = {
      authenticated_by: currentUser.id,
      authenticated_by_name: currentUser.user_metadata?.name || currentUser.email,
      authenticated_by_email: currentUser.email,
      authentication_date: new Date().toISOString()
    };
    
    // Atualizar status para 'completed' com dados do autenticador
    const { error: updateError } = await supabase
      .from('documents_to_be_verified')
      .update({ 
        status: 'completed',
        ...authData
      })
      .eq('id', verificationId);
    
    if (updateError) {
      console.error('[documentApprovalService] Erro ao atualizar documento:', updateError);
      return { success: false, error: 'Erro ao aprovar documento. Tente novamente.' };
    }

    // Atualizar também a tabela documents original
    const { error: updateOriginalError } = await supabase
      .from('documents')
      .update({ 
        status: 'completed',
        authenticated_by: authData.authenticated_by,
        authenticated_by_name: authData.authenticated_by_name,
        authenticated_by_email: authData.authenticated_by_email,
        authentication_date: authData.authentication_date
      })
      .eq('id', document.id);
    
    if (updateOriginalError) {
      console.error('[documentApprovalService] Erro ao atualizar documento original:', updateOriginalError);
      // Não interrompemos o processo, apenas logamos o erro
    }
    
    // Inserir em translated_documents com dados do autenticador
    const { error: insertTranslatedError } = await supabase.from('translated_documents').insert({
      original_document_id: doc.id,
      user_id: doc.user_id,
      filename: doc.filename,
      translated_file_url: doc.translated_file_url || doc.file_url || '',
      source_language: doc.source_language || 'portuguese',
      target_language: doc.target_language || 'english',
      pages: doc.pages,
      status: 'completed',
      total_cost: doc.total_cost,
      is_authenticated: true,
      verification_code: doc.verification_code,
      ...authData
    } as any);
    
    if (insertTranslatedError) {
      console.error('[documentApprovalService] Erro ao inserir em translated_documents:', insertTranslatedError);
    }

    // Log da aprovação do documento pelo autenticador
    try {
      await Logger.log(
        ActionTypes.DOCUMENT.APPROVED,
        `Document approved by authenticator: ${doc.filename}`,
        {
          entityType: 'document',
          entityId: verificationId,
          metadata: {
            document_id: verificationId,
            original_document_id: document.id,
            filename: doc.filename,
            verification_code: doc.verification_code,
            user_id: doc.user_id,
            pages: doc.pages,
            total_cost: doc.total_cost,
            source_language: doc.source_language,
            target_language: doc.target_language,
            is_bank_statement: doc.is_bank_statement,
            authenticated_by: authData.authenticated_by,
            authenticated_by_name: authData.authenticated_by_name,
            authenticated_by_email: authData.authenticated_by_email,
            authentication_date: authData.authentication_date,
            timestamp: new Date().toISOString()
          },
          affectedUserId: doc.user_id,
          performerType: 'authenticator'
        }
      );
      console.log('✅ Document approval logged successfully');
    } catch (logError) {
      console.error('Error logging document approval:', logError);
    }

    // Log da mudança de status para completed
    try {
      await Logger.log(
        ActionTypes.DOCUMENT.STATUS_CHANGED,
        `Document status changed to completed: ${doc.filename}`,
        {
          entityType: 'document',
          entityId: verificationId,
          metadata: {
            document_id: verificationId,
            filename: doc.filename,
            previous_status: 'pending',
            new_status: 'completed',
            authenticated_by: authData.authenticated_by,
            authenticated_by_name: authData.authenticated_by_name,
            timestamp: new Date().toISOString()
          },
          affectedUserId: doc.user_id,
          performerType: 'authenticator'
        }
      );
      console.log('✅ Document status change logged successfully');
    } catch (logError) {
      console.error('Error logging document status change:', logError);
    }

    // Notificar que a tradução foi completada
    try {
      await notifyTranslationCompleted(doc.user_id, doc.filename, doc.id);
    } catch (error) {
      console.error('[documentApprovalService] Erro ao enviar notificação de tradução completada:', error);
      // Não interrompemos o processo mesmo se a notificação falhar
    }

    return { success: true, verificationId };
  } catch (error) {
    console.error('[documentApprovalService] Unexpected error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro inesperado ao aprovar documento.' 
    };
  }
}
