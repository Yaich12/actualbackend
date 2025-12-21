import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { setUserLanguage, subscribeUserLanguage } from './firebase/userSettings';
import en from './translations/en.json';
import da from './translations/da.json';
import ar from './translations/ar.json';
import sv from './translations/sv.json';
import no from './translations/no.json';
import fr from './translations/fr.json';
import de from './translations/de.json';
import pt from './translations/pt.json';
import it from './translations/it.json';

const LANGUAGE_STORAGE_KEY = 'selma_language';
const DEFAULT_LANGUAGE = 'da';

export const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'da', label: 'Dansk' },
  { code: 'ar', label: 'عربى' },
  { code: 'sv', label: 'Svenska' },
  { code: 'no', label: 'Norsk' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
  { code: 'it', label: 'Italiano' },
];

const TRANSLATIONS = { en, da, ar, sv, no, fr, de, pt, it };
const LANGUAGE_LOCALES = {
  en: 'en-US',
  da: 'da-DK',
  ar: 'ar',
  sv: 'sv-SE',
  no: 'nb-NO',
  fr: 'fr-FR',
  de: 'de-DE',
  pt: 'pt-PT',
  it: 'it-IT',
};
const LANGUAGE_ALIASES = {
  nb: 'no',
  nn: 'no',
};

const resolveLanguage = (value) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (TRANSLATIONS[normalized]) return normalized;
  const short = normalized.split('-')[0];
  const aliased = LANGUAGE_ALIASES[short];
  if (aliased && TRANSLATIONS[aliased]) return aliased;
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
  locale: LANGUAGE_LOCALES[DEFAULT_LANGUAGE],
  isRtl: false,
  languageOptions: LANGUAGE_OPTIONS,
  setLanguage: (_lang, _options) => Promise.resolve(),
  t: (_key, _fallback, _vars) => '',
  getArray: (_key, _fallback = []) => [],
});

export const LanguageProvider = ({ children }) => {
  const { user } = useAuth();
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
    if (!user?.uid) return;
    const unsubscribe = subscribeUserLanguage(user.uid, (nextLang) => {
      const resolved = resolveLanguage(nextLang);
      if (!resolved) return;
      setLanguageState((prev) => (prev === resolved ? prev : resolved));
    });
    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const persistLanguage = useCallback(
    async (nextLang) => {
      if (!user?.uid) return;
      await setUserLanguage(user.uid, nextLang);
    },
    [user?.uid]
  );

  const setLanguage = useCallback(
    async (nextLang, options = {}) => {
      const resolved = resolveLanguage(nextLang) || DEFAULT_LANGUAGE;
      setLanguageState(resolved);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, resolved);
      }
      if (options.persist !== false && user?.uid) {
        try {
          await persistLanguage(resolved);
        } catch (error) {
          console.error('[LanguageContext] Failed to persist language', error);
        }
      }
    },
    [persistLanguage, user?.uid]
  );

  const translations = useMemo(
    () => TRANSLATIONS[language] || TRANSLATIONS[DEFAULT_LANGUAGE] || {},
    [language]
  );

  const t = useCallback(
    (key, fallback, vars) => {
      const value = getTranslationValue(translations, key);
      if (typeof value === 'string') {
        return applyInterpolation(value, vars);
      }
      if (typeof fallback === 'string') {
        return applyInterpolation(fallback, vars);
      }
      return key;
    },
    [translations]
  );

  const getArray = useCallback(
    (key, fallback = []) => {
      const value = getTranslationValue(translations, key);
      return Array.isArray(value) ? value : fallback;
    },
    [translations]
  );

  const value = useMemo(
    () => ({
      language,
      locale: LANGUAGE_LOCALES[language] || LANGUAGE_LOCALES[DEFAULT_LANGUAGE],
      isRtl: language === 'ar',
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
