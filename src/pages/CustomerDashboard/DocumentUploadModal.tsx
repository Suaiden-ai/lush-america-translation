import React, { useState, useRef } from 'react';
import { Upload, XCircle, FileText, CheckCircle, AlertCircle, Info, Shield, DollarSign, Award } from 'lucide-react';
import { supabase, STORAGE_BUCKETS } from '../../lib/supabase';
import { fileStorage } from '../../utils/fileStorage';
import { generateUniqueFileName } from '../../utils/fileUtils';
import { PaymentMethodModal } from '../../components/PaymentMethodModal';
import { ZellePaymentModal } from '../../components/ZellePaymentModal';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
  currentFolderId?: string;
}

export function DocumentUploadModal({ isOpen, onClose, userId, userEmail, currentFolderId }: DocumentUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pages, setPages] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [tipoTrad, setTipoTrad] = useState<'Certified'>('Certified');
  const [isExtrato, setIsExtrato] = useState<boolean | null>(null);
  const [idiomaRaiz, setIdiomaRaiz] = useState('Portuguese');

  // Estados para os modais de pagamento
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showZelleModal, setShowZelleModal] = useState(false);
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);

  const translationTypes = [
    { value: 'Certified', label: 'Certified' },
  ];

  const languages = [
    'Portuguese',
    'Portuguese (Portugal)',
    'Spanish',
    'German',
    'Arabic',
    'Hebrew',
    'Japanese',
    'Korean',
  ];

  // Function to calculate the value
  function calculateValue(pages: number, isBankStatement: boolean | null) {
    if (isBankStatement === null) return 0; // Retornar 0 se não foi selecionado
    if (isBankStatement) {
      return pages * 25; // $20 base + $5 bank statement fee
    } else {
      return pages * 20; // $20 per page
    }
  }
  const value = calculateValue(pages, isExtrato);

  if (!isOpen) return null;

  // Substituir import dinâmico do pdfjs-dist por função loadPdfJs
  let pdfjsLib: any = null;
  let pdfjsWorkerSrc: string | undefined = undefined;

  async function loadPdfJs() {
    if (!pdfjsLib) {
      pdfjsLib = await import('pdfjs-dist/build/pdf');
      // @ts-ignore
      pdfjsWorkerSrc = (await import('pdfjs-dist/build/pdf.worker?url')).default;
      // @ts-ignore
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc;
    }
    return pdfjsLib;
  }

  const handleFileChange = async (file: File) => {
    setError(null);
    setSuccess(null);
    setFileUrl(null);
    setPages(1);
    setSelectedFile(file);
    if (file.type === 'application/pdf') {
      try {
        const pdfjsLib = await loadPdfJs();
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        setPages(pdf.numPages);
      } catch (err) {
        setError('Failed to read PDF pages');
        setPages(1);
      }
    } else {
      setPages(1);
    }
    // Preview for images
    if (file.type.startsWith('image/')) {
      setFileUrl(URL.createObjectURL(file));
    }
  };

  // Função para processar pagamento direto com Stripe
  const handleDirectPayment = async (fileId: string, customPayload?: any) => {
    try {
      console.log('DEBUG: Iniciando processamento do pagamento');

      // Salvar arquivo no IndexedDB antes do pagamento
      if (!selectedFile) {
        throw new Error('Nenhum arquivo selecionado');
      }

      // Gerar nome único com código aleatório para o filename
      const uniqueFileName = generateUniqueFileName(selectedFile.name);
      console.log('DEBUG: Nome único gerado:', uniqueFileName);
      console.log('DEBUG: Nome original do arquivo:', selectedFile.name);

      // Usar payload customizado se fornecido, senão usar o padrão
      const payload = customPayload || {
        pages,
        isCertified: true, // Always certified now
        isNotarized: tipoTrad === 'Certified',
        isBankStatement: isExtrato,
        fileId, // Usar o ID do arquivo no IndexedDB
        userId,
        userEmail, // Adicionar email do usuário
        filename: uniqueFileName, // Usar nome único com código aleatório
        originalFilename: selectedFile?.name, // Nome original do arquivo
        isMobile: false // Desktop
      };
      console.log('Payload enviado para checkout:', payload);

      // CRIAR DOCUMENTO NO BANCO ANTES DO PAGAMENTO
      console.log('DEBUG: Criando documento no banco antes do pagamento');

      console.log('DEBUG: Dados do documento a ser criado:', {
        userId,
        filename: uniqueFileName,
        original_filename: selectedFile.name,
        pages,
        status: 'draft',
        total_cost: calculateValue(pages, isExtrato)
      });

      const { data: newDocument, error: createError } = await supabase
        .from('documents')
        .insert({
          user_id: userId,
          filename: uniqueFileName, // Usar nome com código aleatório
          original_filename: selectedFile.name, // Salvar nome original
          pages: pages,
          status: 'draft', // Criar como draft até o pagamento ser confirmado
          total_cost: calculateValue(pages, isExtrato),
          verification_code: 'TFE' + Math.random().toString(36).substr(2, 6).toUpperCase(),
          is_authenticated: true,
          upload_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          tipo_trad: tipoTrad,
          idioma_raiz: idiomaRaiz,
          is_bank_statement: isExtrato
        })
        .select()
        .single();

      if (createError) {
        console.error('ERROR: Erro ao criar documento no banco:', createError);
        console.error('ERROR: Detalhes do erro:', {
          code: createError.code,
          message: createError.message,
          details: createError.details
        });
        throw new Error('Erro ao criar documento no banco de dados');
      }

      console.log('DEBUG: Documento criado no banco:', newDocument.id);
      console.log('DEBUG: Verificação dos campos salvos:', {
        filename: newDocument.filename,
        original_filename: newDocument.original_filename
      });

      if (!newDocument) {
        console.error('ERROR: Documento não foi criado (sem erro, mas sem retorno)');
        throw new Error('Erro ao criar documento no banco de dados');
      }

      console.log('DEBUG: Documento criado no banco:', {
        id: newDocument.id,
        status: newDocument.status,
        filename: newDocument.filename
      });

      // Adicionar o documentId ao payload
      const payloadWithDocumentId = {
        ...payload,
        documentId: newDocument.id
      };

      console.log('DEBUG: Criando sessão do Stripe com payload:', payloadWithDocumentId);
      console.log('DEBUG: URL de cancelamento esperada:', `${window.location.origin}/payment-cancelled?document_id=${newDocument.id}`);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        console.error('ERROR: Usuário não está autenticado');
        throw new Error('Usuário não está autenticado');
      }

      console.log('DEBUG: Chamando create-checkout-session com token válido');
      const response = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify(payloadWithDocumentId)
      });

      console.log('DEBUG: Resposta da Edge Function:', response.status);

      if (!response.ok) {
        let errorData = null;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: 'Resposta não é JSON', raw: await response.text() };
        }
        console.error('Erro detalhado da Edge Function:', errorData);
        throw new Error(errorData.error || 'Erro ao criar sessão de pagamento');
      }

      const { url } = await response.json();
      console.log('DEBUG: URL do Stripe Checkout:', url);

      // Redirecionar para o Stripe Checkout
      window.location.href = url;

    } catch (err: any) {
      console.error('ERROR: Erro no pagamento:', err);
      setError(err.message || 'Erro ao processar pagamento');
    }
  };

  // Detecta se é mobile (iOS/Android)
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const handleUpload = async () => {
    if (!selectedFile) return;

    // Validação: verificar se o campo bank statement foi preenchido
    if (isExtrato === null) {
      setError('Por favor, selecione se o documento é um extrato bancário ou não.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsUploading(true);

    try {
      // Criar documento no banco primeiro
      console.log('DEBUG: Criando documento no banco antes do pagamento');

      // Gerar nome único com código aleatório para o filename
      const uniqueFileName = generateUniqueFileName(selectedFile.name);
      console.log('DEBUG: Nome único gerado:', uniqueFileName);
      console.log('DEBUG: Nome original do arquivo:', selectedFile.name);

      const { data: newDocument, error: createError } = await supabase
        .from('documents')
        .insert({
          user_id: userId,
          filename: uniqueFileName, // Usar nome com código aleatório
          original_filename: selectedFile.name, // Salvar nome original
          pages: pages,
          status: 'draft',
          total_cost: calculateValue(pages, isExtrato),
          verification_code: 'TFE' + Math.random().toString(36).substr(2, 6).toUpperCase(),
          is_authenticated: true,
          upload_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          tipo_trad: tipoTrad,
          idioma_raiz: idiomaRaiz,
          idioma_destino: 'English',
          is_bank_statement: isExtrato,
          current_folder_id: currentFolderId || null
        })
        .select()
        .single();

      if (createError) {
        console.error('ERROR: Erro ao criar documento no banco:', createError);

        // Logar erro de upload
        const { logError, showUserFriendlyError } = await import('../../utils/errorHelpers');
        await logError('upload', createError, {
          userId,
          filename: uniqueFileName,
          additionalInfo: {
            original_filename: selectedFile.name,
            pages,
            file_size: selectedFile.size,
            file_type: selectedFile.type,
            error_code: createError.code,
            error_message: createError.message,
          },
        });

        showUserFriendlyError('UPLOAD_ERROR');
        throw new Error('Erro ao criar documento no banco de dados');
      }

      console.log('DEBUG: Documento criado no banco:', newDocument.id);

      // Armazenar o ID do documento para usar nos modais de pagamento
      setCurrentDocumentId(newDocument.id);

      // Mostrar modal de seleção de método de pagamento
      setShowPaymentModal(true);

    } catch (err: any) {
      console.error('ERROR: Erro ao preparar documento:', err);

      // Se já logou o erro acima, não logar novamente
      if (!err.message?.includes('Erro ao criar documento no banco de dados')) {
        // Logar erro genérico de upload
        const { logError, showUserFriendlyError } = await import('../../utils/errorHelpers');
        await logError('upload', err, {
          userId,
          filename: selectedFile?.name,
          additionalInfo: {
            file_size: selectedFile?.size,
            file_type: selectedFile?.type,
            pages,
          },
        });

        showUserFriendlyError('UPLOAD_ERROR');
      }

      setError('Erro ao preparar documento. Por favor, tente novamente.');
    } finally {
      setIsUploading(false);
    }
  };

  // Função para processar pagamento com Stripe
  const handleStripePayment = async () => {
    if (!selectedFile || !currentDocumentId) return;

    try {
      setIsUploading(true);
      setError(null);

      if (isMobile) {
        // Mobile: Tentar usar IndexedDB primeiro
        try {
          const fileId = await fileStorage.storeFile(selectedFile, {
            documentType: tipoTrad,
            certification: true,
            notarization: tipoTrad === 'Certified',
            pageCount: pages,
            isBankStatement: isExtrato,
            originalLanguage: idiomaRaiz,
            userId,
            currentFolderId
          });

          await handleDirectPayment(fileId);
        } catch (indexedDBError) {
          // Fallback: Upload direto para Supabase Storage
          const fileName = generateUniqueFileName(selectedFile.name);
          const filePath = `${userId}/${fileName}`; // Organizar por pasta do usuário
          const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKETS.DOCUMENTS).upload(filePath, selectedFile);
          if (uploadError) throw uploadError;

          const payload = {
            pages,
            isCertified: true,
            isNotarized: tipoTrad === 'Certified',
            isBankStatement: isExtrato,
            filePath,
            userId: userId,
            userEmail: userEmail,
            filename: fileName, // Usar nome único com código aleatório
            originalLanguage: idiomaRaiz,
            targetLanguage: 'English',
            documentType: 'Certificado',
            isMobile: true,
            documentId: currentDocumentId
          };

          await handleDirectPayment('', payload);
        }
      } else {
        // Desktop: Usar IndexedDB
        const fileId = await fileStorage.storeFile(selectedFile, {
          documentType: tipoTrad,
          certification: true,
          notarization: tipoTrad === 'Certified',
          pageCount: pages,
          isBankStatement: isExtrato,
          originalLanguage: idiomaRaiz,
          userId,
          currentFolderId
        });

        await handleDirectPayment(fileId);
      }

    } catch (err: any) {
      console.error('ERROR: Erro ao processar pagamento Stripe:', err);
      setError(err.message || 'Erro ao processar pagamento');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileChange(file);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-y-auto animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Document Translation</h2>
              <p className="text-gray-600 mt-1">Get your documents professionally translated</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2"
              aria-label="Close upload modal"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Upload Form */}
            <div className="lg:col-span-2">
              <div className="bg-gray-50 rounded-xl p-6">
                {/* Instructions Section */}
                <div className="bg-tfe-blue-50 border border-tfe-blue-200 rounded-xl p-4 mb-6">
                  <h3 className="text-lg font-semibold text-tfe-blue-950 mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    How It Works
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-tfe-blue-800">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-8 h-8 bg-tfe-blue-600 text-white rounded-full flex items-center justify-center font-bold mb-2">1</div>
                      <p className="font-medium">Upload Document</p>
                      <p className="text-tfe-blue-700">Select your PDF or image file</p>
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <div className="w-8 h-8 bg-tfe-blue-600 text-white rounded-full flex items-center justify-center font-bold mb-2">2</div>
                      <p className="font-medium">Choose Service</p>
                      <p className="text-tfe-blue-700">Select translation type and language</p>
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <div className="w-8 h-8 bg-tfe-blue-600 text-white rounded-full flex items-center justify-center font-bold mb-2">3</div>
                      <p className="font-medium">Get Translation</p>
                      <p className="text-tfe-blue-700">Receive your translated document</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Upload Area */}
                  <section>
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">1. Select Document</h3>
                    <div
                      className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer flex flex-col items-center justify-center ${dragActive ? 'border-tfe-blue-500 bg-tfe-blue-50' : 'border-gray-300 hover:border-tfe-blue-400'}`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => inputRef.current?.click()}
                      style={{ minHeight: 140 }}
                      aria-label="Upload document area"
                    >
                      <input
                        type="file"
                        ref={inputRef}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleFileChange(file);
                        }}
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        id="file-upload"
                        aria-label="Upload document file input"
                        title="Select a document to upload"
                      />
                      {selectedFile ? (
                        <div className="flex flex-col items-center gap-2">
                          <FileText className="w-10 h-10 text-tfe-blue-500 mb-1" />
                          <span className="text-gray-800 font-medium text-sm">{selectedFile.name}</span>
                          <span className="text-xs text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                          <button
                            className="mt-1 text-xs text-tfe-red-500 hover:underline"
                            onClick={e => { e.stopPropagation(); setSelectedFile(null); }}
                          >Remove file</button>
                          {selectedFile && fileUrl && selectedFile.type.startsWith('image/') && (
                            <img src={fileUrl} alt="Preview" className="max-h-24 rounded shadow mt-2" />
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="w-12 h-12 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-600 font-medium">
                            Click to upload or drag and drop
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            PDF, JPG, PNG up to 10MB
                          </p>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Pages */}
                  <section>
                    <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="num-pages">
                      2. Number of Pages
                    </label>
                    <input
                      id="num-pages"
                      type="number"
                      min="1"
                      max="50"
                      value={pages}
                      onChange={e => setPages(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500 text-base"
                      disabled
                      placeholder="Number of pages"
                      aria-label="Number of pages"
                    />
                  </section>

                  {/* Translation Details */}
                  <section className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="translation-type">
                        3. Translation Type
                      </label>
                      <select
                        id="translation-type"
                        value={tipoTrad}
                        onChange={e => setTipoTrad(e.target.value as 'Certified')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500 text-base"
                        aria-label="Translation type"
                      >
                        {translationTypes.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="is-bank-statement">
                        4. Is it a bank statement? <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="is-bank-statement"
                        value={isExtrato === null ? '' : (isExtrato ? 'yes' : 'no')}
                        onChange={e => setIsExtrato(e.target.value === '' ? null : e.target.value === 'yes')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500 text-base"
                        aria-label="Is it a bank statement"
                        required
                      >
                        <option value="">Select an option...</option>
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="original-language">
                        5. Original Document Language
                      </label>
                      <select
                        id="original-language"
                        value={idiomaRaiz}
                        onChange={e => setIdiomaRaiz(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500 text-base"
                        aria-label="Original document language"
                      >
                        {languages.map(lang => (
                          <option key={lang} value={lang}>{lang}</option>
                        ))}
                      </select>
                    </div>
                  </section>

                  {/* Error/Success Messages */}
                  {error && (
                    <div className="flex items-center bg-tfe-red-50 border border-tfe-red-200 rounded-lg p-3 text-tfe-red-700">
                      <AlertCircle className="w-5 h-5 mr-2" />
                      <span>{error}</span>
                    </div>
                  )}
                  {success && (
                    <div className="flex items-center bg-green-50 border border-green-200 rounded-lg p-3 text-green-700">
                      <CheckCircle className="w-5 h-5 mr-2" />
                      <span>{success}</span>
                    </div>
                  )}

                  {/* Upload Button */}
                  <div className="pt-4">
                    <button
                      onClick={handleUpload}
                      disabled={!selectedFile || isUploading}
                      className="w-full bg-gradient-to-r from-tfe-blue-950 to-tfe-red-950 text-white py-4 rounded-xl font-bold shadow-lg hover:from-blue-800 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg transition-all"
                    >
                      {isUploading ? 'Uploading...' : `Upload & Pay $${value}.00`}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Information Cards */}
            <div className="lg:col-span-1">
              <div className="space-y-6">
                {/* Summary Card */}
                <div className="bg-tfe-blue-50 rounded-xl p-6 border border-tfe-blue-100">
                  <h3 className="text-lg font-semibold text-tfe-blue-950 mb-3 flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Summary
                  </h3>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-base text-gray-700">Translation Cost:</span>
                    <span className="text-2xl font-bold text-tfe-blue-950">${value}.00</span>
                  </div>
                  <p className="text-xs text-tfe-blue-950/80 mb-2">
                    {translationTypes.find(t => t.value === tipoTrad)?.label} {isExtrato ? '$25' : '$20'} per page × {pages} page{pages !== 1 ? 's' : ''}
                  </p>
                  <ul className="text-xs text-tfe-blue-950/70 list-disc pl-4 space-y-1">
                    <li>USCIS accepted translations</li>
                    <li>Official certification & authentication</li>
                    <li>Digital verification system</li>
                    <li>24/7 customer support</li>
                  </ul>
                </div>

                {/* Service Information */}
                <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Info className="w-5 h-5 text-tfe-blue-600" />
                    Service Information
                  </h3>

                  <div className="space-y-4">
                    {/* Translation Types */}
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <Award className="w-4 h-4 text-tfe-blue-600" />
                        Translation Types
                      </h4>
                      <div className="space-y-2">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-medium text-gray-800 text-sm">Certified</span>
                            <span className="text-xs font-bold text-tfe-blue-600">$20/page</span>
                          </div>
                          <p className="text-xs text-gray-600">
                            Official certified translation with complete legal authentication for all purposes including court documents, legal proceedings, immigration, and USCIS applications.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Document Types */}
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-tfe-blue-600" />
                        Document Types
                      </h4>
                      <div className="space-y-2">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-medium text-gray-800 text-sm">Regular Documents</span>
                            <span className="text-xs text-gray-600">Standard rate</span>
                          </div>
                          <p className="text-xs text-gray-600">
                            Birth certificates, marriage certificates, diplomas, transcripts, and other official documents.
                          </p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-medium text-gray-800 text-sm">Bank Statements</span>
                            <span className="text-xs font-bold text-orange-600">+$5/page</span>
                          </div>
                          <p className="text-xs text-gray-600">
                            Additional verification and formatting required for financial documents.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Features */}
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-tfe-blue-600" />
                        Service Features
                      </h4>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          <span className="text-gray-700">USCIS & Government Accepted</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          <span className="text-gray-700">Official Certification</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          <span className="text-gray-700">Digital Verification System</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          <span className="text-gray-700">24-48 Hour Turnaround</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          <span className="text-gray-700">Secure File Handling</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          <span className="text-gray-700">24/7 Customer Support</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Seleção de Método de Pagamento */}
      <PaymentMethodModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSelectStripe={() => {
          setShowPaymentModal(false);
          handleStripePayment();
        }}
        onSelectZelle={() => {
          setShowPaymentModal(false);
          setShowZelleModal(true);
        }}
        amount={calculateValue(pages, isExtrato)}
      />

      {/* Modal de Pagamento Zelle */}
      {currentDocumentId && (
        <ZellePaymentModal
          isOpen={showZelleModal}
          onClose={() => setShowZelleModal(false)}
          amount={calculateValue(pages, isExtrato)}
          documentId={currentDocumentId}
          userId={userId}
          documentDetails={{
            filename: selectedFile?.name || '',
            pages: pages,
            translationType: tipoTrad
          }}
        />
      )}

      <style>{`
        .animate-fade-in { animation: fadeIn 0.2s ease; }
        .animate-slide-up { animation: slideUp 0.3s cubic-bezier(.4,2,.6,1); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}