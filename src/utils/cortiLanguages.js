const CORTI_LANGS = [
  'en-US',
  'en-GB',
  'en-AU',
  'en-CA',
  'da-DK',
  'sv-SE',
  'nb-NO',
  'nn-NO',
  'de-DE',
  'fr-FR',
  'es-ES',
  'es-MX',
  'it-IT',
  'pt-PT',
  'pt-BR',
  'nl-NL',
  'fi-FI',
  'pl-PL',
  'is-IS',
  'et-EE',
  'lv-LV',
  'lt-LT',
  'cs-CZ',
  'sk-SK',
  'hu-HU',
  'ro-RO',
  'bg-BG',
  'hr-HR',
  'sl-SI',
  'el-GR',
  'tr-TR',
];

const CORTI_FALLBACK = 'en-US';

const CORTI_LANGUAGE_ALIASES = {
  da: 'da-DK',
  'da-dk': 'da-DK',
  danish: 'da-DK',
  en: 'en-US',
  'en-us': 'en-US',
  english: 'en-US',
  'en-gb': 'en-GB',
  nb: 'nb-NO',
  no: 'nb-NO',
  'nb-no': 'nb-NO',
  nn: 'nn-NO',
  'nn-no': 'nn-NO',
  sv: 'sv-SE',
  'sv-se': 'sv-SE',
  pt: 'pt-PT',
  'pt-pt': 'pt-PT',
  portuguese: 'pt-PT',
  'pt-br': 'pt-BR',
  de: 'de-DE',
  'de-de': 'de-DE',
  fr: 'fr-FR',
  'fr-fr': 'fr-FR',
  es: 'es-ES',
  'es-es': 'es-ES',
  'es-mx': 'es-MX',
  it: 'it-IT',
  'it-it': 'it-IT',
  nl: 'nl-NL',
  'nl-nl': 'nl-NL',
  fi: 'fi-FI',
  'fi-fi': 'fi-FI',
  pl: 'pl-PL',
  'pl-pl': 'pl-PL',
  is: 'is-IS',
  'is-is': 'is-IS',
  et: 'et-EE',
  'et-ee': 'et-EE',
  lv: 'lv-LV',
  'lv-lv': 'lv-LV',
  lt: 'lt-LT',
  'lt-lt': 'lt-LT',
  cs: 'cs-CZ',
  'cs-cz': 'cs-CZ',
  sk: 'sk-SK',
  'sk-sk': 'sk-SK',
  hu: 'hu-HU',
  'hu-hu': 'hu-HU',
  ro: 'ro-RO',
  'ro-ro': 'ro-RO',
  bg: 'bg-BG',
  'bg-bg': 'bg-BG',
  hr: 'hr-HR',
  'hr-hr': 'hr-HR',
  sl: 'sl-SI',
  'sl-si': 'sl-SI',
  el: 'el-GR',
  'el-gr': 'el-GR',
  tr: 'tr-TR',
  'tr-tr': 'tr-TR',
};

const CORTI_LANGUAGE_LABELS = {
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  'en-AU': 'English (AU)',
  'en-CA': 'English (CA)',
  'da-DK': 'Dansk',
  'sv-SE': 'Svenska',
  'nb-NO': 'Norsk (Bokmål)',
  'nn-NO': 'Norsk (Nynorsk)',
  'de-DE': 'Deutsch',
  'fr-FR': 'Français',
  'es-ES': 'Español',
  'es-MX': 'Español (MX)',
  'it-IT': 'Italiano',
  'pt-PT': 'Português (PT)',
  'pt-BR': 'Português (BR)',
  'nl-NL': 'Nederlands',
  'fi-FI': 'Suomi',
  'pl-PL': 'Polski',
  'is-IS': 'Íslenska',
  'et-EE': 'Eesti',
  'lv-LV': 'Latviešu',
  'lt-LT': 'Lietuvių',
  'cs-CZ': 'Čeština',
  'sk-SK': 'Slovenčina',
  'hu-HU': 'Magyar',
  'ro-RO': 'Română',
  'bg-BG': 'Български',
  'hr-HR': 'Hrvatski',
  'sl-SI': 'Slovenščina',
  'el-GR': 'Ελληνικά',
  'tr-TR': 'Türkçe',
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

const getCortiLanguageLabel = (locale) => {
  const canonical = getCanonicalLocale(locale) || locale;
  const label = CORTI_LANGUAGE_LABELS[canonical] || canonical;
  return `${label} (${canonical})`;
};

export {
  CORTI_LANGS,
  CORTI_FALLBACK,
  CORTI_LANGUAGE_ALIASES,
  CORTI_LANGUAGE_LABELS,
  normalizeToCortiLocale,
  pickCortiLocale,
  getCortiLanguageLabel,
  isCortiLocaleSupported,
};
