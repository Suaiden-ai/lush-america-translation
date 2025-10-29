import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { getValidFileUrl } from '../../utils/fileUtils';
import { FileText, ArrowLeft, Download } from 'lucide-react';

interface VerifiedDoc {
  id: string;
  filename: string | null;
  file_url: string | null;
  translated_file_url: string | null;
}

export default function DocumentPreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>('document');

  useEffect(() => {
    async function load() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        // Sempre buscar na tabela documents_to_be_verified
        const { data, error } = await supabase
          .from('documents_to_be_verified')
          .select('id, filename, file_url, translated_file_url')
          .eq('id', id)
          .single();
        if (error) throw error;
        const doc = data as VerifiedDoc;
        setFilename(doc.filename || 'document');
        const source = doc.translated_file_url || doc.file_url;
        if (!source) {
          setError('Nenhum arquivo disponível para visualização.');
          return;
        }
        const valid = await getValidFileUrl(source);
        setFileUrl(valid);
      } catch (e: any) {
        setError(e?.message || 'Falha ao carregar documento');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleDownload() {
    if (!fileUrl) return;
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'document';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      // Abrir diretamente caso o fetch falhe
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded hover:bg-gray-100 text-gray-700"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <FileText className="w-5 h-5 text-tfe-blue-700" />
          <span className="font-semibold text-gray-900 truncate max-w-[40vw]">{filename}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={!fileUrl || loading}
            className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="w-4 h-4 inline-block mr-1" />
            Download
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {loading && (
          <div className="h-full flex items-center justify-center text-gray-600">Carregando...</div>
        )}
        {!loading && error && (
          <div className="h-full flex items-center justify-center text-tfe-red-600">{error}</div>
        )}
        {!loading && !error && fileUrl && (
          <iframe src={fileUrl} className="w-full h-full border-0" title="Document Viewer" />
        )}
      </div>
    </div>
  );
}


