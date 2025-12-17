import { FileText, AlertCircle } from 'lucide-react';
import { Document, PreviewType } from '../types/authenticator.types';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  document: Document | null;
  previewUrl: string | null;
  previewType: PreviewType;
  previewLoading: boolean;
  previewError: string | null;
  onClose: () => void;
  onDownload: (filename?: string | null) => void;
}

export function DocumentPreviewModal({
  isOpen,
  document,
  previewUrl,
  previewType,
  previewLoading,
  previewError,
  onClose,
  onDownload
}: DocumentPreviewModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[10000]" style={{ touchAction: 'none' }}>
      <div className="absolute inset-0 bg-white flex flex-col">
        <div className="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-tfe-blue-600 flex-shrink-0" />
            <span className="font-semibold text-gray-900 text-xs sm:text-sm truncate">{document?.filename || 'Document preview'}</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <button
              className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
              disabled={previewLoading || !previewUrl}
              onClick={() => onDownload(document?.filename || 'document.pdf')}
            >
              Download
            </button>
            <button
              className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
        <div className="flex-1 bg-gray-50 overflow-auto" style={{ 
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x pan-y pinch-zoom'
        }}>
          {previewLoading && (
            <div className="flex items-center justify-center h-full text-gray-600">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-sm sm:text-base">Loading document...</p>
              </div>
            </div>
          )}
          {!previewLoading && previewError && (
            <div className="p-4 sm:p-6 text-center text-tfe-red-600">
              <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2" />
              <p className="text-sm sm:text-base">{previewError}</p>
            </div>
          )}
          {!previewLoading && !previewError && previewUrl && (
            <>
              {previewType === 'image' ? (
                <div className="flex items-center justify-center h-full p-2 sm:p-4" style={{ 
                  minHeight: 'calc(100vh - 60px)',
                  WebkitUserSelect: 'none',
                  userSelect: 'none'
                }}>
                  <img 
                    src={previewUrl} 
                    alt={document?.filename || 'Document'} 
                    className="max-w-full max-h-full object-contain"
                    style={{ 
                      maxHeight: 'calc(100vh - 60px)',
                      width: 'auto',
                      height: 'auto',
                      display: 'block'
                    }}
                    draggable={false}
                    onError={(e) => {
                      console.error('Erro ao carregar imagem:', previewUrl);
                      console.error('Erro detalhado:', e);
                    }}
                  />
                </div>
              ) : (
                <div className="w-full h-full" style={{ 
                  minHeight: 'calc(100vh - 60px)',
                  overflow: 'auto',
                  WebkitOverflowScrolling: 'touch'
                }}>
                  <iframe 
                    src={previewUrl} 
                    className="w-full h-full border-0" 
                    title="Document Preview"
                    style={{
                      minHeight: 'calc(100vh - 60px)',
                      width: '100%',
                      height: '100%'
                    }}
                    scrolling="auto"
                    onError={(e) => {
                      console.error('Erro ao carregar iframe:', previewUrl);
                      console.error('Erro detalhado:', e);
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
