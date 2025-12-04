import { useState, useCallback, useEffect } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { retryDocumentUpload, RetryUploadResult } from '../../utils/retryUpload';
import { DocumentWithMissingFile } from '../../hooks/useDocumentsWithMissingFiles';

interface RetryUploadModalProps {
  document: DocumentWithMissingFile;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RetryUploadModal({
  document,
  isOpen,
  onClose,
  onSuccess
}: RetryUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<RetryUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validatingPages, setValidatingPages] = useState(false);
  const [filePages, setFilePages] = useState<number | null>(null);
  const [expectedPages, setExpectedPages] = useState<number | null>(null);

  // Usar número de páginas do documento (já vem na interface)
  useEffect(() => {
    setExpectedPages(document.pages || 1);
  }, [document.pages]);

  // Função para contar páginas do PDF
  const countPdfPages = async (file: File): Promise<number> => {
    try {
      const pdfjsLib = await import('pdfjs-dist/build/pdf');
      // @ts-ignore
      const pdfjsWorkerSrc = (await import('pdfjs-dist/build/pdf.worker?url')).default;
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      return pdf.numPages;
    } catch (err) {
      console.error('Error counting PDF pages:', err);
      throw new Error('Could not read the PDF file. Please check if the file is corrupted.');
    }
  };

  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);
    setResult(null);
    setFilePages(null);

    // Validate file type
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are allowed');
      return;
    }

    // Validate size (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File too large. Maximum size: ${maxSize / 1024 / 1024}MB`);
      return;
    }

    // Validate if file is not empty
    if (file.size === 0) {
      setError('File is empty');
      return;
    }

    // Contar páginas do PDF
    setValidatingPages(true);
    try {
      const pages = await countPdfPages(file);
      setFilePages(pages);

      // Validate page count
      if (expectedPages !== null && pages !== expectedPages) {
        setError(
          `The file has ${pages} ${pages === 1 ? 'page' : 'pages'}, but you paid for ${expectedPages} ${expectedPages === 1 ? 'page' : 'pages'}. ` +
          `Please upload a file with exactly ${expectedPages} ${expectedPages === 1 ? 'page' : 'pages'}.`
        );
        setSelectedFile(null);
        setValidatingPages(false);
        return;
      }

      setSelectedFile(file);
    } catch (err: any) {
      setError(err.message || 'Error validating PDF file');
      setSelectedFile(null);
    } finally {
      setValidatingPages(false);
    }
  }, [expectedPages]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    setResult(null);

    // Simular progresso
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      const uploadResult = await retryDocumentUpload(document.document_id, selectedFile);
      clearInterval(progressInterval);
      setUploadProgress(100);
      setResult(uploadResult);

      if (uploadResult.success) {
        // Aguardar um pouco antes de fechar para mostrar sucesso
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 1500);
      } else {
        setError(uploadResult.error || 'Error resending document');
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      setError(err.message || 'Unexpected error resending document');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setSelectedFile(null);
      setError(null);
      setResult(null);
      setUploadProgress(0);
      onClose();
    }
  };

  if (!isOpen) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <FileText className="h-6 w-6 text-amber-600 mr-3" />
            <h2 className="text-xl font-bold text-gray-900">
              Resend Document
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Document Information */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Document Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">File name:</span>
                <span className="font-medium text-gray-900">{document.original_filename || document.filename}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Amount paid:</span>
                <span className="font-medium text-green-600">
                  {formatCurrency(document.payment_gross_amount || document.payment_amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Payment date:</span>
                <span className="font-medium text-gray-900">{formatDate(document.payment_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Pages paid:</span>
                <span className="font-medium text-amber-600">
                  {expectedPages || document.pages || 1} {expectedPages === 1 ? 'page' : 'pages'}
                </span>
              </div>
              {expectedPages && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
                  <p className="text-xs text-amber-800">
                    <strong>Important:</strong> You must upload a PDF file with exactly <strong>{expectedPages} {expectedPages === 1 ? 'page' : 'pages'}</strong>, 
                    as you paid for {expectedPages} {expectedPages === 1 ? 'page' : 'pages'}.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Área de upload */}
          {!result?.success && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-amber-500 bg-amber-50'
                  : selectedFile
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 bg-gray-50'
              }`}
            >
              {validatingPages ? (
                <div className="space-y-4">
                  <Loader className="h-12 w-12 text-amber-600 mx-auto animate-spin" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Validating file...</p>
                    <p className="text-xs text-gray-500 mt-1">Counting PDF pages</p>
                  </div>
                </div>
              ) : selectedFile ? (
                <div className="space-y-4">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    {filePages !== null && expectedPages !== null && (
                      <div className={`mt-2 p-2 rounded ${
                        filePages === expectedPages 
                          ? 'bg-green-50 border border-green-200' 
                          : 'bg-red-50 border border-red-200'
                      }`}>
                        <p className={`text-xs font-medium ${
                          filePages === expectedPages ? 'text-green-800' : 'text-red-800'
                        }`}>
                          {filePages === expectedPages ? (
                            <>✅ File has {filePages} {filePages === 1 ? 'page' : 'pages'} (correct)</>
                          ) : (
                            <>❌ File has {filePages} {filePages === 1 ? 'page' : 'pages'} (expected: {expectedPages})</>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setFilePages(null);
                    }}
                    className="text-sm text-amber-600 hover:text-amber-700"
                  >
                    Select another file
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Drag and drop the PDF file here
                    </p>
                    <p className="text-xs text-gray-500 mt-1">or</p>
                    <label className="mt-2 inline-block">
                      <span className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 cursor-pointer transition-colors">
                        Select file
                      </span>
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={handleFileInputChange}
                        className="hidden"
                        disabled={uploading}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Only PDF files are allowed. Maximum size: 10MB
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Uploading file...</span>
                <span className="text-sm text-gray-500">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-amber-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Success Message */}
          {result?.success && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                <p className="text-sm font-medium text-green-800">
                  Document resent successfully!
                </p>
              </div>
              <p className="text-sm text-green-700 mt-2">
                The file has been uploaded and is being processed. You will be notified when the translation is ready.
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                <p className="text-sm font-medium text-red-800">Error resending document</p>
              </div>
              <p className="text-sm text-red-700 mt-2">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={handleClose}
            disabled={uploading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {result?.success ? 'Close' : 'Cancel'}
          </button>
          {!result?.success && (
            <button
              onClick={handleUpload}
              disabled={
                !selectedFile || 
                uploading || 
                validatingPages || 
                (filePages !== null && expectedPages !== null && filePages !== expectedPages)
              }
              className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {uploading ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : validatingPages ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Resend Document
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

