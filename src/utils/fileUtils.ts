/**
 * Sanitiza o nome do arquivo removendo caracteres especiais e espaços
 * que podem causar problemas no upload para o Supabase Storage
 */
export function sanitizeFileName(fileName: string): string {
  // Remove extensão do arquivo
  const lastDotIndex = fileName.lastIndexOf('.');
  const nameWithoutExt = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
  const extension = lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '';
  
  // Sanitiza o nome do arquivo
  const sanitizedName = nameWithoutExt
    .replace(/[^a-zA-Z0-9_-]/g, '_') // Substitui caracteres especiais por underscore
    .replace(/_+/g, '_') // Remove underscores múltiplos
    .replace(/^_|_$/g, '') // Remove underscores no início e fim
    .toLowerCase(); // Converte para minúsculas
  
  // Se o nome ficou vazio, usa um nome padrão
  const finalName = sanitizedName || 'document';
  
  return finalName + extension;
}

/**
 * Gera um nome único para o arquivo baseado no nome original + código aleatório
 * 
 * Novo formato: NomeOriginal_CODE.pdf
 * Exemplo: diploma_universidade_A1B2C3.pdf
 * 
 * Estrutura:
 * - NomeOriginal: Nome original do arquivo sanitizado
 * - CODE: Código aleatório (6 caracteres alfanuméricos)
 */
export function generateUniqueFileName(originalFileName: string): string {
  // Separar nome e extensão
  const lastDotIndex = originalFileName.lastIndexOf('.');
  const nameWithoutExt = lastDotIndex !== -1 ? originalFileName.substring(0, lastDotIndex) : originalFileName;
  const extension = lastDotIndex !== -1 ? originalFileName.substring(lastDotIndex) : '';
  
  // Sanitizar o nome (sem extensão)
  const sanitizedName = nameWithoutExt
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
  
  // Gerar código aleatório (6 caracteres alfanuméricos)
  const randomCode = Math.random().toString(36).substr(2, 6).toUpperCase();
  
  // Estrutura: NomeOriginal_CODE.extensão
  return `${sanitizedName}_${randomCode}${extension}`;
}

/**
 * Extrai filePath de uma URL do Supabase Storage
 * Retorna { filePath, bucket } ou null se não conseguir extrair
 */
export function extractFilePathFromUrl(url: string): { filePath: string; bucket: string } | null {
  try {
    // Detectar e corrigir URL duplicada
    let cleanUrl = url;
    if (url.includes('https://') && (url.match(/https:\/\//g) || []).length > 1) {
      const firstUrlMatch = url.match(/https:\/\/[^h]+/);
      if (firstUrlMatch) {
        cleanUrl = firstUrlMatch[0];
      }
    }
    
    const urlObj = new URL(cleanUrl);
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    
    // Detectar bucket
    let bucket = 'documents';
    if (pathParts.includes('arquivosfinaislush')) {
      bucket = 'arquivosfinaislush';
    } else if (pathParts.includes('payment-receipts')) {
      bucket = 'payment-receipts';
    }
    
    // Extrair filePath
    // Para signed URLs, o formato é: /storage/v1/object/sign/{bucket}/{filePath}?token=...
    // Para public URLs, o formato é: /storage/v1/object/public/{bucket}/{filePath}
    // Para direct URLs, pode ser: /storage/v1/object/{bucket}/{filePath}
    
    let filePath = '';
    const signIndex = pathParts.findIndex(p => p === 'sign');
    const publicIndex = pathParts.findIndex(p => p === 'public');
    const objectIndex = pathParts.findIndex(p => p === 'object');
    const bucketIndex = pathParts.findIndex(p => p === bucket);
    
    if (signIndex >= 0) {
      // Signed URL: /storage/v1/object/sign/{bucket}/{filePath}
      // Pular 'sign', 'bucket' e pegar o resto
      const afterSign = signIndex + 1;
      if (pathParts[afterSign] === bucket) {
        filePath = pathParts.slice(afterSign + 1).join('/');
      } else {
        // Se bucket não está logo após 'sign', procurar
        const bucketIdx = pathParts.findIndex((p, idx) => idx > signIndex && p === bucket);
        if (bucketIdx >= 0) {
          filePath = pathParts.slice(bucketIdx + 1).join('/');
        }
      }
    } else if (publicIndex >= 0) {
      // Public URL: /storage/v1/object/public/{bucket}/{filePath}
      // Pular 'public', 'bucket' e pegar o resto
      const afterPublic = publicIndex + 1;
      if (pathParts[afterPublic] === bucket) {
        filePath = pathParts.slice(afterPublic + 1).join('/');
      } else {
        // Se bucket não está logo após 'public', procurar
        const bucketIdx = pathParts.findIndex((p, idx) => idx > publicIndex && p === bucket);
        if (bucketIdx >= 0) {
          filePath = pathParts.slice(bucketIdx + 1).join('/');
        }
      }
    } else if (objectIndex >= 0 && bucketIndex >= 0 && bucketIndex > objectIndex) {
      // Direct URL: /storage/v1/object/{bucket}/{filePath}
      // Pular tudo até o bucket e pegar o resto
      filePath = pathParts.slice(bucketIndex + 1).join('/');
    } else if (bucketIndex >= 0) {
      // Fallback: se encontrou bucket em qualquer lugar, pegar tudo depois
      filePath = pathParts.slice(bucketIndex + 1).join('/');
      // Remover duplicatas de bucket no caminho (ex: documents/documents/...)
      if (filePath.startsWith(`${bucket}/`)) {
        filePath = filePath.substring(bucket.length + 1);
      }
    } else {
      // Último fallback: pegar últimos segmentos (assumindo formato userId/filename)
      filePath = pathParts.slice(-2).join('/');
    }
    
    // Se filePath contém query params (token), remover
    if (filePath.includes('?')) {
      filePath = filePath.split('?')[0];
    }
    
    // Remover duplicatas de bucket no início do caminho
    if (filePath.startsWith(`${bucket}/`)) {
      filePath = filePath.substring(bucket.length + 1);
    }
    
    // Decodificar filePath para tratar caracteres especiais codificados (como %20, %28, %29, etc.)
    try {
      const decoded = decodeURIComponent(filePath);
      // Só usar o decodificado se for diferente e válido
      if (decoded && decoded !== filePath) {
        filePath = decoded;
      }
    } catch (e) {
      // Se a decodificação falhar, usar o filePath original
      console.warn('Erro ao decodificar filePath, usando original:', e);
    }
    
    return { filePath, bucket };
  } catch (error) {
    console.error('Erro ao extrair filePath da URL:', error);
    return null;
  }
}

/**
 * Converte uma URL do Supabase Storage para usar a Edge Function serve-document
 * Isso permite mostrar uma página customizada de erro quando o arquivo não existe
 * 
 * @param url - URL original do Supabase Storage
 * @returns URL da Edge Function que serve o arquivo com página de erro customizada
 */
export function convertToServeDocumentUrl(url: string): string {
  try {
    // Se não é URL do Supabase, retornar como está
    if (!url.includes('supabase.co')) {
      return url;
    }

    // Extrair bucket e filePath da URL original
    const extracted = extractFilePathFromUrl(url);
    if (!extracted) {
      return url; // Fallback para URL original se não conseguir extrair
    }

    const { bucket, filePath } = extracted;
    
    // Obter a URL base do Supabase (do .env ou da URL original)
    const urlObj = new URL(url);
    const supabaseUrl = `${urlObj.protocol}//${urlObj.host}`;
    
    // Construir URL da Edge Function
    // Formato: {supabaseUrl}/functions/v1/serve-document?bucket={bucket}&path={filePath}
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/serve-document?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(filePath)}`;
    
    return edgeFunctionUrl;
  } catch (error) {
    console.error('Erro ao converter URL para serve-document:', error);
    return url; // Fallback para URL original
  }
}

/**
 * Verifica se uma URL do S3 ou Supabase está válida
 * DEPRECATED: Para downloads, use downloadFile() diretamente.
 * Esta função ainda é usada para visualização de arquivos (PDFs, imagens) que precisam de URL.
 * 
 * IMPORTANTE: Para URLs do Supabase Storage, considere usar convertToServeDocumentUrl() primeiro
 * para ter página de erro customizada quando o arquivo não existir.
 */
export async function getValidFileUrl(url: string): Promise<string> {
  try {
    // Se não é uma URL do S3 ou Supabase, retorna como está
    if (!url.includes('s3.amazonaws.com') && !url.includes('supabase.co')) {
      return url;
    }

    // Para URLs do S3 externo, retornar a URL original
    if (url.includes('s3.amazonaws.com')) {
      return url;
    }

    // Para URLs do Supabase Storage, verificar se está válida
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        return url;
      }

      // Se a URL expirou ou é inválida, lançar erro
      // Não regeneramos signed URLs mais - use downloadFile() para downloads
      if (response.status === 403 || response.status === 400) {
        console.warn('URL do Supabase Storage expirou ou inválida. Para downloads, use downloadFile() em vez de getValidFileUrl().');
        throw new Error('URL expirada. Use download direto autenticado.');
      }
    } catch (fetchError: any) {
      // Se o erro é de URL expirada, relançar
      if (fetchError.message?.includes('URL expirada')) {
        throw fetchError;
      }
      
      console.error('Erro ao verificar URL do Supabase Storage:', fetchError);
      // Para outros erros, tentar retornar a URL original
      return url;
    }
    
    return url;
  } catch (error) {
    console.error('Erro ao verificar URL:', error);
    throw error;
  }
} 