import { AlertCircle, FileText, ChevronRight } from 'lucide-react';

interface MissingFileAlertProps {
  count: number;
  onViewDocuments: () => void;
}

export function MissingFileAlert({ count, onViewDocuments }: MissingFileAlertProps) {
  if (count === 0) {
    return null;
  }

  return (
    <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-6 rounded-r-lg shadow-sm">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertCircle className="h-5 w-5 text-amber-600" />
        </div>
        <div className="ml-3 flex-1">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-amber-800">
                Attention: Documents with confirmed payment but no file
              </h3>
              <div className="mt-2 text-sm text-amber-700">
                <p>
                  You have <strong>{count}</strong> {count === 1 ? 'document' : 'documents'} that {count === 1 ? 'was' : 'were'} paid but {count === 1 ? 'was not' : 'were not'} uploaded correctly.
                </p>
                <p className="mt-1">
                  Please resend {count === 1 ? 'the file' : 'the files'} so we can process {count === 1 ? 'your translation' : 'your translations'}.
                </p>
              </div>
            </div>
            <button
              onClick={onViewDocuments}
              className="ml-4 flex items-center px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
            >
              <FileText className="h-4 w-4 mr-2" />
              View Documents
              <ChevronRight className="h-4 w-4 ml-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

