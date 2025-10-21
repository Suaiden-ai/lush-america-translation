import { Envelope, MapPin } from '@phosphor-icons/react';
import { useI18n } from '../contexts/I18nContext';

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="bg-tfe-blue-950 text-white">
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          
          {/* Company Information */}
          <div className="lg:col-span-1">
            <div className="mb-4">
              <div className="flex items-center space-x-3">
                                 <div className="flex items-center gap-2">
                   <img 
                     src="/logo.png" 
                     alt="Lush America Translations" 
                     className="w-12 h-12 flex-shrink-0 object-contain"
                   />
                   <h3 className="text-xl font-bold text-white">
                     <span className="text-white">LUSH</span>
                     <span className="text-white"> AMERICA TRANSLATIONS</span>
                   </h3>
                 </div>
              </div>
            </div>
            
            <p className="text-gray-300 mb-6 leading-relaxed">
              {t('footer.description', 'Transforming dreams into reality through specialized mentorship for study scholarships in the United States.')}
            </p>
          </div>

          {/* Our Services */}
          <div>
            <h4 className="text-lg font-semibold mb-6">{t('footer.services.title', 'Our Services')}</h4>
                                                  <ul className="space-y-3">
              <li>
                <a href="/translations" className="text-gray-300 hover:text-white transition-colors">
                  {t('footer.services.documentTranslation', 'Document Translation')}
                </a>
              </li>
              <li>
                <a href="/verify" className="text-gray-300 hover:text-white transition-colors">
                  {t('footer.services.documentVerification', 'Document Verification')}
                </a>
              </li>
            </ul>
          </div>

          

          {/* Contact */}
          <div>
            <h4 className="text-lg font-semibold mb-6">{t('footer.contact.title', 'Contact')}</h4>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Envelope className="w-5 h-5 text-tfe-red-400" weight="fill" />
                <a href="mailto:info@thefutureofenglish.com" className="text-gray-300 hover:text-white transition-colors">
                  info@thefutureofenglish.com
                </a>
              </div>
              
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-tfe-red-400" weight="fill" />
                <span className="text-gray-300">
                  {t('footer.contact.location', 'United States')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-gray-400 text-sm">
              {t('footer.copyright', '© 2025 Lush America Translations. All rights reserved.')}
            </div>
            
                         <div className="flex gap-6 text-sm">
               <a href="/privacy" className="text-gray-400 hover:text-white transition-colors">
                 {t('footer.links.privacy', 'Privacy Policy')}
               </a>
               <a href="/terms" className="text-gray-400 hover:text-white transition-colors">
                 {t('footer.links.terms', 'Terms of Use')}
               </a>
               <a href="/cookies" className="text-gray-400 hover:text-white transition-colors">
                 {t('footer.links.cookies', 'Cookie Policy')}
               </a>
             </div>
          </div>
        </div>
      </div>
    </footer>
  );
} 