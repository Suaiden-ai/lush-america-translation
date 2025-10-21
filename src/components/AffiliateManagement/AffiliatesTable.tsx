import React from 'react';
import { Users, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { ClientsList } from './ClientsList';
import { formatDate } from '../../utils/dateUtils';

export interface Affiliate {
  affiliate_id: string;
  user_name: string;
  user_email: string;
  referral_code: string;
  current_level: number;
  total_clients: number;
  total_pages: number;
  available_balance: number;
  total_earned: number;
  created_at: string;
}

export interface AffiliatesTableProps {
  affiliates: Affiliate[];
  expandedAffiliate: string | null;
  onToggleExpand: (affiliateId: string) => void;
  onViewDetails: (affiliate: Affiliate) => void;
  clients: any[];
  loadingClients: boolean;
  clientSearchTerm: string;
  onClientSearchChange: (term: string) => void;
  className?: string;
}

export const AffiliatesTable: React.FC<AffiliatesTableProps> = ({
  affiliates,
  expandedAffiliate,
  onToggleExpand,
  onViewDetails,
  clients,
  loadingClients,
  clientSearchTerm,
  onClientSearchChange,
  className = ''
}) => {
  return (
    <div className={`bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Affiliate
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Code
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Level
              </th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Clients
              </th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pages
              </th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Available
              </th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pending
              </th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {affiliates.map((affiliate) => (
              <React.Fragment key={affiliate.affiliate_id}>
                <tr className="hover:bg-gray-50">
                  <td className="px-3 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Users className="w-4 h-4 text-orange-600" />
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900 truncate max-w-[120px]">{affiliate.user_name}</div>
                        <div className="text-xs text-gray-500 truncate max-w-[120px]">{affiliate.user_email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <span className="text-xs font-mono text-gray-900">{affiliate.referral_code}</span>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      affiliate.current_level === 2 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      L{affiliate.current_level}
                    </span>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                    {affiliate.total_clients}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                    {affiliate.total_pages}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                    <span className="font-medium text-green-600">
                      ${affiliate.available_balance.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                    <span className="font-medium text-orange-600">
                      ${affiliate.pending_balance.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                    <span className="font-medium text-blue-600">
                      ${affiliate.total_earned.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onToggleExpand(affiliate.affiliate_id)}
                        className="text-tfe-blue-600 hover:text-tfe-blue-900 flex items-center gap-1 text-xs"
                      >
                        {expandedAffiliate === affiliate.affiliate_id ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                        {expandedAffiliate === affiliate.affiliate_id ? 'Hide' : 'View'}
                      </button>
                      <button
                        onClick={() => onViewDetails(affiliate)}
                        className="text-gray-600 hover:text-gray-900 flex items-center gap-1 text-xs"
                      >
                        <Eye className="w-3 h-3" />
                        Details
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedAffiliate === affiliate.affiliate_id && (
                  <tr key={`${affiliate.affiliate_id}-expanded`}>
                    <td colSpan={9} className="px-0 py-0 bg-gray-50">
                      <div className="px-6 py-4">
                        <ClientsList
                          clients={clients}
                          loading={loadingClients}
                          searchTerm={clientSearchTerm}
                          onSearchChange={onClientSearchChange}
                          totalClients={affiliate.total_clients}
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
