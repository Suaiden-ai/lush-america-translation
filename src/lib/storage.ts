import { useEffect } from 'react';
import { supabase, STORAGE_BUCKETS } from './supabase';

/**
 * Utilitários para acesso seguro a arquivos no Supabase Storage (Buckets Privados).
 * Baseado na arquitetura de Multi-Nível (Download -> Signed -> Proxy).
 */

const N8N_STORAGE_TOKEN = import.meta.env.VITE_N8N_STORAGE_TOKEN || '';

/**
 * Obtém uma URL segura para exibir um arquivo.
 * Tenta: 1. Download direto (Blob) -> 2. Signed URL -> 3. Document Proxy
 */
export async function getSecureUrl(bucket: string, path: string): Promise<string> {
    try {
        // 1. Tentar download direto para gerar um Blob URL (respeita RLS do usuário logado)
        const { data, error } = await supabase.storage.from(bucket || STORAGE_BUCKETS.DOCUMENTS).download(path);

        if (data && !error) {
            return URL.createObjectURL(data);
        }

        // 2. Se falhar (ex: RLS bloqueando download direto mas permitindo signed url)
        const { data: signedData, error: signedError } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, 3600); // 1 hora

        if (signedData?.signedUrl && !signedError) {
            return signedData.signedUrl;
        }

        // 3. Fallback final: Document Proxy via Edge Function
        return getDocumentProxyUrl(bucket, path);
    } catch (err) {
        console.error('Erro ao obter URL segura:', err);
        return getDocumentProxyUrl(bucket, path);
    }
}

/**
 * Converte uma URL pública do Supabase em uma URL segura.
 */
export async function convertPublicToSecure(publicUrl: string): Promise<string> {
    if (!publicUrl || !publicUrl.includes('supabase.co')) return publicUrl;

    try {
        const url = new URL(publicUrl);
        const pathParts = url.pathname.split('/').filter(p => p);

        // Identificar o bucket e o path
        const objectIndex = pathParts.findIndex(p => p === 'object');
        const publicIndex = pathParts.findIndex(p => p === 'public');

        let bucketIndex = -1;
        if (publicIndex >= 0) bucketIndex = publicIndex + 1;
        else if (objectIndex >= 0) bucketIndex = objectIndex + 2; // /storage/v1/object/public/bucket/path

        if (bucketIndex >= 0 && bucketIndex < pathParts.length) {
            const bucket = pathParts[bucketIndex];
            const path = pathParts.slice(bucketIndex + 1).join('/');
            return await getSecureUrl(bucket, path);
        }
    } catch (e) {
        console.error('Erro ao converter URL:', e);
    }

    return publicUrl;
}

/**
 * Gera a URL para o Document Proxy (Edge Function serve-document).
 */
export function getDocumentProxyUrl(bucket: string, path: string): string {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${supabaseUrl}/functions/v1/serve-document?bucket=${bucket}&path=${encodeURIComponent(path)}`;
}

/**
 * Gera a URL para o Proxy do N8N (Edge Function).
 */
export function getN8nProxyUrl(publicUrl: string): string {
    if (!publicUrl || !publicUrl.includes('supabase.co')) return publicUrl;

    try {
        const url = new URL(publicUrl);
        const pathParts = url.pathname.split('/').filter(p => p);

        const publicIndex = pathParts.findIndex(p => p === 'public');
        if (publicIndex >= 0 && publicIndex + 1 < pathParts.length) {
            const bucket = pathParts[publicIndex + 1];
            const path = pathParts.slice(publicIndex + 2).join('/');

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            return `${supabaseUrl}/functions/v1/n8n-storage-access?bucket=${bucket}&path=${encodeURIComponent(path)}&token=${N8N_STORAGE_TOKEN}`;
        }
    } catch (e) {
        console.error('Erro ao gerar URL proxy N8N:', e);
    }

    return publicUrl;
}

/**
 * Hook para gerenciar Blob URLs e evitar memory leaks.
 */
export function useBlobCleanup(url: string | null) {
    useEffect(() => {
        return () => {
            if (url && url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
        };
    }, [url]);
}
