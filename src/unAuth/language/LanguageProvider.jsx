import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { TRANSLATIONS } from './translations';

const LANGUAGE_STORAGE_KEY = 'selma_unauth_language';
const DEFAULT_LANGUAGE = 'da';
const LANGUAGE_OPTIONS = [
  { code: 'da', label: 'Dansk' },
  { code: 'en', label: 'English' },
];

const resolveLanguage = (value) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (TRANSLATIONS[normalized]) return normalized;
  const short = normalized.split('-')[0];
  return TRANSLATIONS[short] ? short : null;
};

const getTranslationValue = (translations, key) => {
  if (!key) return null;
  return key.split('.').reduce((acc, part) => acc?.[part], translations);
};

const applyInterpolation = (value, vars) => {
  if (!vars || typeof value !== 'string') return value;
  return value.replace(/\{(\w+)\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return String(vars[key]);
    }
    return match;
  });
};

const LanguageContext = createContext({
  language: DEFAULT_LANGUAGE,
  languageOptions: LANGUAGE_OPTIONS,
  setLanguage: () => {},
  t: (_key, _vars) => '',
  getArray: (_key, _fallback = []) => [],
});

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(DEFAULT_LANGUAGE);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    const resolvedStored = resolveLanguage(stored);
    if (resolvedStored) {
      setLanguageState(resolvedStored);
      return;
    }
    const browserLang = resolveLanguage(window.navigator.language);
    if (browserLang) {
      setLanguageState(browserLang);
    }
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const setLanguage = useCallback((nextLang) => {
    const resolved = resolveLanguage(nextLang) || DEFAULT_LANGUAGE;
    setLanguageState(resolved);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, resolved);
    }
  }, []);

  const translations = useMemo(
    () => TRANSLATIONS[language] || TRANSLATIONS[DEFAULT_LANGUAGE] || {},
    [language]
  );

  const fallbackTranslations = useMemo(() => {
    const fallbackLang = language === 'da' ? 'en' : 'da';
    return TRANSLATIONS[fallbackLang] || TRANSLATIONS[DEFAULT_LANGUAGE] || {};
  }, [language]);

  const t = useCallback(
    (key, vars) => {
      const value = getTranslationValue(translations, key);
      if (typeof value === 'string') {
        return applyInterpolation(value, vars);
      }
      const fallbackValue = getTranslationValue(fallbackTranslations, key);
      if (typeof fallbackValue === 'string') {
        return applyInterpolation(fallbackValue, vars);
      }
      return key;
    },
    [fallbackTranslations, translations]
  );

  const getArray = useCallback(
    (key, fallback = []) => {
      const value = getTranslationValue(translations, key);
      if (Array.isArray(value)) return value;
      const fallbackValue = getTranslationValue(fallbackTranslations, key);
      return Array.isArray(fallbackValue) ? fallbackValue : fallback;
    },
    [fallbackTranslations, translations]
  );

  const value = useMemo(
    () => ({
      language,
      languageOptions: LANGUAGE_OPTIONS,
      setLanguage,
      t,
      getArray,
    }),
    [getArray, language, setLanguage, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => useContext(LanguageContext);
export { LANGUAGE_STORAGE_KEY };
