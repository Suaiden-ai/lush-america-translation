import React, { useState } from 'react';
import { Users, User, DollarSign } from 'lucide-react';
import { AffiliateRoleManagement } from './AffiliateRoleManagement';
import { FinanceAffiliateManagement } from './FinanceAffiliateManagement';

export function AffiliateManagementPage() {
  const [activeTab, setActiveTab] = useState<'manage' | 'view'>('manage');

  const tabs = [
    { id: 'manage', label: 'Manage Affiliates', icon: User },
    { id: 'view', label: 'View Affiliates', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-3 sm:p-4 lg:p-6 w-full max-w-none overflow-x-hidden">
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Affiliate Management</h1>
          <p className="text-sm sm:text-base lg:text-lg text-gray-600 mt-1 sm:mt-2">Manage affiliate roles and view affiliate details</p>
        </div>

        {/* Tabs - Mobile Responsive */}
        <div className="mb-4 sm:mb-6">
          {/* Mobile: Dropdown */}
          <div className="sm:hidden">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as 'manage' | 'view')}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-tfe-blue-500 focus:border-tfe-blue-500 bg-white"
            >
              {tabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Desktop: Horizontal tabs */}
          <nav className="hidden sm:flex space-x-4 lg:space-x-8 overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'manage' | 'view')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-tfe-blue-500 text-tfe-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="space-y-4 sm:space-y-6 w-full">
          {activeTab === 'manage' && (
            <AffiliateRoleManagement />
          )}

          {activeTab === 'view' && (
            <FinanceAffiliateManagement />
          )}
        </div>
      </div>
    </div>
  );
}
