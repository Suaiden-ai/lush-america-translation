import { useState } from 'react';
import { Copy, Link, Check, Star } from 'lucide-react';

interface CompactReferralCodeProps {
  referralCode: string;
  className?: string;
}

export function CompactReferralCode({ referralCode, className = '' }: CompactReferralCodeProps) {
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
    <div className={`bg-gradient-to-r from-tfe-blue-50 to-tfe-red-50 rounded-lg p-3 border border-tfe-blue-200 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Star className="w-4 h-4 text-yellow-500" />
        <h3 className="text-sm font-semibold text-gray-900">Your Referral Code</h3>
      </div>

      {/* Code Display - Compact */}
      <div className="bg-white rounded-lg p-2 mb-2 border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link className="w-3 h-3 text-tfe-blue-600" />
            <span className="text-xs text-gray-600">Code:</span>
            <span className="text-sm font-mono font-bold text-tfe-blue-900">{referralCode}</span>
          </div>
          <button
            onClick={() => copyToClipboard(referralCode, 'code')}
            className="flex items-center gap-1 px-2 py-1 bg-tfe-blue-600 text-white rounded text-xs hover:bg-tfe-blue-700 transition-colors"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Link Display - Compact */}
      <div className="bg-white rounded-lg p-2 border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <span className="text-xs text-gray-600">Link:</span>
            <p className="text-xs font-mono text-gray-800 truncate" title={referralUrl}>
              {referralUrl}
            </p>
          </div>
          <button
            onClick={() => copyToClipboard(referralUrl, 'link')}
            className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors ml-2"
          >
            {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copiedLink ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
