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
                Atenção: Documentos com pagamento confirmado mas sem arquivo
              </h3>
              <div className="mt-2 text-sm text-amber-700">
                <p>
                  Você tem <strong>{count}</strong> {count === 1 ? 'documento' : 'documentos'} que {count === 1 ? 'foi' : 'foram'} pago{count > 1 ? 's' : ''} mas {count === 1 ? 'não foi' : 'não foram'} enviado{count > 1 ? 's' : ''} corretamente.
                </p>
                <p className="mt-1">
                  Por favor, reenvie {count === 1 ? 'o arquivo' : 'os arquivos'} para que possamos processar {count === 1 ? 'sua tradução' : 'suas traduções'}.
                </p>
              </div>
            </div>
            <button
              onClick={onViewDocuments}
              className="ml-4 flex items-center px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
            >
              <FileText className="h-4 w-4 mr-2" />
              Ver Documentos
              <ChevronRight className="h-4 w-4 ml-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

