import { useState, useCallback } from 'react';
import { Document, UploadStates, RejectedRows } from '../types/authenticator.types';
import { approveDocument } from '../services/documentApprovalService';
import { uploadCorrection } from '../services/documentCorrectionService';
import { updateUploadState, resetUploadState, setRejectedRow, removeRejectedRow } from '../utils/uploadUtils';
import { User } from '@supabase/supabase-js';

interface UseDocumentActionsParams {
  currentUser: User | null;
  onDocumentRemoved: (documentId: string) => void;
  onStatsUpdate?: () => void;
}

export function useDocumentActions({
  currentUser,
  onDocumentRemoved,
  onStatsUpdate
}: UseDocumentActionsParams) {
  const [uploadStates, setUploadStates] = useState<UploadStates>({});
  const [rejectedRows, setRejectedRows] = useState<RejectedRows>({});

  const handleApprove = useCallback(async (documentId: string, document: Document) => {
    if (!currentUser) {
      alert('Usuário não autenticado.');
      return;
    }

    const result = await approveDocument(documentId, document, currentUser);
    
    if (result.success) {
      onDocumentRemoved(documentId);
      if (onStatsUpdate) {
        onStatsUpdate();
      }
    } else {
      alert(result.error || 'Erro ao aprovar documento.');
    }
  }, [currentUser, onDocumentRemoved, onStatsUpdate]);

  const handleReject = useCallback((documentId: string) => {
    setRejectedRows(prev => setRejectedRow(prev, documentId, true));
  }, []);

  const handleCorrectionUpload = useCallback(async (document: Document, file: File) => {
    if (!currentUser) {
      alert('Usuário não autenticado.');
      return;
    }

    const state = uploadStates[document.id];
    if (!state) {
      setUploadStates(prev => updateUploadState(prev, document.id, {
        file,
        uploading: true,
        success: false,
        error: null
      }));
    } else {
      setUploadStates(prev => updateUploadState(prev, document.id, {
        ...state,
        uploading: true,
        error: null,
        success: false
      }));
    }

    try {
      const result = await uploadCorrection(document, file, currentUser);
      
      if (result.success) {
        setUploadStates(prev => updateUploadState(prev, document.id, {
          file: null,
          uploading: false,
          success: true,
          error: null
        }));
        
        // Aguardar um pouco antes de remover para mostrar feedback visual
        setTimeout(() => {
          onDocumentRemoved(document.id);
          setUploadStates(prev => resetUploadState(prev, document.id));
          setRejectedRows(prev => removeRejectedRow(prev, document.id));
          if (onStatsUpdate) {
            onStatsUpdate();
          }
        }, 1000);
      } else {
        setUploadStates(prev => {
          const currentState = prev[document.id] || { file: null, uploading: false, success: false, error: null };
          return updateUploadState(prev, document.id, {
            ...currentState,
            uploading: false,
            success: false,
            error: result.error || 'Erro ao fazer upload da correção.'
          });
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao fazer upload da correção.';
      setUploadStates(prev => {
        const currentState = prev[document.id] || { file: null, uploading: false, success: false, error: null };
        return updateUploadState(prev, document.id, {
          ...currentState,
          uploading: false,
          success: false,
          error: errorMessage
        });
      });
    }
  }, [currentUser, uploadStates, onDocumentRemoved, onStatsUpdate]);

  const handleFileSelect = useCallback((documentId: string, file: File | null) => {
    setUploadStates(prev => updateUploadState(prev, documentId, {
      file,
      uploading: false,
      success: false,
      error: null
    }));
  }, []);

  const handleCancelReject = useCallback((documentId: string) => {
    setRejectedRows(prev => removeRejectedRow(prev, documentId));
    setUploadStates(prev => resetUploadState(prev, documentId));
  }, []);

  return {
    approveDocument: handleApprove,
    rejectDocument: handleReject,
    uploadCorrection: handleCorrectionUpload,
    uploadStates,
    rejectedRows,
    setRejectedRow: (docId: string, rejected: boolean) => {
      setRejectedRows(prev => setRejectedRow(prev, docId, rejected));
    },
    setUploadState: (docId: string, file: File | null) => {
      handleFileSelect(docId, file);
    },
    cancelReject: handleCancelReject
  };
}
