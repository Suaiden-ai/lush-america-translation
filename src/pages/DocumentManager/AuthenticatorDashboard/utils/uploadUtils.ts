import { UploadState, UploadStates, RejectedRows } from '../types/authenticator.types';

/**
 * Cria um estado inicial de upload vazio
 */
export function createEmptyUploadState(): UploadState {
  return {
    file: null,
    uploading: false,
    success: false,
    error: null
  };
}

/**
 * Atualiza o estado de upload para um documento específico
 */
export function updateUploadState(
  states: UploadStates,
  docId: string,
  updates: Partial<UploadState>
): UploadStates {
  return {
    ...states,
    [docId]: {
      ...(states[docId] || createEmptyUploadState()),
      ...updates
    }
  };
}

/**
 * Reseta o estado de upload para um documento específico
 */
export function resetUploadState(
  states: UploadStates,
  docId: string
): UploadStates {
  return {
    ...states,
    [docId]: createEmptyUploadState()
  };
}

/**
 * Define um documento como rejeitado
 */
export function setRejectedRow(
  rejectedRows: RejectedRows,
  docId: string,
  rejected: boolean
): RejectedRows {
  return {
    ...rejectedRows,
    [docId]: rejected
  };
}

/**
 * Remove um documento dos rejeitados
 */
export function removeRejectedRow(
  rejectedRows: RejectedRows,
  docId: string
): RejectedRows {
  const newState = { ...rejectedRows };
  delete newState[docId];
  return newState;
}
