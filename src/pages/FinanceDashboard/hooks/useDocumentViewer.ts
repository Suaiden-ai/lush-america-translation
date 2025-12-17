import { useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { MappedPayment } from '../types/payments.types';
import { Document } from '../types/payments.types';

export function useDocumentViewer() {
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showModal, setShowModal] = useState(false);

  const viewDocument = useCallback(async (payment: MappedPayment) => {
    try {
      console.log('🔍 Fetching document for payment:', payment);
      console.log('🔍 Payment method:', payment.payment_method);
      console.log('🔍 Document ID:', payment.document_id);

      // Buscar dados reais do documento
      let documentData: any = null;
      let documentType: 'authenticator' | 'payment' = 'payment';

      // Primeiro tentar buscar na tabela documents para ver se existe
      console.log('💳 Tentando buscar documento na tabela documents primeiro...');
      const { data: documentCheck, error: docCheckError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', payment.document_id)
        .single();

      // Se não encontrou na tabela documents, é documento de autenticador
      if (docCheckError || !documentCheck) {
        console.log('📋 Documento não encontrado na tabela documents, buscando na documents_to_be_verified...');
        documentType = 'authenticator';
        console.log('🔍 Document type detected:', documentType);
        
        const { data: document, error } = await supabase
          .from('documents_to_be_verified')
          .select('*')
          .eq('id', payment.document_id)
          .single();

        if (error) {
          console.error('❌ Error fetching authenticator document:', error);
          // Tentar buscar por filename se falhar por ID
          console.log('🔄 Tentando buscar por filename...');
          const { data: docByFilename, error: filenameError } = await supabase
            .from('documents_to_be_verified')
            .select('*')
            .eq('filename', payment.document_filename)
            .single();
          
          if (filenameError) {
            console.error('❌ Error fetching by filename too:', filenameError);
            return;
          }
          
          documentData = docByFilename;
        } else {
          documentData = document;
        }
      } else {
        // Para pagamentos tradicionais, usar documento já encontrado
        console.log('💳 Usando documento já encontrado na tabela documents');
        console.log('🔍 Document type detected:', documentType);
        documentData = documentCheck;
      }

      if (!documentData) {
        console.error('❌ No document data found');
        return;
      }

      // Buscar informações adicionais do usuário
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', payment.user_id)
        .single();

      // Buscar URL do arquivo traduzido da tabela documents_to_be_verified
      let translatedFileUrl: string | null = null;
      
      // Buscar por user_id na tabela documents_to_be_verified
      let { data: translatedDoc, error } = await supabase
        .from('documents_to_be_verified')
        .select('*')
        .eq('user_id', payment.user_id)
        .eq('filename', payment.document_filename)
        .single();
      
      if (error) {
        const { data: docsByUserId, error: userIdError } = await supabase
          .from('documents_to_be_verified')
          .select('*')
          .eq('user_id', payment.user_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (!userIdError && docsByUserId) {
          translatedDoc = docsByUserId;
          error = null;
        }
      }
      
      if (error) {
        console.log('ℹ️ Documento não encontrado na tabela documents_to_be_verified');
      } else {
        console.log('✅ Dados encontrados na documents_to_be_verified:', translatedDoc);
        console.log('✅ Todas as colunas disponíveis:', Object.keys(translatedDoc || {}));
        console.log('✅ translated_file_url encontrado:', translatedDoc?.translated_file_url);
        console.log('✅ file_url encontrado:', translatedDoc?.file_url);
        console.log('✅ file_path encontrado:', translatedDoc?.file_path);
        
        // Tentar diferentes campos possíveis para a URL do arquivo traduzido
        translatedFileUrl = translatedDoc?.translated_file_url || 
                           translatedDoc?.file_url || 
                           translatedDoc?.file_path || 
                           null;
      }

      // Criar um objeto Document completo com todos os dados
      const completeDocument: Document = {
        id: documentData.id,
        filename: documentData.filename || payment.document_filename,
        status: documentData.status,
        file_path: documentData.file_path || documentData.file_url,
        user_id: documentData.user_id || payment.user_id,
        created_at: documentData.created_at || payment.created_at,
        // Campos adicionais para o modal
        total_cost: payment.amount,
        pages: documentData.pages,
        source_language: documentData.source_language || payment.source_language,
        target_language: documentData.target_language || payment.target_language,
        translation_type: payment.payment_method === 'upload' ? documentData.translation_type : payment.tipo_trad,
        bank_statement: documentData.bank_statement,
        authenticated: documentData.authenticated,
        verification_code: documentData.verification_code || payment.documents?.verification_code,
        // Informações do usuário
        user_name: userProfile?.name,
        user_email: userProfile?.email,
        user_phone: userProfile?.phone,
        // Tipo de documento para o modal
        document_type: documentType,
        // URL do arquivo traduzido
        translated_file_url: translatedFileUrl || undefined
      };

      console.log('📄 Complete document prepared for modal:', completeDocument);
      console.log('🔍 Campos importantes:', {
        file_path: completeDocument.file_path,
        translated_file_url: completeDocument.translated_file_url,
        filename: completeDocument.filename
      });
      setSelectedDocument(completeDocument);
      setShowModal(true);
      console.log('✅ Modal opened with complete document data');

    } catch (err) {
      console.error('💥 Error opening document:', err);
      console.error('💥 Error details:', err);
    }
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setSelectedDocument(null);
  }, []);

  return {
    selectedDocument,
    showModal,
    viewDocument,
    closeModal
  };
}
