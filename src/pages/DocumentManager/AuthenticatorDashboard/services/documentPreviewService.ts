/**
 * Service para manipulação de arquivos de preview
 * Funções auxiliares para download e geração de URLs
 */

export async function generateViewUrl(url: string): Promise<string | null> {
  try {
    const { db } = await import('../../../../lib/supabase');
    return await db.generateViewUrl(url);
  } catch (error) {
    console.error('Error generating view URL:', error);
    return null;
  }
}

export async function downloadFileDirect(url: string, filename: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    if (response.ok) {
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error downloading file directly:', error);
    return false;
  }
}
