import React, { useState } from 'react';
import { Copy, Link, Check } from 'lucide-react';

interface ReferralCodeDisplayProps {
  referralCode: string;
  className?: string;
}

export function ReferralCodeDisplay({ referralCode, className = '' }: ReferralCodeDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const referralUrl = `${window.location.origin}/register?ref=${referralCode}`;

  const copyToClipboard = async (text: string, type: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'code') {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };


  return (
    <div className={`bg-gradient-to-r from-tfe-blue-50 to-tfe-red-50 rounded-lg p-4 border border-tfe-blue-200 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900">Your Referral Code</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Share and earn commissions!</span>
        </div>
      </div>

      {/* Code Display */}
      <div className="bg-white rounded-lg p-3 mb-4 border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-tfe-blue-100 rounded-lg p-2">
              <Link className="w-5 h-5 text-tfe-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Code:</p>
              <p className="text-xl font-mono font-bold text-tfe-blue-900">{referralCode}</p>
            </div>
          </div>
          <button
            onClick={() => copyToClipboard(referralCode, 'code')}
            className="flex items-center gap-2 px-3 py-2 bg-tfe-blue-600 text-white rounded-lg hover:bg-tfe-blue-700 transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
        </div>
      </div>

      {/* Link Display */}
      <div className="bg-white rounded-lg p-3 mb-4 border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-600 mb-1">Referral Link:</p>
            <p className="text-sm font-mono text-gray-800 truncate" title={referralUrl}>
              {referralUrl}
            </p>
          </div>
          <button
            onClick={() => copyToClipboard(referralUrl, 'link')}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors ml-2"
          >
            {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiedLink ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>


      {/* Instructions */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">How it works:</h4>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• Share your code or link with friends</li>
          <li>• When they register using your code, you earn commissions</li>
          <li>• Level 1: $0.50 per translated page</li>
          <li>• Level 2: $1.00 per page (after 200 total pages)</li>
        </ul>
      </div>
    </div>
  );
}
