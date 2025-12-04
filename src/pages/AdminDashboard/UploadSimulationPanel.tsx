import { useState, useEffect } from 'react';
import { AlertCircle, FileText, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { extractFilePathFromUrl } from '../../utils/fileUtils';

interface Document {
  id: string;
  filename: string;
  original_filename: string | null;
  user_id: string;
  status: string;
  file_url: string | null;
  created_at: string;
  profiles: {
    name: string;
    email: string;
  };
}

export function UploadSimulationPanel() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchRecentDocuments();
  }, []);

  const fetchRecentDocuments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('documents')
        .select(`
          id,
          filename,
          original_filename,
          user_id,
          status,
          file_url,
          created_at,
          profiles:user_id (
            name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setDocuments(data || []);
    } catch (err: any) {
      console.error('Error fetching documents:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Verifica se um arquivo existe no Storage
   */
  const checkFileExists = async (bucket: string, filePath: string): Promise<boolean> => {
    try {
      const pathParts = filePath.split('/').filter(p => p);
      const fileName = pathParts[pathParts.length - 1];
      const folderPath = pathParts.slice(0, -1).join('/') || '';

      // Tentar listar arquivos na pasta
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(folderPath, {
          limit: 1000,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' }
        });

      if (error) {
        // Se erro for "not found" ou similar, arquivo não existe
        if (error.message?.includes('not found') || error.message?.includes('NotFound')) {
          return false;
        }
        console.warn(`[Simulação] Erro ao verificar existência do arquivo:`, error);
        return false;
      }

      // Verificar se encontrou o arquivo exato
      const exists = data?.some(file => file.name === fileName) || false;
      
      console.log(`[Simulação] Arquivo ${exists ? 'existe' : 'não existe'} no Storage: ${bucket}/${filePath}`);
      return exists;
    } catch (err) {
      console.warn(`[Simulação] Exceção ao verificar arquivo:`, err);
      return false;
    }
  };

  /**
   * Remove arquivo do Storage de forma robusta, tentando múltiplas variações do caminho
   */
  const removeFileFromStorage = async (fileUrl: string, userId: string, filename: string): Promise<boolean> => {
    const extracted = extractFilePathFromUrl(fileUrl);
    
    if (!extracted) {
      console.warn('[Simulação] Não foi possível extrair filePath da URL:', fileUrl);
      return false;
    }

    const { filePath, bucket } = extracted;
    const pathsToTry: string[] = [
      filePath, // Caminho original extraído
      `${userId}/${filename}`, // Formato padrão userId/filename
      filePath.split('/').slice(-2).join('/'), // Últimos 2 segmentos
      filePath.split('/').pop() || '', // Apenas o nome do arquivo
    ];

    // Remover duplicatas
    const uniquePaths = [...new Set(pathsToTry.filter(p => p))];

    console.log(`[Simulação] Tentando remover arquivo do Storage: ${bucket}`);
    console.log(`[Simulação] Caminhos a tentar:`, uniquePaths);

    let removed = false;
    let lastError: any = null;

    for (const path of uniquePaths) {
      try {
        // 1. Verificar se arquivo existe antes de tentar remover
        const exists = await checkFileExists(bucket, path);
        
        if (!exists) {
          console.log(`[Simulação] Arquivo não existe no caminho: ${path}`);
          continue;
        }

        console.log(`[Simulação] Removendo arquivo do caminho: ${bucket}/${path}`);

        // 2. Tentar remover
        const { error: storageError, data } = await supabase.storage
          .from(bucket)
          .remove([path]);

        if (storageError) {
          lastError = storageError;
          console.warn(`[Simulação] Erro ao remover do caminho ${path}:`, storageError);
          continue;
        }

        // 3. Verificar se foi realmente removido
        await new Promise(resolve => setTimeout(resolve, 500)); // Aguardar um pouco
        const stillExists = await checkFileExists(bucket, path);
        
        if (!stillExists) {
          console.log(`[Simulação] ✅ Arquivo removido com sucesso do caminho: ${bucket}/${path}`);
          removed = true;
          break; // Arquivo removido, não precisa tentar outros caminhos
        } else {
          console.warn(`[Simulação] ⚠️ Arquivo ainda existe após remoção: ${bucket}/${path}`);
        }
      } catch (err) {
        lastError = err;
        console.warn(`[Simulação] Exceção ao remover do caminho ${path}:`, err);
      }
    }

    if (!removed && lastError) {
      console.error(`[Simulação] ❌ Não foi possível remover arquivo de nenhum caminho. Último erro:`, lastError);
    }

    return removed;
  };

  const handleSimulateError = async (documentId: string) => {
    if (!confirm('⚠️ ATENÇÃO: Esta ação irá:\n\n1. Remover COMPLETAMENTE o arquivo do Storage\n2. Limpar todos os vestígios do documento\n3. Marcar o documento como falhado\n\nTem certeza que deseja continuar?')) {
      return;
    }

    try {
      setSimulating(documentId);
      setError(null);
      setSuccess(null);

      console.log(`[Simulação] 🚀 Iniciando simulação de falha para documento: ${documentId}`);

      // 1. Buscar informações completas do documento do banco
      const { data: documentData, error: docError } = await supabase
        .from('documents')
        .select('id, file_url, user_id, filename, original_filename')
        .eq('id', documentId)
        .single();

      if (docError || !documentData) {
        throw new Error('Documento não encontrado no banco de dados');
      }

      console.log(`[Simulação] Documento encontrado:`, {
        id: documentData.id,
        filename: documentData.filename,
        hasFileUrl: !!documentData.file_url
      });

      // 2. Remover arquivo do Storage de forma robusta
      let fileRemoved = false;
      if (documentData.file_url) {
        console.log(`[Simulação] Removendo arquivo do Storage...`);
        fileRemoved = await removeFileFromStorage(
          documentData.file_url,
          documentData.user_id,
          documentData.original_filename || documentData.filename
        );
      } else {
        console.log(`[Simulação] Documento não tem file_url, pulando remoção do Storage`);
      }

      // 3. Remover registros de documents_to_be_verified se existir
      // IMPORTANTE: Usar original_document_id, não document_id
      const { data: verifiedDocs, error: verifiedQueryError } = await supabase
        .from('documents_to_be_verified')
        .select('id, original_document_id, filename')
        .eq('original_document_id', documentId);
      
      if (verifiedQueryError) {
        console.warn('[Simulação] ⚠️ Erro ao buscar em documents_to_be_verified:', verifiedQueryError);
      } else if (verifiedDocs && verifiedDocs.length > 0) {
        console.log(`[Simulação] Encontrados ${verifiedDocs.length} registro(s) em documents_to_be_verified para remover`);
        console.log(`[Simulação] IDs de documents_to_be_verified a remover:`, verifiedDocs.map(d => d.id));
        
        // 3.1. Primeiro, remover translated_documents relacionados (se existirem)
        const verifiedIds = verifiedDocs.map(d => d.id);
        const { data: translatedDocs, error: translatedQueryError } = await supabase
          .from('translated_documents')
          .select('id, original_document_id')
          .in('original_document_id', verifiedIds);
        
        if (translatedQueryError) {
          console.warn('[Simulação] ⚠️ Erro ao buscar translated_documents:', translatedQueryError);
        } else if (translatedDocs && translatedDocs.length > 0) {
          console.log(`[Simulação] Encontrados ${translatedDocs.length} registro(s) em translated_documents para remover`);
          const { error: deleteTranslatedError } = await supabase
            .from('translated_documents')
            .delete()
            .in('original_document_id', verifiedIds);
          
          if (deleteTranslatedError) {
            console.error('[Simulação] ❌ Erro ao remover translated_documents:', deleteTranslatedError);
            throw new Error(`Falha ao remover translated_documents: ${deleteTranslatedError.message}`);
          } else {
            console.log('[Simulação] ✅ Registro(s) removido(s) de translated_documents com sucesso');
          }
        } else {
          console.log('[Simulação] Nenhum registro encontrado em translated_documents para remover');
        }
        
        // 3.2. Agora remover documents_to_be_verified
        // Agora há política RLS para DELETE para admins
        const { error: deleteVerifiedError } = await supabase
          .from('documents_to_be_verified')
          .delete()
          .eq('original_document_id', documentId);
        
        if (deleteVerifiedError) {
          console.error('[Simulação] ❌ Erro ao remover de documents_to_be_verified:', deleteVerifiedError);
          throw new Error(`Falha ao remover de documents_to_be_verified: ${deleteVerifiedError.message}`);
        } else {
          console.log('[Simulação] ✅ Registro(s) removido(s) de documents_to_be_verified com sucesso');
          
          // Verificar se todos foram removidos
          const { data: remainingDocs } = await supabase
            .from('documents_to_be_verified')
            .select('id')
            .eq('original_document_id', documentId);
          
          if (remainingDocs && remainingDocs.length > 0) {
            console.warn(`[Simulação] ⚠️ Ainda restam ${remainingDocs.length} registro(s) após remoção. Tentando remover novamente...`);
            // Tentar remover novamente pelos IDs específicos
            const remainingIds = remainingDocs.map(d => d.id);
            const { error: retryError } = await supabase
              .from('documents_to_be_verified')
              .delete()
              .in('id', remainingIds);
            
            if (retryError) {
              console.error('[Simulação] ❌ Erro ao remover registros restantes:', retryError);
            } else {
              console.log('[Simulação] ✅ Registros restantes removidos com sucesso');
            }
          }
        }
      } else {
        console.log('[Simulação] Nenhum registro encontrado em documents_to_be_verified para este documento');
      }

      // 4. Remover registros de documents_to_verify se existir
      const { data: verifyDocs } = await supabase
        .from('documents_to_verify')
        .select('id')
        .eq('doc_id', documentId);
      
      if (verifyDocs && verifyDocs.length > 0) {
        console.log(`[Simulação] Removendo ${verifyDocs.length} registro(s) de documents_to_verify`);
        const { error: deleteVerifyError } = await supabase
          .from('documents_to_verify')
          .delete()
          .eq('doc_id', documentId);
        
        if (deleteVerifyError) {
          console.warn('[Simulação] ⚠️ Aviso ao remover de documents_to_verify:', deleteVerifyError);
        } else {
          console.log('[Simulação] ✅ Registro(s) removido(s) de documents_to_verify');
        }
      }

      // 5. Limpar file_url e outros campos relacionados no banco ANTES de marcar como falhado
      const { error: updateError } = await supabase
        .from('documents')
        .update({ 
          file_url: null,
          file_id: null // Limpar file_id também se existir
        })
        .eq('id', documentId);

      if (updateError) {
        console.warn('[Simulação] ⚠️ Aviso ao limpar file_url:', updateError);
      } else {
        console.log('[Simulação] ✅ file_url e file_id limpos do banco');
      }

      // 6. Marcar documento como falhado via Edge Function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();

      console.log('[Simulação] Marcando documento como falhado via Edge Function...');
      const response = await fetch(`${supabaseUrl}/functions/v1/update-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({
          documentId,
          userId: documentData.user_id,
          markUploadFailed: true
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao marcar documento como falhado: ${errorText}`);
      }

      console.log('[Simulação] ✅ Documento marcado como falhado');

      // 7. Verificação final: confirmar que file_url está null
      const { data: finalCheck } = await supabase
        .from('documents')
        .select('file_url, upload_failed_at')
        .eq('id', documentId)
        .single();

      if (finalCheck) {
        if (finalCheck.file_url) {
          console.warn('[Simulação] ⚠️ ATENÇÃO: file_url ainda não está null após limpeza!');
        } else {
          console.log('[Simulação] ✅ Verificação final: file_url está null');
        }
        
        if (finalCheck.upload_failed_at) {
          console.log('[Simulação] ✅ Verificação final: upload_failed_at está preenchido');
        } else {
          console.warn('[Simulação] ⚠️ ATENÇÃO: upload_failed_at não está preenchido!');
        }
      }

      const successMessage = fileRemoved 
        ? '✅ Falha simulada com sucesso! Arquivo removido do Storage e todos os vestígios limpos.'
        : '⚠️ Falha simulada, mas houve problemas ao remover o arquivo do Storage. Verifique os logs.';

      setSuccess(successMessage);
      console.log(`[Simulação] 🎉 Simulação concluída para documento: ${documentId}`);
      
      await fetchRecentDocuments();
    } catch (err: any) {
      console.error('[Simulação] ❌ Erro ao simular falha de upload:', err);
      setError(err.message || 'Erro ao simular falha de upload');
    } finally {
      setSimulating(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Simulação de Erro de Upload
        </h2>
        <p className="text-sm text-gray-600">
          Use esta ferramenta para simular falhas de upload durante testes. 
          Isso removerá o file_url do documento e marcará como upload falhado.
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <XCircle className="h-5 w-5 text-red-600 mr-2" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <p className="text-sm text-green-800">{success}</p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Documento
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cliente
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Arquivo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {documents.map((doc) => (
              <tr key={doc.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 text-gray-400 mr-2" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {doc.original_filename || doc.filename}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {doc.profiles?.name || 'N/A'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {doc.profiles?.email || 'N/A'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    doc.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    doc.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                    doc.status === 'completed' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {doc.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {doc.file_url ? (
                    <span className="text-sm text-green-600 flex items-center">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Presente
                    </span>
                  ) : (
                    <span className="text-sm text-red-600 flex items-center">
                      <XCircle className="h-4 w-4 mr-1" />
                      Ausente
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {doc.file_url && (
                    <button
                      onClick={() => handleSimulateError(doc.id)}
                      disabled={simulating === doc.id}
                      className="text-amber-600 hover:text-amber-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {simulating === doc.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-600 mr-2"></div>
                          Simulando...
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 mr-1" />
                          Simular Falha
                        </>
                      )}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {documents.length === 0 && (
        <div className="text-center py-8">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Nenhum documento recente encontrado</p>
        </div>
      )}
    </div>
  );
}



