// Base language codes aligned with Corti STT/text generation docs.
const CORTI_LANGS = [
  'ar',
  'da',
  'nl',
  'en',
  'en-US',
  'en-GB',
  'fr',
  'de',
  'de-CH',
  'hu',
  'it',
  'no',
  'pt',
  'es',
  'sv',
  'gsw-CH',
];

const CORTI_FALLBACK = 'en-US';
const CORTI_SPEECH_FALLBACK = 'en-US';

// Central allowlist for speech/transcription languages (editable).
const CORTI_SPEECH_ALLOWLIST = [...CORTI_LANGS];

const CORTI_LANGUAGE_ALIASES = {
  ar: 'ar',
  'ar-sa': 'ar',
  da: 'da',
  'da-dk': 'da',
  danish: 'da',
  en: 'en',
  'en-us': 'en-US',
  english: 'en',
  'en-gb': 'en-GB',
  fr: 'fr',
  'fr-fr': 'fr',
  de: 'de',
  'de-de': 'de',
  'de-ch': 'de-CH',
  gsw: 'gsw-CH',
  'gsw-ch': 'gsw-CH',
  nl: 'nl',
  'nl-nl': 'nl',
  it: 'it',
  'it-it': 'it',
  es: 'es',
  'es-es': 'es',
  'es-mx': 'es',
  pt: 'pt',
  'pt-pt': 'pt',
  'pt-br': 'pt',
  sv: 'sv',
  'sv-se': 'sv',
  no: 'no',
  'no-no': 'no',
  nb: 'no',
  'nb-no': 'no',
  nn: 'no',
  'nn-no': 'no',
  hu: 'hu',
  'hu-hu': 'hu',
};

const normalizeInput = (input) => String(input || '').trim().replace(/_/g, '-').toLowerCase();

const getCanonicalLocale = (value) =>
  CORTI_LANGS.find((locale) => locale.toLowerCase() === value.toLowerCase()) || null;

const isCortiLocaleSupported = (input) => {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw) return false;
  const normalized = normalizeInput(raw);
  const aliased = CORTI_LANGUAGE_ALIASES[normalized] || normalized;
  return Boolean(getCanonicalLocale(aliased));
};

const normalizeToCortiLocale = (input) => {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw) return CORTI_FALLBACK;
  const normalized = normalizeInput(raw);
  const aliased = CORTI_LANGUAGE_ALIASES[normalized] || normalized;
  return getCanonicalLocale(aliased) || CORTI_FALLBACK;
};

const pickCortiLocale = ({ uiLocale, userSelectedLocale, browserLocale }) => {
  const candidate = userSelectedLocale || browserLocale || uiLocale || '';
  return normalizeToCortiLocale(candidate);
};

const CORTI_SPEECH_ALLOWLIST_NORMALIZED = new Set(
  CORTI_SPEECH_ALLOWLIST.map((lang) => normalizeToCortiLocale(lang))
);

const isSpeechLanguageAllowed = (input) => {
  const normalized = normalizeToCortiLocale(input);
  return CORTI_SPEECH_ALLOWLIST_NORMALIZED.has(normalized);
};

const resolveSpeechLanguage = ({ speechLanguage, browserLocale } = {}) => {
  const explicit =
    typeof speechLanguage === 'string' && speechLanguage.trim() && speechLanguage !== 'auto'
      ? speechLanguage
      : '';
  const candidate = explicit || browserLocale || '';
  if (!candidate) return CORTI_SPEECH_FALLBACK;
  return normalizeToCortiLocale(candidate);
};

module.exports = {
  CORTI_LANGS,
  CORTI_FALLBACK,
  CORTI_SPEECH_ALLOWLIST,
  CORTI_SPEECH_FALLBACK,
  CORTI_LANGUAGE_ALIASES,
  normalizeToCortiLocale,
  pickCortiLocale,
  isCortiLocaleSupported,
  isSpeechLanguageAllowed,
  resolveSpeechLanguage,
};
