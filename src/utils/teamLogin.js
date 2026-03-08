const TEAM_LOGIN_EMAIL_DOMAIN = 'team.selma-login.local';
const USERNAME_MAX_LENGTH = 18;
const PASSWORD_MAX_LENGTH = 12;
const CLINIC_PREFIXES = new Set(['klinik', 'klinikken', 'clinic', 'the']);
const SUMMER_WORDS = ['sommer', 'strand', 'sol', 'hav', 'ferie', 'brise', 'is'];

const normalizeAscii = (value) =>
  String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');

const sanitizeChunk = (value) =>
  normalizeAscii(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const sanitizeWords = (value) =>
  normalizeAscii(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

const extractClinicChunk = (clinicName, maxLength = 8) => {
  const words = sanitizeWords(clinicName);
  if (!words.length) return 'team';

  let relevant = words;
  if (CLINIC_PREFIXES.has(words[0])) {
    relevant = words.slice(1);
  }

  const fallback = words.join('');
  const joined = (relevant.length ? relevant : words).join('');
  const candidate = sanitizeChunk(joined || fallback);
  if (!candidate) return 'team';
  return candidate.slice(0, maxLength) || 'team';
};

const buildInitials = ({ firstName = '', lastName = '', fallbackName = '' } = {}) => {
  const first = sanitizeWords(firstName)[0] || '';
  const last = sanitizeWords(lastName)[0] || '';

  if (first || last) {
    return `${first[0] || ''}${last[0] || ''}`.slice(0, 2) || 'm';
  }

  const fallbackWords = sanitizeWords(fallbackName);
  if (!fallbackWords.length) return 'm';
  if (fallbackWords.length === 1) {
    return fallbackWords[0].slice(0, 2) || 'm';
  }
  return `${fallbackWords[0][0]}${fallbackWords[1][0]}`;
};

const trimToLength = (value, maxLength) => String(value || '').slice(0, Math.max(1, maxLength));

const buildBaseUsername = ({ clinicName = '', firstName = '', lastName = '', fallbackName = '' } = {}) => {
  const clinicChunk = extractClinicChunk(clinicName, 9);
  const initials = buildInitials({ firstName, lastName, fallbackName });
  const raw = sanitizeChunk(`${clinicChunk}${initials}`) || 'teamm';
  return trimToLength(raw, USERNAME_MAX_LENGTH);
};

const withUsernameSuffix = (baseUsername, sequence = 0) => {
  const safeBase = sanitizeChunk(baseUsername) || 'teamm';
  if (!sequence) {
    return trimToLength(safeBase, USERNAME_MAX_LENGTH);
  }
  const suffix = String(sequence);
  const allowedBaseLength = Math.max(1, USERNAME_MAX_LENGTH - suffix.length);
  return `${safeBase.slice(0, allowedBaseLength)}${suffix}`;
};

const normalizeTeamLoginUsername = (value) =>
  trimToLength(sanitizeChunk(value), USERNAME_MAX_LENGTH);

const buildTeamLoginEmail = (username) => {
  const normalized = normalizeTeamLoginUsername(username);
  if (!normalized) return '';
  return `${normalized}@${TEAM_LOGIN_EMAIL_DOMAIN}`;
};

const hashTeamLoginSecret = (value) => {
  const input = String(value || '');
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
};

const randomNumberString = (length) => {
  const digits = Array.from({ length }, () => Math.floor(Math.random() * 10));
  return digits.join('');
};

const generateSummerPassword = () => {
  const word = SUMMER_WORDS[Math.floor(Math.random() * SUMMER_WORDS.length)] || 'sommer';
  const digitsLength = 3 + Math.floor(Math.random() * 3); // 3-5 digits
  const maxWordLength = Math.max(1, PASSWORD_MAX_LENGTH - digitsLength);
  const trimmedWord = word.slice(0, maxWordLength);
  return `${trimmedWord}${randomNumberString(digitsLength)}`;
};

const generateUniqueSummerPassword = ({ usedHashes = new Set(), maxAttempts = 200 } = {}) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const password = generateSummerPassword().slice(0, PASSWORD_MAX_LENGTH);
    const hash = hashTeamLoginSecret(password);
    if (!usedHashes.has(hash)) {
      return { password, hash };
    }
  }
  const fallbackPassword = `sol${Date.now().toString().slice(-6)}`.slice(0, PASSWORD_MAX_LENGTH);
  return {
    password: fallbackPassword,
    hash: hashTeamLoginSecret(fallbackPassword),
  };
};

export {
  TEAM_LOGIN_EMAIL_DOMAIN,
  USERNAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  buildBaseUsername,
  withUsernameSuffix,
  normalizeTeamLoginUsername,
  buildTeamLoginEmail,
  hashTeamLoginSecret,
  generateUniqueSummerPassword,
};
