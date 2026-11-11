import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language } from '../types';
import { TRANSLATIONS, TranslationDictionary } from '../constants/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationDictionary;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('pairup_language') as Language;
      if (saved === 'bn' || saved === 'hi' || saved === 'en') {
        return saved;
      }
    } catch {
      // Ignore storage errors in private browsing/sandboxes
    }
    return 'en';
  });

  // Sync document language attribute on language change
  useEffect(() => {
    try {
      document.documentElement.lang = language;
    } catch (e) {
      // No-op for non-DOM contexts
    }
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('pairup_language', lang);
      document.documentElement.lang = lang;
    } catch (e) {
      console.warn('Unable to persist language to storage', e);
    }
  };

  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
