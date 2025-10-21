import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import i18n from '../lib/i18n';

// Tipos
type Language = 'pt' | 'es' | 'en';

interface I18nContextType {
  currentLanguage: Language;
  changeLanguage: (lang: Language) => void;
  t: (key: string, options?: any) => string;
}

// Contexto
const I18nContext = createContext<I18nContextType | undefined>(undefined);

// Hook personalizado
export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n deve ser usado dentro de um I18nProvider');
  }
  return context;
};

// Provider
interface I18nProviderProps {
  children: ReactNode;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState<Language>('en');

  useEffect(() => {
    // Detectar idioma inicial do localStorage ou do i18n
    const savedLang = localStorage.getItem('i18nextLng') as Language;
    const detectedLang = i18n.language as Language;
    
    // Priorizar idioma salvo no localStorage
    const initialLang = savedLang || detectedLang;
    
    if (initialLang && ['pt', 'es', 'en'].includes(initialLang)) {
      setCurrentLanguage(initialLang);
      i18n.changeLanguage(initialLang);
    } else {
      // Fallback para inglês se não conseguir detectar
      setCurrentLanguage('en');
      i18n.changeLanguage('en');
    }
  }, []);

  const changeLanguage = (lang: Language) => {
    setCurrentLanguage(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem('i18nextLng', lang);
  };

  const t = (key: string, options?: any): string => {
    return i18n.t(key, options);
  };

  const value: I18nContextType = {
    currentLanguage,
    changeLanguage,
    t
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};

export default I18nProvider;
