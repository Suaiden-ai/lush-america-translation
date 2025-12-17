import { Filter } from 'lucide-react';
import { GoogleStyleDatePicker } from '../../../components/GoogleStyleDatePicker';
import { DateRange } from '../../../components/DateRangeFilter';

interface PaymentsFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterStatus: string;
  onStatusChange: (value: string) => void;
  filterRole: string;
  onRoleChange: (value: string) => void;
  dateFilter: DateRange;
  onDateFilterChange: (range: DateRange) => void;
}

export function PaymentsFilters({
  searchTerm,
  onSearchChange,
  filterStatus,
  onStatusChange,
  filterRole,
  onRoleChange,
  dateFilter,
  onDateFilterChange
}: PaymentsFiltersProps) {
  return (
    <div className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gray-50">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
        {/* Search */}
        <div className="sm:col-span-2">
          <input
            type="text"
            placeholder="Search by name, email, filename, ID..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
            aria-label="Search payments"
          />
        </div>

        {/* Status Filter (Payment Status) */}
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-400 hidden sm:block" aria-hidden="true" />
          <select
            value={filterStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            aria-label="Filter by payment status"
          >
            <option value="all">All Payment Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>

        {/* Role Filter */}
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-400 hidden sm:block" aria-hidden="true" />
          <select
            value={filterRole}
            onChange={(e) => onRoleChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            aria-label="Filter by user role"
          >
            <option value="all">All User Roles</option>
            <option value="user">User</option>
            <option value="authenticator">Authenticator</option>
          </select>
        </div>

        {/* Google Style Date Range Filter */}
        <GoogleStyleDatePicker
          dateRange={dateFilter}
          onDateRangeChange={onDateFilterChange}
          className="w-full"
        />
      </div>
    </div>
  );
}
