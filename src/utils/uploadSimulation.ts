/**
 * Utilitários para simular erros de upload durante testes
 * Apenas funciona em ambiente de desenvolvimento
 */

/**
 * Verifica se deve simular erro de upload baseado em parâmetros da URL
 * Apenas funciona em desenvolvimento (import.meta.env.DEV)
 * 
 * @returns true se deve simular erro, false caso contrário
 */
export function shouldSimulateUploadError(): boolean {
  // Apenas em desenvolvimento
  if (!import.meta.env.DEV) {
    return false;
  }

  // Verificar parâmetro na URL
  const urlParams = new URLSearchParams(window.location.search);
  const simulateError = urlParams.get('simulate_upload_error');
  
  return simulateError === 'true';
}

/**
 * Verifica se deve simular erro de upload baseado em localStorage
 * Útil para testes persistentes durante desenvolvimento
 * 
 * @returns true se deve simular erro, false caso contrário
 */
export function shouldSimulateUploadErrorFromStorage(): boolean {
  // Apenas em desenvolvimento
  if (!import.meta.env.DEV) {
    return false;
  }

  const stored = localStorage.getItem('simulate_upload_error');
  return stored === 'true';
}

/**
 * Ativa simulação de erro via localStorage
 * Útil para testes que precisam persistir entre recarregamentos
 */
export function enableUploadErrorSimulation(): void {
  if (import.meta.env.DEV) {
    localStorage.setItem('simulate_upload_error', 'true');
  }
}

/**
 * Desativa simulação de erro via localStorage
 */
export function disableUploadErrorSimulation(): void {
  localStorage.removeItem('simulate_upload_error');
}

/**
 * Verifica se simulação está ativa (URL ou localStorage)
 * 
 * @returns true se simulação está ativa, false caso contrário
 */
export function isUploadErrorSimulationActive(): boolean {
  return shouldSimulateUploadError() || shouldSimulateUploadErrorFromStorage();
}

