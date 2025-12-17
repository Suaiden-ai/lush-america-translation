import { Clock, Check } from 'lucide-react';
import { Stats } from '../types/authenticator.types';

interface StatsCardsProps {
  pending: number;
  approved: number;
}

export function StatsCards({ pending, approved }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-10">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm p-4 sm:p-6 border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <Clock className="w-6 h-6 sm:w-7 sm:h-7 text-yellow-900" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{pending}</div>
          <div className="text-sm sm:text-base text-gray-600 font-medium">Pending</div>
        </div>
      </div>
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm p-4 sm:p-6 border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <Check className="w-6 h-6 sm:w-7 sm:h-7 text-green-900" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{approved}</div>
          <div className="text-sm sm:text-base text-gray-600 font-medium">Approved</div>
        </div>
      </div>
    </div>
  );
}
