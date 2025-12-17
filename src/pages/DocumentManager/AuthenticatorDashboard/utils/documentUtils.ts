import { PreviewType } from '../types/authenticator.types';

/**
 * Detecta o tipo de preview baseado na URL e nome do arquivo
 */
export function detectPreviewType(url: string, filename?: string | null): PreviewType {
  // Priorizar filename se fornecido, senão usar URL
  // Remover query params da URL antes de verificar
  const cleanUrl = url.split('?')[0].toLowerCase();
  const name = (filename || cleanUrl).toLowerCase();
  
  // Verificar por extensão no filename primeiro (mais confiável)
  if (filename) {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'pdf') return 'pdf';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext || '')) return 'image';
  }
  
  // Fallback: verificar no nome completo (pode ter extensão no meio)
  if (name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || 
      name.endsWith('.gif') || name.endsWith('.webp') || name.endsWith('.bmp')) return 'image';
  
  // Heurística para URLs sem extensão
  if (url.includes('content-type=application%2Fpdf')) return 'pdf';
  
  return 'unknown';
}
