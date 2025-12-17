import { FileText, Download, CheckCircle, XCircle, Eye, Upload as UploadIcon } from 'lucide-react';
import { Document, UploadStates, RejectedRows } from '../types/authenticator.types';

interface DocumentTableMobileProps {
  documents: Document[];
  uploadStates: UploadStates;
  rejectedRows: RejectedRows;
  onView: (doc: Document) => void;
  onDownload: (doc: Document) => Promise<void>;
  onApprove: (docId: string) => void;
  onReject: (docId: string) => void;
  onCorrectionUpload: (doc: Document) => void;
  onFileSelect: (docId: string, file: File | null) => void;
  onViewUser: (userId: string) => void;
}

export function DocumentTableMobile({
  documents,
  uploadStates,
  rejectedRows,
  onView,
  onDownload,
  onApprove,
  onReject,
  onCorrectionUpload,
  onFileSelect,
  onViewUser
}: DocumentTableMobileProps) {

  return (
    <div className="block sm:hidden space-y-4">
      {documents.map(doc => (
        <div key={doc.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="space-y-3">
            {/* Document Name */}
            <div>
              <span className="text-gray-900 font-medium text-sm">
                {doc.filename}
              </span>
              
              {/* View and Download Buttons */}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => onView(doc)}
                  className="flex items-center gap-1 bg-tfe-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-tfe-blue-700 transition-colors font-medium"
                  title={doc.translated_file_url ? "View Translated PDF" : "View Original Document"}
                >
                  <FileText className="w-3 h-3" /> View {doc.translated_file_url ? "PDF" : "Original"}
                </button>
                
                <button
                  className="flex items-center gap-1 bg-emerald-600 text-white px-2 py-1 rounded text-xs hover:bg-emerald-700 transition-colors font-medium"
                  onClick={() => onDownload(doc)}
                  title={doc.translated_file_url ? "Download Translated PDF" : "Download Original Document"}
                >
                  <Download className="w-3 h-3" /> Download
                </button>
              </div>
            </div>

            {/* Document Details */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="font-medium text-gray-600">Value:</span>
                <span className="ml-1">{typeof doc.total_cost === 'number' ? `$${doc.total_cost.toFixed(2)}` : '-'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-600">Pages:</span>
                <span className="ml-1">{doc.pages}</span>
              </div>
              <div>
                <span className="font-medium text-gray-600">Language:</span>
                <span className="ml-1">{doc.source_language && doc.target_language ? `${doc.source_language} → ${doc.target_language}` : (doc.source_language || '-')}</span>
              </div>
              <div>
                <span className="font-medium text-gray-600">Bank:</span>
                <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-medium ${doc.is_bank_statement ? 'bg-tfe-red-100 text-tfe-red-800' : 'bg-green-100 text-green-800'}`}>
                  {doc.is_bank_statement ? 'Yes' : 'No'}
                </span>
              </div>
            </div>

            {/* Client Name */}
            {doc.client_name && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <div className="text-xs">
                  <span className="font-medium text-gray-600">Client:</span>
                  <span className="ml-1 text-gray-800 font-medium">{doc.client_name}</span>
                </div>
              </div>
            )}

            {/* User Info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 truncate max-w-32" title={doc.user_name || doc.user_id}>
                  {doc.user_name || `${doc.user_id.slice(0, 8)}...`}
                </span>
                <button
                  className="text-tfe-blue-600 hover:text-tfe-blue-950 p-1 rounded hover:bg-tfe-blue-50 transition-colors"
                  title="View user information"
                  onClick={() => onViewUser(doc.user_id)}
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
              <span className="text-xs text-gray-500">
                {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : '-'}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 border-t border-gray-200">
              {rejectedRows[doc.id] ? (
                <div className="space-y-3">
                  {/* File Upload Area */}
                  <div className="relative">
                    <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors group">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <UploadIcon className="w-6 h-6 mb-2 text-gray-400 group-hover:text-tfe-blue-500 transition-colors" />
                        <p className="mb-1 text-sm text-gray-600">
                          <span className="font-medium text-tfe-blue-600 hover:text-tfe-blue-500">Click to select</span> or drag file
                        </p>
                        <p className="text-xs text-gray-500">PDF only</p>
                      </div>
                      <input 
                        type="file" 
                        accept="application/pdf" 
                        className="hidden" 
                        onChange={e => {
                          const file = e.target.files?.[0] || null;
                          onFileSelect(doc.id, file);
                        }} 
                      />
                    </label>
                    
                    {/* Selected File Display */}
                    {uploadStates[doc.id]?.file && (
                      <div className="mt-2 p-2 bg-tfe-blue-50 border border-tfe-blue-200 rounded-md">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-tfe-blue-600" />
                          <span className="text-xs text-tfe-blue-800 font-medium truncate">
                            {uploadStates[doc.id]?.file?.name}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Send Button */}
                  <button
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg px-4 py-3 font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                    disabled={!uploadStates[doc.id]?.file || uploadStates[doc.id]?.uploading}
                    onClick={() => onCorrectionUpload(doc)}
                  >
                    {uploadStates[doc.id]?.uploading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Sending correction...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <UploadIcon className="w-4 h-4" />
                        Send Correction
                      </div>
                    )}
                  </button>

                  {/* Status Messages */}
                  {uploadStates[doc.id]?.success && (
                    <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-green-700 text-xs font-medium">Correction sent successfully!</span>
                    </div>
                  )}
                  {uploadStates[doc.id]?.error && (
                    <div className="flex items-center gap-2 p-2 bg-tfe-red-50 border border-tfe-red-200 rounded-md">
                      <XCircle className="w-4 h-4 text-tfe-red-600" />
                      <span className="text-tfe-red-700 text-xs">{uploadStates[doc.id]?.error}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex gap-2">
                  <button 
                    onClick={() => onApprove(doc.id)} 
                    className="flex-1 flex items-center justify-center gap-1 bg-green-600 text-white px-3 py-2 rounded text-xs hover:bg-green-700 transition-colors font-medium"
                  >
                    <CheckCircle className="w-3 h-3" />Approve
                  </button>
                  <button 
                    onClick={() => onReject(doc.id)} 
                    className="flex-1 flex items-center justify-center gap-1 bg-tfe-red-600 text-white px-3 py-2 rounded text-xs hover:bg-tfe-red-700 transition-colors font-medium"
                  >
                    <XCircle className="w-3 h-3" />Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
