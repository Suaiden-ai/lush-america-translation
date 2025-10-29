                                              import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Info, Shield, DollarSign, Globe, Award } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { fileStorage } from '../../utils/fileStorage';
import { generateUniqueFileName } from '../../utils/fileUtils';
import { useI18n } from '../../contexts/I18nContext';
import { PaymentMethodModal } from '../../components/PaymentMethodModal';
import { ZellePaymentModal } from '../../components/ZellePaymentModal';
import { useNavigate } from 'react-router-dom';
import { Logger } from '../../lib/loggingHelpers';
import { ActionTypes } from '../../types/actionTypes';

export default function UploadDocument() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pages, setPages] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [tipoTrad, setTipoTrad] = useState<'Certified'>('Certified');
  const [isExtrato, setIsExtrato] = useState(false);
  const [idiomaRaiz, setIdiomaRaiz] = useState('Portuguese');
  const [idiomaDestino, setIdiomaDestino] = useState('English');
  const [sourceCurrency, setSourceCurrency] = useState('USD');
  const [targetCurrency, setTargetCurrency] = useState('BRL');
  
  // Estados para os modais de pagamento
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showZelleModal, setShowZelleModal] = useState(false);
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);
  const [currentFilename, setCurrentFilename] = useState<string | null>(null);
  
  // Estados para rastrear abandono de checkout
  const [checkoutStartTime, setCheckoutStartTime] = useState<Date | null>(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);
  
  // Detecta se é mobile (iOS/Android)
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  // useEffect para capturar abandono por navegação (simplificado)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Se o usuário estava no checkout e está saindo da página, logar abandono
      if (checkoutStartTime && currentDocumentId) {
        const timeSpent = Math.round((new Date().getTime() - checkoutStartTime.getTime()) / 1000);
        
        // Log simples via console para debug
        console.log('🚨 Checkout abandoned by navigation:', {
          document_id: currentDocumentId,
          filename: currentFilename,
          time_spent_seconds: timeSpent,
          checkout_session_id: checkoutSessionId,
          abandonment_reason: 'page_navigation'
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [checkoutStartTime, currentDocumentId, currentFilename, checkoutSessionId]);
  
  // Função para lidar com fechamento do modal de pagamento
  const handlePaymentModalClose = async () => {
    // Se o usuário estava no checkout e fechou sem pagar, logar abandono
    if (checkoutStartTime && currentDocumentId) {
      const timeSpent = Math.round((new Date().getTime() - checkoutStartTime.getTime()) / 1000); // em segundos
      
      try {
        await Logger.log(
          ActionTypes.PAYMENT.CHECKOUT_ABANDONED,
          `User abandoned checkout after ${timeSpent} seconds`,
          {
            entityType: 'checkout',
            entityId: currentDocumentId,
            metadata: {
              document_id: currentDocumentId,
              filename: currentFilename,
              time_spent_seconds: timeSpent,
              checkout_session_id: checkoutSessionId,
              abandonment_reason: 'modal_closed',
              timestamp: new Date().toISOString()
            },
            affectedUserId: user?.id,
            performerType: 'user'
          }
        );
        console.log('✅ Checkout abandoned logged successfully');
      } catch (logError) {
        console.error('Error logging checkout abandoned:', logError);
      }
    }
    
    // Limpar estados
    setCheckoutStartTime(null);
    setCheckoutSessionId(null);
    setShowPaymentModal(false);
  };
  
  const translationTypes = [
    { value: 'Certified', label: 'Certified' },
  ];
  
  const sourceLanguages = [
    'Portuguese',
    'Portuguese (Portugal)',
    'Spanish',
    'English',
    'German',
    'Arabic',
    'Hebrew',
    'Japanese',
    'Korean',
  ];
  
  const targetLanguages = [
    'Portuguese',
    'Spanish',
    'English',
    'German',
    'Arabic',
    'Hebrew',
    'Japanese',
    'Korean',
  ];

  const currencies = [
    'USD',
    'BRL',
    'EUR',
    'GBP',
    'CAD',
    'AUD',
    'JPY',
    'KRW',
    'CNY',
    'INR',
    'MXN',
    'CHF',
  ];
  
  function calcularValor(pages: number, extrato: boolean) {
    return extrato ? pages * 25 : pages * 20; // $20 base + $5 bank statement fee
  }
  const valor = calcularValor(pages, isExtrato);

  // PDF page count
  let pdfjsLib: any = null;
  let pdfjsWorkerSrc: string | undefined = undefined;
  async function loadPdfJs() {
    if (!pdfjsLib) {
      // @ts-ignore
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
    
    console.log('DEBUG: File selected:', {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified
    });
    
    if (file.type === 'application/pdf') {
      try {
        console.log('DEBUG: Attempting to read PDF file...');
        const pdfjsLib = await loadPdfJs();
        console.log('DEBUG: PDF.js library loaded successfully');
        
        const arrayBuffer = await file.arrayBuffer();
        console.log('DEBUG: File converted to ArrayBuffer, size:', arrayBuffer.byteLength);
        
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        console.log('DEBUG: PDF loaded successfully, pages:', pdf.numPages);
        setPages(pdf.numPages);
      } catch (err) {
        console.error('DEBUG: Error reading PDF:', err);
        setError(`Failed to read PDF pages: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setPages(1);
      }
    } else {
      console.log('DEBUG: File is not a PDF, type:', file.type);
      setPages(1);
    }
    
    if (file.type.startsWith('image/')) {
      setFileUrl(URL.createObjectURL(file));
    }
  };

  // Função para processar pagamento direto com Stripe
  const handleDirectPayment = async (fileId: string, customPayload?: any, filename?: string) => {
    try {
      console.log('DEBUG: Iniciando pagamento direto com Stripe');
      
      // Verificar se o arquivo foi selecionado
      if (!selectedFile) {
        throw new Error('Nenhum arquivo selecionado');
      }

      // Verificar se o documentId foi fornecido
      if (!customPayload?.documentId) {
        throw new Error('Document ID não fornecido');
      }

      console.log('DEBUG: Usando documentId fornecido:', customPayload.documentId);
      
      // Usar filename passado como parâmetro ou gerar novo se não fornecido
      const uniqueFileName = filename || generateUniqueFileName(selectedFile.name);
      console.log('DEBUG: Nome único usado no payload:', uniqueFileName);
      console.log('DEBUG: Nome original do arquivo:', selectedFile.name);
      console.log('DEBUG: Filename passado como parâmetro:', filename);
      
      // Criar payload completo igual ao DocumentUploadModal
      const payload = {
        pages,
        isCertified: true, // Always certified now
        isNotarized: tipoTrad === 'Certified',
        isBankStatement: isExtrato,
        fileId: fileId || '', // Usar o ID do arquivo no IndexedDB
        userId: user?.id,
        userEmail: user?.email, // Adicionar email do usuário
        filename: uniqueFileName, // Usar nome único com código aleatório
        originalFilename: selectedFile?.name, // Nome original do arquivo
        originalLanguage: idiomaRaiz,
        targetLanguage: idiomaDestino,
        documentType: 'Certificado', // Enviar "Certificado" no payload
        documentId: customPayload.documentId, // Adicionar o documentId
        sourceCurrency: isExtrato ? sourceCurrency : null,
        targetCurrency: isExtrato ? targetCurrency : null
      };

      console.log('DEBUG: Payload completo criado:', payload);
      console.log('DEBUG: pages:', pages);
      console.log('DEBUG: tipoTrad:', tipoTrad);
      console.log('DEBUG: isExtrato:', isExtrato);
      console.log('DEBUG: fileId:', fileId);
      console.log('DEBUG: userId:', user?.id);
      console.log('DEBUG: userEmail:', user?.email);
      console.log('DEBUG: filename:', uniqueFileName);
      console.log('DEBUG: documentId:', customPayload.documentId);

      console.log('Payload enviado para checkout:', payload);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify(payload)
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

      const { url, sessionId } = await response.json();
      console.log('DEBUG: URL do Stripe Checkout:', url);
      console.log('DEBUG: Session ID:', sessionId);
      
      // Armazenar session ID para rastreamento de abandono
      if (sessionId) {
        setCheckoutSessionId(sessionId);
      }

      // Redirecionar para o Stripe Checkout
      window.location.href = url;

    } catch (err: any) {
      console.error('ERROR: Erro no pagamento:', err);
      setError(err.message || 'Erro ao processar pagamento');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;
    setError(null);
    setSuccess(null);
    setIsUploading(true);
    
    try {
      // CRIAR DOCUMENTO NO BANCO ANTES DO PAGAMENTO
      console.log('DEBUG: Criando documento no banco antes do pagamento');
      
      // Gerar nome único com código aleatório para o filename
      const uniqueFileName = generateUniqueFileName(selectedFile.name);
      console.log('DEBUG: Nome único gerado:', uniqueFileName);
      console.log('DEBUG: Nome original do arquivo:', selectedFile.name);
      
      const { data: newDocument, error: createError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          filename: uniqueFileName, // Usar nome com código aleatório
          original_filename: selectedFile.name, // Salvar nome original
          pages: pages,
          status: 'draft', // Começa como draft até o pagamento ser confirmado
          total_cost: calcularValor(pages, isExtrato),
          verification_code: 'TFE' + Math.random().toString(36).substr(2, 6).toUpperCase(),
          is_authenticated: true,
          upload_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          tipo_trad: tipoTrad,
          idioma_raiz: idiomaRaiz,
          idioma_destino: idiomaDestino,
          is_bank_statement: isExtrato,
          source_currency: isExtrato ? sourceCurrency : null,
          target_currency: isExtrato ? targetCurrency : null
        })
        .select()
        .single();

      if (createError) {
        console.error('ERROR: Erro ao criar documento no banco:', createError);
        throw new Error('Erro ao criar documento no banco de dados');
      }

      console.log('DEBUG: Documento criado no banco:', newDocument.id);
      console.log('DEBUG: Verificação dos campos salvos:', {
        filename: newDocument.filename,
        original_filename: newDocument.original_filename
      });
      
      // Armazenar o ID do documento e filename para usar nos modais de pagamento
      setCurrentDocumentId(newDocument.id);
      setCurrentFilename(uniqueFileName);
      
      // Log de entrada no checkout
      try {
        await Logger.log(
          ActionTypes.PAYMENT.CHECKOUT_STARTED,
          `User entered checkout for document: ${uniqueFileName}`,
          {
            entityType: 'checkout',
            entityId: newDocument.id,
            metadata: {
              document_id: newDocument.id,
              filename: uniqueFileName,
              pages: pages,
              translation_type: tipoTrad,
              is_bank_statement: isExtrato,
              source_language: idiomaRaiz,
              target_language: idiomaDestino,
              source_currency: sourceCurrency,
              target_currency: targetCurrency,
              file_size: selectedFile.size,
              file_type: selectedFile.type,
              timestamp: new Date().toISOString()
            },
            affectedUserId: user?.id,
            performerType: 'user'
          }
        );
        console.log('✅ Checkout started logged successfully');
      } catch (logError) {
        console.error('Error logging checkout started:', logError);
      }
      
      // Registrar tempo de início do checkout
      setCheckoutStartTime(new Date());
      
      // Mostrar modal de seleção de método de pagamento
      setShowPaymentModal(true);

    } catch (err: any) {
      console.error('ERROR: Erro ao preparar documento:', err);
      setError(err.message || 'Erro ao preparar documento');
    } finally {
      setIsUploading(false);
    }
  };

  // Função para redirecionar para checkout Zelle COM UPLOAD
  const handleZelleRedirect = async (amount: number) => {
    if (!selectedFile || !user || !currentDocumentId) return;
    
    try {
      setIsUploading(true);
      setError(null);
      
      console.log('🚀 Uploading document for Zelle payment...');
      
      // Fazer upload do arquivo para o Storage
      const fileName = generateUniqueFileName(selectedFile.name);
      const filePath = `${user.id}/${fileName}`; // Organizar por pasta do usuário
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, selectedFile);

      if (uploadError) {
        console.error('❌ Storage upload error:', uploadError);
        throw new Error('Falha ao fazer upload do documento');
      }

      // Obter URL público
          const { data: { publicUrl } } = supabase.storage
            .from('documents')
            .getPublicUrl(filePath);

      console.log('✅ Document uploaded successfully:', publicUrl);

      // Atualizar o documento no banco com file_url e filename correto
      const { error: updateError } = await supabase
        .from('documents')
        .update({ 
          file_url: publicUrl,
          filename: fileName // Atualizar com o nome único gerado
          // original_filename já foi salvo no handleUpload, não precisa atualizar
        })
        .eq('id', currentDocumentId);

      if (updateError) {
        console.error('❌ Database update error:', updateError);
        throw new Error('Falha ao atualizar documento no banco');
      }

      console.log('✅ Document updated in database with file_url');

      // Agora redirecionar para Zelle checkout
      const params = new URLSearchParams({
        document_id: currentDocumentId,
        amount: amount.toString(),
        filename: selectedFile.name,
        pages: pages?.toString() || '1'
      });
      
      navigate(`/zelle-checkout?${params.toString()}`);
      
    } catch (err: any) {
      console.error('❌ Error preparing Zelle payment:', err);
      setError(err.message || 'Erro ao preparar pagamento Zelle');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDirectStripePayment = async () => {
    
    try {
      setIsUploading(true);
      setError(null);
      
      if (isMobile) {
        // Mobile: Tentar usar IndexedDB primeiro, se falhar usar upload direto
        if (!selectedFile || !user) {
          throw new Error('Arquivo ou usuário não encontrado');
        }
        try {
          const fileId = await fileStorage.storeFile(selectedFile, {
            documentType: 'Certificado',
            certification: true,
            notarization: tipoTrad === 'Certified',
            pageCount: pages,
            isBankStatement: isExtrato,
            originalLanguage: idiomaRaiz,
            targetLanguage: idiomaDestino,
            userId: user.id,
            sourceCurrency: isExtrato ? sourceCurrency : null,
            targetCurrency: isExtrato ? targetCurrency : null
          });
          
          if (!selectedFile || !user) {
            throw new Error('Arquivo ou usuário não encontrado');
          }
          await handleDirectPayment(fileId, { documentId: currentDocumentId }, currentFilename || undefined);
        } catch (indexedDBError) {
          // Fallback: Upload direto para Supabase Storage
          if (!selectedFile || !user) {
            throw new Error('Arquivo ou usuário não encontrado');
          }
          const fileName = generateUniqueFileName(selectedFile.name);
          const filePath = `${user.id}/${fileName}`; // Organizar por pasta do usuário
          const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, selectedFile);
          if (uploadError) throw uploadError;
          
          const payload = {
            pages,
            isCertified: true,
            isNotarized: tipoTrad === 'Certified',
            isBankStatement: isExtrato,
            filePath,
            userId: user?.id,
            userEmail: user?.email,
            filename: selectedFile.name,
            originalLanguage: idiomaRaiz,
            targetLanguage: idiomaDestino,
            documentType: 'Certificado',
            isMobile: true,
            documentId: currentDocumentId,
            sourceCurrency: isExtrato ? sourceCurrency : null,
            targetCurrency: isExtrato ? targetCurrency : null
          };
          
          if (!selectedFile || !user) {
            throw new Error('Arquivo ou usuário não encontrado');
          }
          await handleDirectPayment('', payload);
        }
      } else {
        // Desktop: Salvar arquivo no IndexedDB primeiro
        if (!selectedFile || !user) {
          throw new Error('Arquivo ou usuário não encontrado');
        }
        const fileId = await fileStorage.storeFile(selectedFile, {
          documentType: 'Certificado',
          certification: true,
          notarization: tipoTrad === 'Certified',
          pageCount: pages,
          isBankStatement: isExtrato,
          originalLanguage: idiomaRaiz,
          targetLanguage: idiomaDestino,
          userId: user.id,
          sourceCurrency: isExtrato ? sourceCurrency : null,
          targetCurrency: isExtrato ? targetCurrency : null
        });
        
        await handleDirectPayment(fileId, { documentId: currentDocumentId }, currentFilename || undefined);
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
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-2">{t('upload.pageTitle')}</h1>
          <p className="text-gray-600 text-lg">{t('upload.pageDescription')}</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Upload Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              {/* Instructions Section */}
              <div className="bg-tfe-blue-50 border border-tfe-blue-200 rounded-xl p-6 mb-8">
                <h2 className="text-2xl font-bold text-tfe-blue-950 mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  {t('upload.howItWorksTitle')}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-tfe-blue-800">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-8 h-8 bg-tfe-blue-600 text-white rounded-full flex items-center justify-center font-bold mb-2">1</div>
                    <p className="font-medium">{t('upload.steps.upload.title')}</p>
                    <p className="text-tfe-blue-700">{t('upload.steps.upload.description')}</p>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <div className="w-8 h-8 bg-tfe-blue-600 text-white rounded-full flex items-center justify-center font-bold mb-2">2</div>
                    <p className="font-medium">{t('upload.steps.choose.title')}</p>
                    <p className="text-tfe-blue-700">{t('upload.steps.choose.description')}</p>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <div className="w-8 h-8 bg-tfe-blue-600 text-white rounded-full flex items-center justify-center font-bold mb-2">3</div>
                    <p className="font-medium">{t('upload.steps.receive.title')}</p>
                    <p className="text-tfe-blue-700">{t('upload.steps.receive.description')}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Upload Area */}
                <section>
                  <h2 className="text-2xl font-bold text-gray-800 mb-3">{t('upload.form.selectDocument')}</h2>
                  <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer flex flex-col items-center justify-center ${dragActive ? 'border-tfe-blue-500 bg-tfe-blue-50' : 'border-gray-300 hover:border-tfe-blue-400'}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                    style={{ minHeight: 160 }}
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
                        <span className="text-gray-800 font-medium text-base">{selectedFile.name}</span>
                        <span className="text-xs text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                        <button
                          className="mt-1 text-xs text-tfe-red-500 hover:underline"
                          onClick={e => { e.stopPropagation(); setSelectedFile(null); }}
                        >{t('upload.form.uploadArea.removeFile')}</button>
                        {selectedFile && fileUrl && selectedFile.type.startsWith('image/') && (
                          <img src={fileUrl} alt="Preview" className="max-h-32 rounded shadow mt-2" />
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-12 h-12 text-gray-400 mb-2" />
                        <p className="text-base text-gray-600 font-medium">
                          {t('upload.form.uploadArea.clickToUpload')}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {t('upload.form.uploadArea.supportedFormats')}
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Pages */}
                <section>
                  <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="num-pages">
                    {t('upload.form.numberOfPages')}
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
                    placeholder={t('upload.form.numberOfPages')}
                    aria-label={t('upload.form.numberOfPages')}
                  />
                </section>

                {/* Translation Details */}
                <section className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="translation-type">
                      {t('upload.form.translationType')}
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
                      {t('upload.form.isBankStatement')}
                    </label>
                    <select
                      id="is-bank-statement"
                      value={isExtrato ? 'yes' : 'no'}
                      onChange={e => setIsExtrato(e.target.value === 'yes')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500 text-base"
                      aria-label="Is it a bank statement"
                    >
                      <option value="no">{t('upload.form.selectOptions.no')}</option>
                      <option value="yes">{t('upload.form.selectOptions.yes')}</option>
                    </select>
                  </div>

                  {/* Currency Fields - Only show when isExtrato is true */}
                  {isExtrato && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="source-currency">
                          4.1. Source Currency (Original Document)
                        </label>
                        <select
                          id="source-currency"
                          value={sourceCurrency}
                          onChange={e => setSourceCurrency(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500 text-base"
                          aria-label="Source currency"
                        >
                          {currencies.map(currency => (
                            <option key={currency} value={currency}>{currency}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="target-currency">
                          4.2. Target Currency (Translation To)
                        </label>
                        <select
                          id="target-currency"
                          value={targetCurrency}
                          onChange={e => setTargetCurrency(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500 text-base"
                          aria-label="Target currency"
                        >
                          {currencies.map(currency => (
                            <option key={currency} value={currency}>{currency}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="original-language">
                      {t('upload.form.originalLanguage')}
                    </label>
                    <select
                      id="original-language"
                      value={idiomaRaiz}
                      onChange={e => setIdiomaRaiz(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500 text-base"
                      aria-label="Original document language"
                    >
                      {sourceLanguages.map(lang => (
                        <option key={lang} value={lang}>{lang}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="target-language">
                      {t('upload.form.targetLanguage')}
                    </label>
                    <select
                      id="target-language"
                      value={idiomaDestino}
                      onChange={e => setIdiomaDestino(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500 text-base"
                      aria-label="Target language for translation"
                    >
                      {targetLanguages.map(lang => (
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
                    {isUploading ? t('common.loading') : `${t('upload.summary.processPayment')} $${valor}.00`}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Information Card */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 space-y-6">
              {/* Summary Card */}
              <div className="bg-tfe-blue-50 rounded-2xl p-6 border border-tfe-blue-100">
                <h3 className="text-2xl font-bold text-tfe-blue-950 mb-3 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  {t('upload.summary.title')}
                </h3>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-base text-gray-700">{t('upload.summary.pricing.title')}:</span>
                  <span className="text-2xl font-bold text-tfe-blue-950">${valor}.00</span>
                </div>
                <p className="text-xs text-tfe-blue-950/80 mb-2">
                  {translationTypes.find(t => t.value === tipoTrad)?.label} {isExtrato ? '$25' : '$20'} {t('upload.summary.pricing.perPage')} × {pages} {pages !== 1 ? t('upload.summary.pages') : t('upload.summary.page')}
                </p>
                <div className="mb-3 p-2 bg-tfe-blue-100 rounded-lg">
                  <p className="text-xs text-tfe-blue-950/80 font-medium flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    {idiomaRaiz} → {idiomaDestino}
                  </p>
                </div>
                <ul className="text-xs text-tfe-blue-950/70 list-disc pl-4 space-y-1">
                  <li>USCIS accepted translations</li>
                  <li>Official certification & authentication</li>
                  <li>Digital verification system</li>
                  <li>24/7 customer support</li>
                </ul>
              </div>

              {/* Information Card */}
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Info className="w-5 h-5 text-tfe-blue-600" />
                  {t('upload.serviceInfo.title')}
                </h3>
                
                <div className="space-y-6">
                  {/* Translation Types */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Award className="w-4 h-4 text-tfe-blue-600" />
                      {t('upload.serviceInfo.translationTypes.title')}
                    </h4>
                    <div className="space-y-3">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-gray-800">{t('upload.serviceInfo.translationTypes.certified.title')}</span>
                          <span className="text-sm font-bold text-tfe-blue-600">{t('upload.serviceInfo.translationTypes.certified.price')}</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {t('upload.serviceInfo.translationTypes.certified.description')}
                        </p>
                        <ul className="text-xs text-gray-500 space-y-1">
                          <li>• {t('upload.serviceInfo.translationTypes.certified.features.0', 'Official certification stamp')}</li>
                          <li>• {t('upload.serviceInfo.translationTypes.certified.features.1', 'Notary public certification')}</li>
                          <li>• {t('upload.serviceInfo.translationTypes.certified.features.2', 'USCIS accepted')}</li>
                          <li>• {t('upload.serviceInfo.translationTypes.certified.features.3', 'Digital verification code')}</li>
                          <li>• {t('upload.serviceInfo.translationTypes.certified.features.4', 'Legal document authentication')}</li>
                          <li>• {t('upload.serviceInfo.translationTypes.certified.features.5', 'Court-accepted format')}</li>
                          <li>• {t('upload.serviceInfo.translationTypes.certified.features.6', 'Enhanced verification')}</li>
                          <li>• {t('upload.serviceInfo.translationTypes.certified.features.7', '24-48 hour turnaround')}</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Document Types */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-tfe-blue-600" />
                      {t('upload.serviceInfo.documentTypes.title')}
                    </h4>
                    <div className="space-y-3">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-gray-800">{t('upload.serviceInfo.documentTypes.regular.title')}</span>
                          <span className="text-sm text-gray-600">{t('upload.serviceInfo.documentTypes.regular.price')}</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {t('upload.serviceInfo.documentTypes.regular.description')}
                        </p>
                      </div>
                      
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-gray-800">{t('upload.serviceInfo.documentTypes.bankStatements.title')}</span>
                          <span className="text-sm font-bold text-orange-600">{t('upload.serviceInfo.documentTypes.bankStatements.price')}</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {t('upload.serviceInfo.documentTypes.bankStatements.description')}
                        </p>
                        <ul className="text-xs text-gray-500 space-y-1">
                          <li>• {t('upload.serviceInfo.documentTypes.bankStatements.features.0', 'Enhanced verification process')}</li>
                          <li>• {t('upload.serviceInfo.documentTypes.bankStatements.features.1', 'Financial document formatting')}</li>
                          <li>• {t('upload.serviceInfo.documentTypes.bankStatements.features.2', 'Additional security measures')}</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Languages */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Globe className="w-4 h-4 text-tfe-blue-600" />
                      {t('upload.serviceInfo.supportedLanguages.title')}
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {sourceLanguages.map(lang => (
                        <div key={lang} className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          <span className="text-gray-700">{lang}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {t('upload.serviceInfo.supportedLanguages.note')}
                    </p>
                  </div>

                  {/* Features */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-tfe-blue-600" />
                      {t('upload.serviceInfo.serviceFeatures.title')}
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-gray-700">{t('upload.serviceInfo.serviceFeatures.features.0', 'USCIS & Government Accepted')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-gray-700">{t('upload.serviceInfo.serviceFeatures.features.1', 'Official Certification')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-gray-700">{t('upload.serviceInfo.serviceFeatures.features.2', 'Digital Verification System')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-gray-700">{t('upload.serviceInfo.serviceFeatures.features.3', '24-48 Hour Turnaround')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-gray-700">{t('upload.serviceInfo.serviceFeatures.features.4', 'Secure File Handling')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-gray-700">{t('upload.serviceInfo.serviceFeatures.features.5', '24/7 Customer Support')}</span>
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
        onClose={handlePaymentModalClose}
        onSelectStripe={() => {
          setShowPaymentModal(false);
          handleDirectStripePayment();
        }}
        onSelectZelle={async () => {
          setShowPaymentModal(false);
          
          // Log da seleção do método Zelle
          await Logger.log(
            ActionTypes.PAYMENT.ZELLE_SELECTED,
            `User selected Zelle payment method`,
            {
              entityType: 'payment',
              entityId: currentDocumentId,
              metadata: {
                amount: calcularValor(pages, isExtrato),
                document_id: currentDocumentId,
                filename: selectedFile?.name,
                pages: pages,
                timestamp: new Date().toISOString()
              },
              affectedUserId: user?.id,
              performerType: 'user'
            }
          );
          
          handleZelleRedirect(calcularValor(pages, isExtrato));
        }}
        amount={calcularValor(pages, isExtrato)}
      />

      {/* Modal de Pagamento Zelle */}
      {currentDocumentId && (
        <ZellePaymentModal
          isOpen={showZelleModal}
          onClose={() => setShowZelleModal(false)}
          amount={calcularValor(pages, isExtrato)}
          documentId={currentDocumentId}
          userId={user?.id || ''}
          documentDetails={{
            filename: selectedFile?.name || '',
            pages: pages,
            translationType: tipoTrad
          }}
        />
      )}
    </div>
  );
} 