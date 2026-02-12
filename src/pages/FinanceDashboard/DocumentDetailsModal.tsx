import { useState, useEffect, useCallback } from 'react';
import { XCircle, FileText, User as UserIcon, Calendar, Hash, Eye, Download, Phone, Clock, AlertCircle, X, CheckCircle } from 'lucide-react';
import { Document as AppDocument } from './types/payments.types';
import { supabase, db } from '../../lib/supabase';

interface DocumentDetailsModalProps {
  document: AppDocument | null;
  onClose: () => void;
}

// Definindo um tipo para o perfil do usuário para maior clareza
type UserProfile = {
  name: string;
  email: string;
  phone: string | null;
};

export function DocumentDetailsModal({ document, onClose }: DocumentDetailsModalProps) {
  // Estados para informações do usuário e do documento
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [translatedDoc, setTranslatedDoc] = useState<{ translated_file_url: string; filename: string; original_document_id?: string; } | null>(null);
  const [loadingTranslated, setLoadingTranslated] = useState(false);
  const [actualDocumentStatus, setActualDocumentStatus] = useState<string | null>(null);

  // Estados para o Preview Modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'pdf'>('pdf');
  const [previewLoading, setPreviewLoading] = useState(false);

  // Helper local para cores e ícones de status (evita problemas de tipo com o helper global)
  const getStatusInfo = useCallback((status: string | null) => {
    const s = status?.toLowerCase() || 'pending';
    switch (s) {
      case 'completed':
      case 'approved':
        return {
          bg: 'bg-green-50',
          text: 'text-green-600',
          border: 'border-green-100',
          icon: <CheckCircle className="w-5 h-5 text-green-600" />
        };
      case 'processing':
        return {
          bg: 'bg-tfe-blue-50',
          text: 'text-tfe-blue-600',
          border: 'border-tfe-blue-100',
          icon: <FileText className="w-5 h-5 text-tfe-blue-600" />
        };
      case 'pending':
        return {
          bg: 'bg-yellow-50',
          text: 'text-yellow-600',
          border: 'border-yellow-100',
          icon: <Clock className="w-5 h-5 text-yellow-600" />
        };
      default:
        return {
          bg: 'bg-gray-50',
          text: 'text-gray-600',
          border: 'border-gray-100',
          icon: <FileText className="w-5 h-5 text-gray-600" />
        };
    }
  }, []);

  // Buscar documento traduzido, perfil do usuário e status atualizado quando o documento mudar
  useEffect(() => {
    if (document) {
      fetchUserProfile();
      fetchTranslatedDocument();
      fetchActualDocumentStatus();
    }
  }, [document]);

  const fetchUserProfile = async () => {
    if (!document?.user_id) return;

    setLoadingProfile(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, email, phone')
        .eq('id', document.user_id)
        .single();

      if (error) {
        console.error('❌ Erro ao buscar perfil do usuário:', error);
        setUserProfile(null);
      } else {
        setUserProfile(data);
      }
    } catch (err) {
      console.error('💥 Erro na busca do perfil:', err);
      setUserProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchTranslatedDocument = async () => {
    if (!document?.user_id || !document.filename) return;

    setLoadingTranslated(true);
    try {
      // 1. Buscar na tabela documents_to_be_verified (dtbv) que é o elo central
      let dtbvQuery = supabase
        .from('documents_to_be_verified')
        .select('id, filename, translated_file_url')
        .eq('user_id', document.user_id);

      if (document.document_type === 'authenticator') {
        dtbvQuery = dtbvQuery.eq('id', document.id);
      } else {
        dtbvQuery = dtbvQuery.eq('filename', document.filename);
      }

      const { data: dtbvData, error: dtbvError } = await dtbvQuery
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dtbvError) {
        console.error('❌ Erro ao buscar documento verificado:', dtbvError);
      }

      if (dtbvData) {
        // 2. Agora buscar na tabela translated_documents usando o ID do dtbv
        const { data: translatedDocs, error: tError } = await supabase
          .from('translated_documents')
          .select('translated_file_url, filename, original_document_id, user_id')
          .eq('original_document_id', dtbvData.id)
          .order('created_at', { ascending: false });

        if (!tError && translatedDocs && translatedDocs.length > 0) {
          setTranslatedDoc(translatedDocs[0]);
          return;
        }

        // 3. Se não encontrou em translated_documents, verificar se o dtbv tem a URL (n8n)
        if (dtbvData.translated_file_url) {
          setTranslatedDoc({
            translated_file_url: dtbvData.translated_file_url,
            filename: dtbvData.filename
          });
          return;
        }
      }

      // 4. Última tentativa: busca direta por filename original
      const { data: directDocs, error: directError } = await supabase
        .from('translated_documents')
        .select('translated_file_url, filename, original_document_id')
        .eq('user_id', document.user_id)
        .eq('filename', document.filename)
        .order('created_at', { ascending: false });

      if (!directError && directDocs && directDocs.length > 0) {
        setTranslatedDoc(directDocs[0]);
        return;
      }
    } catch (error) {
      console.error('💥 Erro ao buscar documento traduzido:', error);
    } finally {
      setLoadingTranslated(false);
    }
  };

  const fetchActualDocumentStatus = async () => {
    if (!document?.filename) return;

    try {
      const { data: verifiedDoc } = await supabase
        .from('documents_to_be_verified')
        .select('status')
        .eq('filename', document.filename)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setActualDocumentStatus(verifiedDoc ? verifiedDoc.status : document.status);
    } catch (err) {
      console.error('💥 Erro na busca do status:', err);
      setActualDocumentStatus(document.status);
    }
  };

  if (!document) return null;

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDownload = async (url: string) => {
    try {
      const { extractFilePathFromUrl } = await import('../../utils/fileUtils');
      const pathInfo = extractFilePathFromUrl(url);

      if (!pathInfo) {
        window.open(url, '_blank');
        return;
      }

      const filename = translatedDoc?.filename || `translated_${document.filename}`;
      const success = await db.downloadFileAndTrigger(pathInfo.filePath, filename, pathInfo.bucket);

      if (!success) {
        alert('Não foi possível baixar o arquivo. Por favor, tente novamente.');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Erro ao baixar o arquivo.');
    }
  };

  const handleView = async (url: string) => {
    setPreviewLoading(true);
    setIsPreviewOpen(true);
    try {
      const viewUrl = await db.generateViewUrl(url);
      if (viewUrl) {
        setPreviewUrl(viewUrl);
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
        setPreviewType(isImage ? 'image' : 'pdf');
      } else {
        alert('Não foi possível gerar link para visualização.');
        setIsPreviewOpen(false);
      }
    } catch (error) {
      console.error('Error viewing file:', error);
      alert('Erro ao visualizar o arquivo.');
      setIsPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const statusInfo = getStatusInfo(actualDocumentStatus || document.status);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${statusInfo.bg}`}>
                <FileText className={`w-6 h-6 ${statusInfo.text}`} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 leading-tight">Detalhes do Documento</h2>
                <p className="text-sm text-gray-500 font-medium">Informações completas e arquivos</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Status Banner */}
            <div className={`p-4 rounded-2xl flex items-center gap-4 ${statusInfo.bg} border ${statusInfo.border}`}>
              <div className={`p-2.5 rounded-xl bg-white/80 shadow-sm`}>
                {statusInfo.icon}
              </div>
              <div>
                <p className={`text-sm font-bold uppercase tracking-wider ${statusInfo.text}`}>Status Atual</p>
                <p className="text-lg font-semibold text-gray-900 capitalize">{actualDocumentStatus || document.status}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* User Info */}
              <section className="space-y-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <UserIcon className="w-4 h-4" /> Cliente
                </h3>
                <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100 space-y-3">
                  {loadingProfile ? (
                    <div className="animate-pulse space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">Nome</label>
                        <p className="text-gray-900 font-medium">{userProfile?.name || ('client_name' in document ? (document as any).client_name : 'N/A')}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">E-mail</label>
                        <p className="text-gray-900 font-medium truncate">{userProfile?.email || ('user_email' in document ? (document as any).user_email : 'N/A')}</p>
                      </div>
                      {userProfile?.phone && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone className="w-3.5 h-3.5" />
                          <span className="text-sm font-medium">{userProfile.phone}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>

              {/* Document Details */}
              <section className="space-y-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Hash className="w-4 h-4" /> Documento
                </h3>
                <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100 space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">Arquivo Original</label>
                    <p className="text-gray-900 font-medium truncate" title={document.filename}>{document.filename}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase">Páginas</label>
                      <p className="text-gray-900 font-medium">{document.pages || 0}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase">Criado em</label>
                      <div className="flex items-center gap-1.5 text-gray-900 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-[13px]">{formatDate(document.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Verification Info - Highlighted */}
            {document.verification_code && (
              <section className="bg-tfe-blue-50/50 rounded-2xl p-5 border border-tfe-blue-100 space-y-3">
                <h3 className="text-xs font-bold text-tfe-blue-600 uppercase tracking-widest flex items-center gap-2">
                  <Hash className="w-4 h-4" /> Código de Verificação Digital
                </h3>
                <div className="flex items-center gap-3">
                  <div className="bg-white px-4 py-2 rounded-xl border border-tfe-blue-200 font-mono text-xl font-bold text-tfe-blue-700 shadow-sm">
                    {document.verification_code}
                  </div>
                  <div className="text-xs text-tfe-blue-600 font-medium leading-relaxed">
                    Este código permite que qualquer pessoa<br />verifique a autenticidade deste documento.
                  </div>
                </div>
              </section>
            )}

            {/* Actions */}
            <section className="space-y-4 pt-2">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Arquivo Disponível</h3>
              <div className="space-y-3">
                {loadingTranslated ? (
                  <div className="bg-gray-50 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 border border-dashed border-gray-200">
                    <div className="w-8 h-8 border-4 border-tfe-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Buscando Tradução...</p>
                  </div>
                ) : translatedDoc ? (
                  <div className="bg-gradient-to-br from-tfe-blue-600 to-tfe-blue-800 rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-tfe-blue-200 group hover:scale-[1.01] transition-all">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white/20 backdrop-blur-md rounded-xl">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white text-lg leading-tight">Documento Traduzido</p>
                          <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter backdrop-blur-sm">Final</span>
                        </div>
                        <p className="text-xs text-white/80 font-medium">Tradução autenticada e verificada</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleView(translatedDoc.translated_file_url)}
                        className="p-2.5 text-white hover:bg-white/20 rounded-xl transition-colors"
                        title="Visualizar"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDownload(translatedDoc.translated_file_url)}
                        className="p-2.5 text-white hover:bg-white/20 rounded-xl transition-colors"
                        title="Baixar"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-2xl p-6 border border-dashed border-gray-200 flex flex-col items-center justify-center text-center gap-2">
                    <Clock className="w-8 h-8 text-gray-300" />
                    <div>
                      <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Tradução Pendente</p>
                      <p className="text-xs text-gray-400 font-medium mt-1">Este documento ainda está sendo processado<br />ou aguarda autenticação final.</p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex justify-end">
            <button
              onClick={onClose}
              className="px-8 py-3 bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
            >
              Fechar Detalhes
            </button>
          </div>
        </div>
      </div>

      {/* Preview Modal Overlay (Full Page) */}
      {isPreviewOpen && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col animate-in fade-in duration-300">
          <div className="flex items-center justify-between p-4 bg-black/50 text-white z-10 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-tfe-blue-400" />
              <h3 className="text-lg font-bold truncate max-w-md">{translatedDoc?.filename || 'Pré-visualização'}</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownload(translatedDoc?.translated_file_url || '')}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all flex items-center gap-2 text-sm font-bold"
              >
                <Download className="w-4 h-4" /> Baixar
              </button>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="p-2 hover:bg-white/10 rounded-xl transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
          <div className="flex-1 relative bg-gray-900 overflow-hidden flex items-center justify-center">
            {previewLoading ? (
              <div className="flex flex-col items-center gap-4 text-white">
                <div className="w-12 h-12 border-4 border-tfe-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-bold uppercase tracking-widest opacity-60">Carregando documento...</p>
              </div>
            ) : previewUrl ? (
              previewType === 'image' ? (
                <div className="w-full h-full p-4 flex items-center justify-center">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-w-full max-h-full object-contain shadow-2xl"
                  />
                </div>
              ) : (
                <iframe
                  src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0&zoom=50`}
                  className="w-full h-full border-none"
                  title="PDF Preview"
                />
              )
            ) : (
              <div className="flex flex-col items-center gap-2 text-white opacity-40">
                <AlertCircle className="w-12 h-12" />
                <p>Falha ao carregar pré-visualização</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}