import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Importar arquivos de tradução
import pt from '../locales/pt.json';
import es from '../locales/es.json';
import en from '../locales/en.json';

// Configurar i18next
console.log('🚀 Iniciando configuração do i18next...');
console.log('📁 Recursos disponíveis:', { pt, es, en });

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      pt: { translation: pt },
      es: { translation: es },
      en: { translation: en }
    },
    lng: undefined, // Deixar o LanguageDetector decidir
    fallbackLng: 'en',
    debug: false, // Desabilitar debug em produção
    
    interpolation: {
      escapeValue: false,
    },
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
      checkWhitelist: true
    }
  }).then(() => {
    console.log('✅ i18next inicializado com sucesso!');
    console.log('🌐 Idioma atual:', i18n.language);
    console.log('📚 Recursos carregados:', Object.keys(i18n.store.data || {}));
    console.log('🔍 Teste de tradução:', i18n.t('hero.title1'));
  }).catch((error) => {
    console.error('❌ Erro ao inicializar i18next:', error);
  });

export default i18n;
