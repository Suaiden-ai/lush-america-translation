import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { notifyDocumentUpload, notifyTranslationStarted } from '../utils/webhookNotifications';

type Document = Database['public']['Tables']['documents']['Row'];
type DocumentInsert = Database['public']['Tables']['documents']['Insert'] & { file_url?: string };

export function useDocuments(userId?: string) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = async () => {
    if (!userId) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', userId)
        .neq('status', 'draft')  // não incluir documentos com status draft
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setDocuments(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError('Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [userId]);

  const createDocument = async (documentData: Partial<DocumentInsert> & { file_url?: string }) => {
    if (!userId) throw new Error('User not authenticated');
    if (!documentData.filename) throw new Error('Filename is required');
    if (!documentData.verification_code) throw new Error('Verification code is required');

    try {
      // Garantir que folder_id nunca seja null (apenas string ou undefined)
      const docToInsert = {
        ...documentData,
        folder_id: documentData.folder_id ?? undefined,
        user_id: userId, // sempre sobrescreve
        pages: documentData.pages ?? 1,
        total_cost: (documentData.pages ?? 1) * 20,
        filename: documentData.filename, // garantir obrigatório
        verification_code: documentData.verification_code // garantir obrigatório
      };
      const { data: newDocument, error } = await supabase
        .from('documents')
        .insert(docToInsert)
        .select()
        .single();
      
      if (error) throw error;
      setDocuments(prev => [newDocument, ...prev]);
      
      // Enviar notificação de upload
      notifyDocumentUpload(userId, newDocument.filename, newDocument.id);
      
      return newDocument;
    } catch (err) {
      console.error('DEBUG: [useDocuments] Erro ao criar documento:', err, JSON.stringify(err, null, 2));
      throw err;
    }
  };

  const updateDocumentStatus = async (documentId: string, status: 'pending' | 'processing' | 'completed') => {
    try {
      const { data: updatedDocument, error } = await supabase
        .from('documents')
        .update({ status })
        .eq('id', documentId)
        .select()
        .single();
      
      if (error) throw error;

      // Notificar quando o documento inicia processamento
      if (status === 'processing') {
        try {
          await notifyTranslationStarted(updatedDocument.user_id, updatedDocument.filename, updatedDocument.id);
        } catch (error) {
          console.error('Erro ao enviar notificação de tradução iniciada:', error);
          // Não interrompemos o processo mesmo se a notificação falhar
        }
      }

      setDocuments(prev => 
        prev.map(doc => 
          doc.id === documentId ? updatedDocument : doc
        )
      );
      return updatedDocument;
    } catch (err) {
      console.error('Error updating document status:', err);
      throw err;
    }
  };

  return {
    documents,
    loading,
    error,
    createDocument,
    updateDocumentStatus,
    refetch: fetchDocuments
  };
}

export function useAllDocuments() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllDocuments = async () => {
    try {
      setLoading(true);
      
      // Check if Supabase is properly configured
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        throw new Error('Supabase environment variables not configured');
      }

      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching all documents:', error);
        setError('Failed to fetch documents');
        return;
      }

      setDocuments(data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching all documents:', err);
      setError('Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllDocuments();
  }, []);

  const updateDocumentStatus = async (documentId: string, status: 'pending' | 'processing' | 'completed') => {
    try {
      const { data: updatedDocument, error } = await supabase
        .from('documents')
        .update({ status })
        .eq('id', documentId)
        .select()
        .single();
      
      if (error) throw error;

      // Notificar quando o documento inicia processamento
      if (status === 'processing') {
        try {
          await notifyTranslationStarted(updatedDocument.user_id, updatedDocument.filename, updatedDocument.id);
        } catch (error) {
          console.error('Erro ao enviar notificação de tradução iniciada:', error);
          // Não interrompemos o processo mesmo se a notificação falhar
        }
      }

      setDocuments(prev => 
        prev.map(doc => 
          doc.id === documentId ? updatedDocument : doc
        )
      );
      return updatedDocument;
    } catch (err) {
      console.error('Error updating document status:', err);
      throw err;
    }
  };

  return {
    documents,
    loading,
    error,
    updateDocumentStatus,
    refetch: fetchAllDocuments
  };
}

// Novo hook para buscar documentos do usuário com prioridade: documents -> documents_to_be_verified -> translated_documents
export function useTranslatedDocuments(userId?: string) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtime, setRealtime] = useState<any>(null);

  const fetchDocuments = async () => {
    if (!userId) {
      setDocuments([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      
      // 1. Buscar documentos da tabela documents (tabela base)
      const { data: baseDocs, error: baseError } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (baseError) throw baseError;
      
      // 2. Buscar documentos da tabela documents_to_be_verified
      const { data: verifiedDocs, error: verifiedError } = await supabase
        .from('documents_to_be_verified')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (verifiedError) throw verifiedError;
      
      // 3. Buscar documentos da tabela translated_documents
      const { data: translatedDocs, error: translatedError } = await supabase
        .from('translated_documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (translatedError) throw translatedError;
      
      // 4. Buscar status de pagamentos para ajustar status dos documentos
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('document_id, status')
        .eq('user_id', userId);
      
      if (paymentsError) {
        console.warn('[useTranslatedDocuments] Erro ao buscar pagamentos:', paymentsError);
      }
      
      // Criar mapa de status de pagamentos
      const paymentStatusMap = new Map<string, string>();
      paymentsData?.forEach(payment => {
        if (payment.document_id) {
          paymentStatusMap.set(payment.document_id, payment.status);
        }
      });
      
      console.log('[useTranslatedDocuments] DEBUG - Documentos base encontrados:', baseDocs?.length || 0);
      console.log('[useTranslatedDocuments] DEBUG - Documentos verificados encontrados:', verifiedDocs?.length || 0);
      console.log('[useTranslatedDocuments] DEBUG - Documentos traduzidos encontrados:', translatedDocs?.length || 0);
      
      // Implementar a lógica de prioridade
      const processedDocuments: any[] = [];
      
      // Função para ajustar status baseado no pagamento
      const adjustStatusBasedOnPayment = (doc: any, documentId: string) => {
        const paymentStatus = paymentStatusMap.get(documentId);
        if (paymentStatus === 'refunded' || paymentStatus === 'cancelled') {
          return paymentStatus;
        }
        return doc.status;
      };
      
      // Para cada documento da tabela base (documents)
      for (const baseDoc of baseDocs || []) {
        // Verificar se existe na tabela documents_to_be_verified pelo filename
        const verifiedDoc = verifiedDocs?.find(v => v.filename === baseDoc.filename);
        
        if (verifiedDoc) {
          // Se existe na documents_to_be_verified, buscar na translated_documents usando o ID da documents_to_be_verified
          const translatedDoc = translatedDocs?.find(t => t.original_document_id === verifiedDoc.id);
          
          if (translatedDoc) {
            // Prioridade 3: Mostrar da tabela translated_documents
            processedDocuments.push({
              ...translatedDoc,
              source: 'translated_documents',
              original_document_id: verifiedDoc.original_document_id,
              original_filename: verifiedDoc.original_filename || verifiedDoc.filename,
              status: adjustStatusBasedOnPayment(translatedDoc, baseDoc.id)
            });
          } else {
            // Prioridade 2: Mostrar da tabela documents_to_be_verified
            processedDocuments.push({
              ...verifiedDoc,
              source: 'documents_to_be_verified',
              original_document_id: verifiedDoc.original_document_id,
              status: adjustStatusBasedOnPayment(verifiedDoc, baseDoc.id)
            });
          }
        } else {
          // Prioridade 1: Mostrar da tabela documents (base)
          processedDocuments.push({
            ...baseDoc,
            source: 'documents',
            status: adjustStatusBasedOnPayment(baseDoc, baseDoc.id)
          });
        }
      }
      
      // Adicionar documentos que existem apenas na documents_to_be_verified (sem correspondência na tabela base)
      const baseFilenames = baseDocs?.map(doc => doc.filename) || [];
      const orphanVerifiedDocs = verifiedDocs?.filter(verifiedDoc => 
        !baseFilenames.includes(verifiedDoc.filename)
      ) || [];
      
      for (const orphanDoc of orphanVerifiedDocs) {
        // Buscar na translated_documents usando o ID da documents_to_be_verified
        const translatedDoc = translatedDocs?.find(t => t.original_document_id === orphanDoc.id);
        
        if (translatedDoc) {
          processedDocuments.push({
            ...translatedDoc,
            source: 'translated_documents',
            original_document_id: orphanDoc.original_document_id,
            original_filename: orphanDoc.original_filename || orphanDoc.filename,
            status: adjustStatusBasedOnPayment(translatedDoc, orphanDoc.original_document_id || orphanDoc.id)
          });
        } else {
          processedDocuments.push({
            ...orphanDoc,
            source: 'documents_to_be_verified',
            original_document_id: orphanDoc.original_document_id,
            original_filename: orphanDoc.original_filename || orphanDoc.filename,
            status: adjustStatusBasedOnPayment(orphanDoc, orphanDoc.original_document_id || orphanDoc.id)
          });
        }
      }
      
      // Ordenar por data de criação (mais recentes primeiro)
      processedDocuments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      console.log('[useTranslatedDocuments] DEBUG - Documentos processados:', processedDocuments.length);
      console.log('[useTranslatedDocuments] DEBUG - Status de pagamentos encontrados:', paymentStatusMap.size);
      
      // Debug: verificar se original_filename está sendo definido corretamente
      const docsWithOriginalFilename = processedDocuments.filter(doc => doc.original_filename);
      console.log('[useTranslatedDocuments] DEBUG - Documentos com original_filename:', docsWithOriginalFilename.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        original_filename: doc.original_filename,
        source: doc.source
      })));
      
      // Log dos documentos com status ajustado
      const documentsWithAdjustedStatus = processedDocuments.filter(doc => 
        doc.status === 'refunded' || doc.status === 'cancelled'
      );
      if (documentsWithAdjustedStatus.length > 0) {
        console.log('[useTranslatedDocuments] DEBUG - Documentos com status ajustado por pagamento:', documentsWithAdjustedStatus.map(doc => ({
          id: doc.id,
          filename: doc.filename,
          status: doc.status,
          source: doc.source
        })));
      }
      
      setDocuments(processedDocuments);
      setError(null);
    } catch (err) {
      console.error('[useTranslatedDocuments] Erro ao buscar documentos:', err);
      setError('Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  const setupRealtime = () => {
    if (!userId) return;

    const channel = supabase
      .channel('translated_documents')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('[useTranslatedDocuments] Documento atualizado na tabela documents:', payload);
          // Refetch para garantir que temos os dados mais recentes
          fetchDocuments();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'translated_documents',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('[useTranslatedDocuments] Documento atualizado na tabela translated_documents:', payload);
          // Refetch para garantir que temos os dados mais recentes
          fetchDocuments();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents_to_be_verified',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('[useTranslatedDocuments] Documento atualizado na tabela documents_to_be_verified:', payload);
          // Refetch para garantir que temos os dados mais recentes
          fetchDocuments();
        }
      )
      .subscribe();

    setRealtime(channel);
  };

  useEffect(() => {
    fetchDocuments();
    setupRealtime();

    return () => {
      if (realtime) {
        supabase.removeChannel(realtime);
      }
    };
  }, [userId]);

  return {
    documents,
    loading,
    error,
    refetch: fetchDocuments
  };
}