import { ShieldCheck } from 'lucide-react';

export function AuthenticatorHeader() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 mb-6 sm:mb-8 p-4 sm:p-6 bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100">
      <div className="flex items-center gap-4 sm:gap-6">
        <ShieldCheck className="w-10 h-10 sm:w-12 sm:h-12 text-green-600" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">Authenticator Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-600">Approve or reject translated documents submitted for verification. Only authenticators have access to this panel.</p>
        </div>
      </div>
    </div>
  );
}
