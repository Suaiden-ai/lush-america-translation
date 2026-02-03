import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Info, Shield, Globe, Award, Receipt } from 'lucide-react';
import { supabase, STORAGE_BUCKETS } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { generateUniqueFileName } from '../../utils/fileUtils';

export default function AuthenticatorUpload() {
  const { user } = useAuth();
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
  const [clientName, setClientName] = useState('');
  const [uploadType, setUploadType] = useState<'client' | 'personal'>('client');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptFileUrl, setReceiptFileUrl] = useState<string | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  // Estados para moedas do bank statement
  const [sourceCurrency, setSourceCurrency] = useState('USD');
  const [targetCurrency, setTargetCurrency] = useState('USD');

  // Detecta se é mobile (iOS/Android)
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

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
    'CHF',
    'CNY',
    'MXN',
    'ARS',
    'CLP',
    'COP',
  ];

  const paymentMethods = [
    { value: 'card', label: 'Credit/Debit Card' },
    { value: 'cash', label: 'Cash' },
    { value: 'transfer', label: 'Bank Transfer' },
    { value: 'zelle', label: 'Zelle' },
    { value: 'stripe', label: 'Stripe' },
    { value: 'other', label: 'Other' },
  ];

  function calcularValor(pages: number) {
    return pages * 20;
  }
  const valor = calcularValor(pages);

  // Função helper para calcular a numeração dinâmica dos campos
  const getFieldNumber = (baseNumber: number): number | null => {
    // Campos sempre visíveis: 1, 2, 3
    if (baseNumber <= 3) return baseNumber;

    // Campo 4 (Client Name) - só aparece se for client
    if (baseNumber === 4) {
      return uploadType === 'client' ? 4 : null;
    }

    // Campo 5 (Translation Type) - sempre visível
    if (baseNumber === 5) {
      return uploadType === 'client' ? 5 : 4; // Se não for client, vira 4
    }

    // Campo 6 (Bank Statement) - sempre visível
    if (baseNumber === 6) {
      return uploadType === 'client' ? 6 : 5; // Se não for client, vira 5
    }

    // Campo 7 (Original Language) - sempre visível
    if (baseNumber === 7) {
      return uploadType === 'client' ? 7 : 6; // Se não for client, vira 6
    }

    // Campo 8 (Target Language) - sempre visível
    if (baseNumber === 8) {
      return uploadType === 'client' ? 8 : 7; // Se não for client, vira 7
    }

    // Campo 9 (Payment Method) - só aparece se for client
    if (baseNumber === 9) {
      return uploadType === 'client' ? 9 : null;
    }

    // Campo 10 (Receipt) - só aparece se for client
    if (baseNumber === 10) {
      return uploadType === 'client' ? 10 : null;
    }

    return baseNumber;
  };

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
    console.log('DEBUG: handleFileChange called with file:', file);
    setSelectedFile(file);
    setError(null);
    setSuccess(null);

    // Reset upload state
    setIsUploading(false);

    // Validate file type
    if (!file.type.includes('pdf')) {
      setError('Please select a PDF file.');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB.');
      return;
    }

    try {
      // Load PDF.js for page counting
      if (!pdfjsLib) {
        await loadPdfJs();
      }

      // Count pages
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pageCount = pdf.numPages;
      setPages(pageCount);

      console.log('DEBUG: PDF loaded, pages:', pageCount);

      // Generate preview URL
      const url = URL.createObjectURL(file);
      setFileUrl(url);

    } catch (error) {
      console.error('Error processing PDF:', error);
      setError('Error processing PDF file. Please try again.');
    }
  };

  const handleReceiptFileChange = (file: File) => {
    setReceiptFile(file);
    setError(null);

    // Validate file type
    if (!file.type.includes('pdf') && !file.type.includes('image/')) {
      setError('Receipt file must be PDF or image (JPG, PNG).');
      return;
    }

    // Validate file size (max 5MB for receipt)
    if (file.size > 5 * 1024 * 1024) {
      setError('Receipt file size must be less than 5MB.');
      return;
    }

    // Generate preview URL
    const url = URL.createObjectURL(file);
    setReceiptFileUrl(url);
  };

  // Função para processar upload direto (SEM PAGAMENTO para autenticador)
  const handleDirectUpload = async (fileId: string, customPayload?: any) => {
    try {
      console.log('DEBUG: === HANDLE DIRECT UPLOAD START ===');
      console.log('DEBUG: Timestamp:', new Date().toISOString());
      console.log('DEBUG: Autenticador - Upload direto sem pagamento');
      console.log('DEBUG: File ID recebido:', fileId);
      console.log('DEBUG: Custom payload:', customPayload);

      if (!selectedFile) {
        throw new Error('No file selected');
      }

      if (!clientName.trim()) {
        if (uploadType === 'client') {
          throw new Error('Client name is required');
        }
      }

      const metadata = {
        documentType: tipoTrad,
        certification: false,
        notarization: tipoTrad === 'Certified',
        pageCount: pages,
        isBankStatement: isExtrato,
        originalLanguage: idiomaRaiz,
        targetLanguage: idiomaDestino,
        userId: user?.id,
        clientName: uploadType === 'client' ? clientName.trim() : null,
        paymentMethod: paymentMethod,
        ...(isExtrato && {
          sourceCurrency: sourceCurrency,
          targetCurrency: targetCurrency
        })
      };

      console.log('DEBUG: Salvando arquivo no IndexedDB com metadata:', metadata);

      // Gerar nome único com código aleatório para o filename
      const uniqueFileName = generateUniqueFileName(selectedFile.name);
      console.log('DEBUG: Nome único gerado:', uniqueFileName);
      console.log('DEBUG: Nome original do arquivo:', selectedFile.name);

      // Usar payload customizado se fornecido (que já tem originalLanguage e targetLanguage corretos)
      const payload = customPayload || {
        pages,
        isCertified: false,
        isNotarized: tipoTrad === 'Certified',
        isBankStatement: isExtrato,
        filePath: fileId,
        userId: user?.id,
        userEmail: user?.email,
        filename: uniqueFileName, // Usar nome único com código aleatório
        ...(uploadType === 'client' && {
          clientName: clientName.trim(),
          paymentMethod: paymentMethod,
        }),
        originalLanguage: idiomaRaiz,
        targetLanguage: idiomaDestino,
        documentType: 'Certificado',
        ...(isExtrato && {
          sourceCurrency: sourceCurrency,
          targetCurrency: targetCurrency
        })
      };
      console.log('Payload final a ser enviado para webhook:', payload);

      // Verificar se o documento já existe na tabela documents
      console.log('DEBUG: Verificando se documento já existe na tabela documents...');
      const { data: existingDocs, error: checkError } = await supabase
        .from('documents')
        .select('id, filename, user_id, created_at')
        .eq('user_id', user?.id)
        .eq('filename', uniqueFileName)
        .order('created_at', { ascending: false });

      let newDocument;
      if (existingDocs && existingDocs.length > 0 && !checkError) {
        console.log('DEBUG: Documento já existe na tabela documents:', existingDocs.length, 'entradas encontradas');
        existingDocs.forEach((doc, index) => {
          console.log(`DEBUG: Documento ${index + 1}:`, doc.id, doc.created_at);
        });
        newDocument = existingDocs[0]; // Usar o mais recente
        console.log('DEBUG: Usando documento existente:', newDocument.id);
      } else {
        // Criar documento na tabela documents primeiro (para que a edge function possa puxar client_name)
        console.log('DEBUG: Criando documento na tabela documents...');
        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(payload.filePath);

        const { data: createdDoc, error: createError } = await supabase
          .from('documents')
          .insert({
            user_id: user?.id,
            filename: uniqueFileName, // Usar nome único com código aleatório
            pages: pages,
            status: 'pending',
            total_cost: valor,
            tipo_trad: tipoTrad,
            valor: valor,
            idioma_raiz: idiomaRaiz,
            // idioma_destino: idiomaDestino, // Temporariamente comentado até criar a coluna no banco
            is_bank_statement: isExtrato,
            file_url: publicUrl,
            verification_code: `AUTH${Math.random().toString(36).substr(2, 7).toUpperCase()}`,
            ...(uploadType === 'client' && {
              client_name: clientName.trim(),
              payment_method: paymentMethod,
              receipt_url: customPayload?.receiptPath ? supabase.storage.from(STORAGE_BUCKETS.DOCUMENTS).getPublicUrl(customPayload.receiptPath).data.publicUrl : null,
            }),
            is_internal_use: uploadType === 'personal',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...(isExtrato && {
              source_currency: sourceCurrency,
              target_currency: targetCurrency
            })
          })
          .select()
          .single();

        if (createError) {
          console.error('ERROR: Erro ao criar documento na tabela documents:', createError);
          throw new Error('Error saving document to database');
        }

        console.log('DEBUG: Documento criado na tabela documents:', createdDoc);
        newDocument = createdDoc;
      }

      // Preparar dados para o webhook
      const webhookData = {
        filename: uniqueFileName, // Usar nome único com código aleatório
        url: payload.filePath, // Sempre o caminho completo
        user_id: user?.id,
        paginas: pages,
        valor: valor,
        is_bank_statement: isExtrato,
        ...(uploadType === 'client' && {
          client_name: clientName.trim(),
          payment_method: paymentMethod,
        }),
        idioma_raiz: idiomaRaiz,
        idioma_destino: idiomaDestino,
        tipo_trad: tipoTrad,
        mimetype: selectedFile?.type,
        size: selectedFile?.size,
        ...(isExtrato && {
          source_currency: sourceCurrency,
          target_currency: targetCurrency
        })
      };

      console.log('DEBUG: Dados enviados para webhook:', webhookData);

      // Enviar direto para o webhook de tradução (SEM Stripe)
      console.log('DEBUG: === ENVIANDO PARA WEBHOOK ===');
      console.log('DEBUG: Timestamp:', new Date().toISOString());

      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-translation-webhook`;
      console.log('DEBUG: Webhook URL:', webhookUrl);
      console.log('DEBUG: Webhook data:', JSON.stringify(webhookData, null, 2));

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(webhookData)
      });

      console.log('DEBUG: Resposta do webhook status:', response.status);
      console.log('DEBUG: Resposta do webhook headers:', Object.fromEntries(response.headers.entries()));

      const responseText = await response.text();
      console.log('DEBUG: Resposta do webhook body:', responseText);

      if (!response.ok) {
        let errorData = null;
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          errorData = { error: 'Response is not JSON', raw: responseText };
        }
        console.error('Erro detalhado do webhook:', errorData);
        throw new Error(errorData.error || 'Error sending document for translation');
      }

      console.log('DEBUG: === HANDLE DIRECT UPLOAD SUCCESS ===');
      console.log('DEBUG: Timestamp:', new Date().toISOString());
      setSuccess('Document uploaded successfully and sent for translation!');

    } catch (err: any) {
      console.error('ERROR: === HANDLE DIRECT UPLOAD ERROR ===');
      console.error('ERROR: Timestamp:', new Date().toISOString());
      console.error('ERROR: Erro no upload:', err);
      setError(err.message || 'Error processing upload');
    }
  };

  const handleUpload = async () => {
    console.log('DEBUG: === HANDLE UPLOAD START ===');
    console.log('DEBUG: Timestamp:', new Date().toISOString());
    console.log('DEBUG: handleUpload called - USER CLICKED UPLOAD BUTTON');
    console.log('DEBUG: selectedFile:', selectedFile);
    console.log('DEBUG: user:', user);
    console.log('DEBUG: clientName:', clientName);
    console.log('DEBUG: pages:', pages);
    console.log('DEBUG: tipoTrad:', tipoTrad);
    console.log('DEBUG: isExtrato:', isExtrato);
    console.log('DEBUG: idiomaRaiz:', idiomaRaiz);
    console.log('DEBUG: idiomaDestino:', idiomaDestino);
    console.log('DEBUG: isUploading:', isUploading);

    // Proteção contra chamadas duplicadas
    if (isUploading) {
      console.log('DEBUG: Upload já em andamento, ignorando chamada duplicada');
      return;
    }

    if (!selectedFile || !user) {
      console.log('DEBUG: Upload bloqueado - validação básica falhou');
      console.log('DEBUG: selectedFile exists:', !!selectedFile);
      console.log('DEBUG: user exists:', !!user);
      return;
    }

    if (uploadType === 'client' && !clientName.trim()) {
      console.log('DEBUG: Upload bloqueado - Client Name é obrigatório para uploads de cliente');
      setError('Client name is required when uploading for a client. Please enter the client\'s full name.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsUploading(true);

    try {
      console.log('DEBUG: === INICIANDO UPLOAD E ENVIO PARA WEBHOOK ===');
      console.log('DEBUG: Usuário clicou no botão - fazendo upload agora');

      // Upload direto para Supabase Storage
      console.log('DEBUG: Fazendo upload para Supabase Storage');
      const fileName = generateUniqueFileName(selectedFile.name);
      const filePath = `${user?.id}/${fileName}`; // Organizar por pasta do usuário
      console.log('DEBUG: Tentando upload para Supabase Storage:', filePath);

      const { data, error: uploadError } = await supabase.storage.from(STORAGE_BUCKETS.DOCUMENTS).upload(filePath, selectedFile);

      // Upload do comprovante de pagamento se existir e for para cliente
      let receiptPath = null;
      if (uploadType === 'client' && receiptFile) {
        try {
          const receiptFilePath = generateUniqueFileName(`receipt_${receiptFile.name}`);
          const { data: receiptData, error: receiptError } = await supabase.storage
            .from('documents')
            .upload(receiptFilePath, receiptFile);

          if (receiptError) {
            console.error('DEBUG: Erro no upload do comprovante:', receiptError);
            throw receiptError;
          }

          console.log('DEBUG: Upload do comprovante bem-sucedido:', receiptData);
          receiptPath = receiptFilePath;
        } catch (err) {
          console.error('DEBUG: Erro ao fazer upload do comprovante:', err);
          // Não bloqueia o upload do documento principal se o comprovante falhar
        }
      }
      if (uploadError) {
        console.error('DEBUG: Erro no upload para Supabase Storage:', uploadError);
        throw uploadError;
      }

      console.log('DEBUG: Upload para Supabase Storage bem-sucedido:', data);

      // Debug dos valores antes de criar o payload
      console.log('DEBUG: Valores no momento do payload:');
      console.log('DEBUG: idiomaRaiz:', idiomaRaiz);
      console.log('DEBUG: idiomaDestino:', idiomaDestino);
      console.log('DEBUG: tipoTrad:', tipoTrad);
      console.log('DEBUG: isExtrato:', isExtrato);

      // Gerar nome único com código aleatório para o filename
      const uniqueFileName = generateUniqueFileName(selectedFile.name);
      console.log('DEBUG: Nome único gerado:', uniqueFileName);
      console.log('DEBUG: Nome original do arquivo:', selectedFile.name);

      // Payload para webhook
      const payload = {
        pages,
        isCertified: false,
        isNotarized: tipoTrad === 'Certified',
        isBankStatement: isExtrato,
        filePath: filePath,
        userId: user.id,
        userEmail: user.email,
        filename: uniqueFileName, // Usar nome único com código aleatório
        ...(uploadType === 'client' && {
          clientName: clientName.trim(),
          paymentMethod: paymentMethod,
          receiptPath: receiptPath,
        }),
        originalLanguage: idiomaRaiz,
        targetLanguage: idiomaDestino,
        documentType: 'Certificado',
        isMobile: isMobile,
        ...(isExtrato && {
          sourceCurrency: sourceCurrency,
          targetCurrency: targetCurrency
        })
      };
      console.log('DEBUG: Payload enviado:', payload);
      console.log('DEBUG: Payload.originalLanguage:', payload.originalLanguage);
      console.log('DEBUG: Payload.targetLanguage:', payload.targetLanguage);

      // Chama o upload direto com payload
      await handleDirectUpload(filePath, payload);

    } catch (err: any) {
      console.error('ERROR: === HANDLE UPLOAD ERROR ===');
      console.error('ERROR: Timestamp:', new Date().toISOString());
      console.error('ERROR: Erro no upload:', err);
      setError(err.message || 'Error processing upload');
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
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-2">Document Translation</h1>
          <p className="text-gray-600 text-lg">Upload documents for professional translation - Free access for authenticators.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Upload Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              {/* Instructions Section */}
              <div className="bg-tfe-blue-50 border border-tfe-blue-200 rounded-xl p-6 mb-8">
                <h2 className="text-2xl font-bold text-tfe-blue-950 mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  How It Works
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-tfe-blue-800">
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
                  <h2 className="text-2xl font-bold text-gray-800 mb-3">1. Select Document</h2>
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
                        >Remove file</button>
                        {selectedFile && fileUrl && selectedFile.type.startsWith('image/') && (
                          <img src={fileUrl} alt="Preview" className="max-h-32 rounded shadow mt-2" />
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-12 h-12 text-gray-400 mb-2" />
                        <p className="text-base text-gray-600 font-medium">
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

                {/* Upload Type */}
                <section>
                  <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="upload-type">
                    3. Upload Type
                  </label>
                  <select
                    id="upload-type"
                    value={uploadType}
                    onChange={e => {
                      const newType = e.target.value as 'client' | 'personal';
                      setUploadType(newType);
                      // Limpar campos quando mudar para personal use
                      if (newType === 'personal') {
                        setClientName('');
                        setPaymentMethod('card');
                        setReceiptFile(null);
                        setReceiptFileUrl(null);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500 text-base"
                    aria-label="Upload type"
                  >
                    <option value="client">For Client</option>
                    <option value="personal">Personal Use</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {uploadType === 'client'
                      ? 'This document is for a client who paid for translation services.'
                      : 'This document is for your personal use and will not be counted in statistics.'}
                  </p>
                </section>

                {/* Client Name - Only show for client uploads */}
                {uploadType === 'client' && (
                  <section>
                    <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="client-name">
                      {getFieldNumber(4) !== null && `${getFieldNumber(4)}. `}Client Name
                    </label>
                    <input
                      id="client-name"
                      type="text"
                      value={clientName}
                      onChange={e => setClientName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500 text-base"
                      placeholder="Enter client's full name"
                      aria-label="Client name"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter the full name of the client for whom this document is being translated.
                    </p>
                  </section>
                )}

                {/* Translation Details */}
                <section className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="translation-type">
                      {getFieldNumber(5) !== null && `${getFieldNumber(5)}. `}Translation Type
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
                      {getFieldNumber(6) !== null && `${getFieldNumber(6)}. `}Is it a bank statement?
                    </label>
                    <select
                      id="is-bank-statement"
                      value={isExtrato ? 'yes' : 'no'}
                      onChange={e => setIsExtrato(e.target.value === 'yes')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500 text-base"
                      aria-label="Is it a bank statement"
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>

                  {/* Campos de moeda - aparecem apenas se for bank statement */}
                  {isExtrato && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="source-currency">
                          {getFieldNumber(6) !== null && `${getFieldNumber(6)}.1. `}Source Currency (Original Document)
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
                          {getFieldNumber(6) !== null && `${getFieldNumber(6)}.2. `}Target Currency (Translation To)
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
                      {getFieldNumber(7) !== null && `${getFieldNumber(7)}. `}Original Document Language
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
                      {getFieldNumber(8) !== null && `${getFieldNumber(8)}. `}Target Language (Translation To)
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

                {/* Payment Method - Only show for client uploads */}
                {uploadType === 'client' && (
                  <section>
                    <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="payment-method">
                      {getFieldNumber(9) !== null && `${getFieldNumber(9)}. `}Payment Method
                    </label>
                    <select
                      id="payment-method"
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500 text-base"
                      aria-label="Payment method"
                    >
                      {paymentMethods.map(method => (
                        <option key={method.value} value={method.value}>{method.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Select the payment method used by the client for this translation service.
                    </p>
                  </section>
                )}

                {/* Receipt Upload - Only show for client uploads */}
                {uploadType === 'client' && (
                  <section>
                    <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="receipt-upload">
                      {getFieldNumber(10) !== null && `${getFieldNumber(10)}. `}Payment Receipt (Optional)
                    </label>
                    <div
                      className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer flex flex-col items-center justify-center ${receiptFile ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-green-400'}`}
                      onClick={() => receiptInputRef.current?.click()}
                      style={{ minHeight: 120 }}
                      aria-label="Upload receipt area"
                    >
                      <input
                        type="file"
                        ref={receiptInputRef}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleReceiptFileChange(file);
                        }}
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        id="receipt-upload"
                        aria-label="Upload receipt file input"
                        title="Select a receipt file to upload"
                      />
                      {receiptFile ? (
                        <div className="flex flex-col items-center gap-2">
                          <Receipt className="w-8 h-8 text-green-500 mb-1" />
                          <span className="text-gray-800 font-medium text-sm">{receiptFile.name}</span>
                          <span className="text-xs text-gray-500">{(receiptFile.size / 1024 / 1024).toFixed(2)} MB</span>
                          <button
                            className="mt-1 text-xs text-tfe-red-500 hover:underline"
                            onClick={e => {
                              e.stopPropagation();
                              setReceiptFile(null);
                              setReceiptFileUrl(null);
                            }}
                          >Remove receipt</button>
                          {receiptFile && receiptFileUrl && receiptFile.type.startsWith('image/') && (
                            <img src={receiptFileUrl} alt="Receipt Preview" className="max-h-24 rounded shadow mt-2" />
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Receipt className="w-8 h-8 text-gray-400 mb-1" />
                          <p className="text-sm text-gray-600 font-medium">
                            Click to upload receipt or drag and drop
                          </p>
                          <p className="text-xs text-gray-400">
                            PDF, JPG, PNG up to 5MB
                          </p>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Upload a copy of the payment receipt for record keeping purposes. This is optional.
                    </p>
                  </section>
                )}

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
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!isUploading) {
                        handleUpload();
                      }
                    }}
                    disabled={!selectedFile || (uploadType === 'client' && !clientName.trim()) || isUploading}
                    className="w-full bg-gradient-to-r from-tfe-blue-950 to-tfe-red-950 text-white py-4 rounded-xl font-bold shadow-lg hover:from-blue-800 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg transition-all"
                  >
                    {isUploading ? 'Uploading...' : 'Upload Document (Free for Authenticators)'}
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
                  <Shield className="w-5 h-5" />
                  Authenticator Access
                </h3>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-base text-gray-700">Regular Cost:</span>
                  <span className="text-2xl font-bold text-gray-400 line-through">${valor}.00</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-base text-tfe-blue-800 font-semibold">Your Cost:</span>
                  <span className="text-2xl font-bold text-green-600">FREE</span>
                </div>
                <p className="text-xs text-tfe-blue-950/80 mb-2">
                  {translationTypes.find(t => t.value === tipoTrad)?.label} $20 per page × {pages} pages = ${(pages * 20).toFixed(2)}
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
                  Service Information
                </h3>

                <div className="space-y-6">
                  {/* Translation Types */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Award className="w-4 h-4 text-tfe-blue-600" />
                      Translation Types
                    </h4>
                    <div className="space-y-3">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-gray-800">Certified Translation</span>
                          <span className="text-sm font-bold text-tfe-blue-600">$20/page</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          Official certified translation with complete legal authentication for all purposes including court documents, legal proceedings, immigration, and USCIS applications.
                        </p>
                        <ul className="text-xs text-gray-500 space-y-1">
                          <li>• Official certification stamp</li>
                          <li>• Notary public certification</li>
                          <li>• Legal document authentication</li>
                          <li>• USCIS accepted</li>
                          <li>• Digital verification code</li>
                          <li>• Court-accepted format</li>
                          <li>• Enhanced verification</li>
                          <li>• 24-48 hour turnaround</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Document Types */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-tfe-blue-600" />
                      Document Types
                    </h4>
                    <div className="space-y-3">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-gray-800">Regular Documents</span>
                          <span className="text-sm text-gray-600">Standard rate</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          Birth certificates, marriage certificates, diplomas, transcripts, and other official documents.
                        </p>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-gray-800">Bank Statements</span>
                          <span className="text-sm font-bold text-orange-600">+$5/page</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          Additional verification and formatting required for financial documents.
                        </p>
                        <ul className="text-xs text-gray-500 space-y-1">
                          <li>• Enhanced verification process</li>
                          <li>• Financial document formatting</li>
                          <li>• Additional security measures</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Languages */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Globe className="w-4 h-4 text-tfe-blue-600" />
                      Supported Languages
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
                      All documents are translated to English for USCIS and US authority requirements.
                    </p>
                  </div>

                  {/* Features */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-tfe-blue-600" />
                      Service Features
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-gray-700">USCIS & Government Accepted</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-gray-700">Official Certification</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-gray-700">Digital Verification System</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-gray-700">24-48 Hour Turnaround</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-gray-700">Secure File Handling</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
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
  );
}