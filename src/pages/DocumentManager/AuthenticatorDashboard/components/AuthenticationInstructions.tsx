import { ShieldCheck } from 'lucide-react';

export function AuthenticationInstructions() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4" />
        Authentication Instructions
      </h3>
      <div className="space-y-2 text-sm text-blue-800">
        <div className="flex items-start gap-2">
          <span className="font-medium min-w-fit">• View Original:</span>
          <span>Document is being translated. Wait 1-2 minutes and refresh the page to view the translated document.</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="font-medium min-w-fit">• View Original (persistent):</span>
          <span>If the "View Original" button persists for a long time, the automatic AI translation failed and only the original document will be shown.</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="font-medium min-w-fit">• View PDF:</span>
          <span>Translation was successful. Please verify the document for any errors before approval.</span>
        </div>
      </div>
    </div>
  );
}
