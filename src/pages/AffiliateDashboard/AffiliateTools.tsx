import { useState, useEffect } from 'react';
import { Copy, Link, Check, Star } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../contexts/I18nContext';
import { supabase } from '../../lib/supabase';

export function AffiliateTools() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [referralCode, setReferralCode] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const referralUrl = `${window.location.origin}/register?ref=${referralCode}`;

  // Buscar referral_code da tabela affiliates
  useEffect(() => {
    const fetchReferralCode = async () => {
      if (user?.id) {
        try {
          const { data, error } = await supabase
            .from('affiliates')
            .select('referral_code')
            .eq('user_id', user.id)
            .single();
          
          if (error) {
            console.error('Error fetching referral code:', error);
          } else if (data) {
            setReferralCode(data.referral_code);
          }
        } catch (err) {
          console.error('Error fetching referral code:', err);
        }
      }
    };

    fetchReferralCode();
  }, [user?.id]);

  const copyToClipboard = async (text: string, type: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'code') {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } else if (type === 'link') {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };





  return (
    <div className="space-y-8">


      {/* Referral Code Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Star className="w-6 h-6 text-yellow-500" />
          <h2 className="text-xl font-semibold text-gray-900">{t('affiliate.yourReferralCode')}</h2>
        </div>

        {/* Code Display */}
        <div className="bg-gradient-to-r from-tfe-blue-50 to-tfe-red-50 rounded-lg p-4 mb-6 border border-tfe-blue-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-tfe-blue-100 rounded-lg p-2">
                <Link className="w-5 h-5 text-tfe-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">{t('affiliate.referralCode')}:</p>
                <p className="text-2xl font-mono font-bold text-tfe-blue-900">{referralCode}</p>
              </div>
            </div>
            <button
              onClick={() => copyToClipboard(referralCode, 'code')}
              className="flex items-center gap-2 px-4 py-2 bg-tfe-blue-600 text-white rounded-lg hover:bg-tfe-blue-700 transition-colors"
            >
              {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedCode ? t('affiliate.copied') : t('affiliate.copyCode')}
            </button>
          </div>

          {/* Link Display */}
          <div className="bg-white rounded-lg p-3 mb-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-600 mb-1">{t('affiliate.referralLink')}:</p>
                <p className="text-sm font-mono text-gray-800 truncate" title={referralUrl}>
                  {referralUrl}
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(referralUrl, 'link')}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors ml-2"
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedLink ? t('affiliate.copied') : t('affiliate.copyLink')}
              </button>
            </div>
          </div>

        </div>

        {/* Instructions */}
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">{t('affiliate.howItWorksTitle')}</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• {t('affiliate.shareCode')}</li>
            <li>• {t('affiliate.earnCommissions')}</li>
            <li>• {t('affiliate.level1Description')}</li>
            <li>• {t('affiliate.level2Description')}</li>
          </ul>
        </div>
      </div>

    </div>
  );
}
