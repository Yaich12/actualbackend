const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1']);
const stripTrailingSlash = (value) => `${value || ''}`.replace(/\/+$/, '');
const hasLocalhost = (value) =>
  typeof value === 'string' &&
  (value.includes('localhost') || value.includes('127.0.0.1'));

export const isLocalhost = () => {
  if (typeof window === 'undefined' || !window.location) return false;
  return LOCALHOST_HOSTS.has(window.location.hostname);
};

let didLog = false;
const resolveLocalApiBase = () => {
  const envBase = process.env.REACT_APP_API_BASE_URL;
  return envBase && typeof envBase === 'string'
    ? stripTrailingSlash(envBase)
    : 'http://localhost:4000';
};
const resolveLocalWsBase = () => {
  const envBase = process.env.REACT_APP_WS_BASE_URL;
  return envBase && typeof envBase === 'string'
    ? stripTrailingSlash(envBase)
    : 'ws://localhost:4000';
};
const logLocalBases = (apiBase, wsBase) => {
  if (!isLocalhost() || didLog || typeof console === 'undefined') return;
  didLog = true;
  console.log('[runtimeUrls] API base:', apiBase);
  console.log('[runtimeUrls] WS base:', wsBase);
};

const assertNoLocalhostInProd = () => {
  if (isLocalhost()) return;
  const apiEnv = process.env.REACT_APP_API_BASE_URL;
  const wsEnv = process.env.REACT_APP_WS_BASE_URL;
  if (hasLocalhost(apiEnv) || hasLocalhost(wsEnv)) {
    throw new Error('[runtimeUrls] localhost detected in production config.');
  }
};

export const getApiBaseUrl = () => {
  assertNoLocalhostInProd();
  if (isLocalhost()) {
    const resolved = resolveLocalApiBase();
    logLocalBases(resolved, resolveLocalWsBase());
    return resolved;
  }
  return '';
};

export const getWsBaseUrl = () => {
  assertNoLocalhostInProd();
  const envBase = process.env.REACT_APP_WS_BASE_URL;
  if (envBase && typeof envBase === 'string') {
    return stripTrailingSlash(envBase);
  }
  if (isLocalhost()) {
    const resolved = resolveLocalWsBase();
    logLocalBases(resolveLocalApiBase(), resolved);
    return resolved;
  }
  return '';
};

const withLeadingSlash = (path) => (path.startsWith('/') ? path : `/${path}`);

export const buildApiUrl = (path) => {
  if (!isLocalhost() && hasLocalhost(path)) {
    throw new Error('[runtimeUrls] localhost detected in API path.');
  }
  const base = getApiBaseUrl();
  return base ? `${base}${withLeadingSlash(path)}` : withLeadingSlash(path);
};

export const buildWsUrl = (path) => {
  if (!isLocalhost() && hasLocalhost(path)) {
    throw new Error('[runtimeUrls] localhost detected in WS path.');
  }
  const base = getWsBaseUrl();
  if (base) {
    return `${base}${withLeadingSlash(path)}`;
  }
  // In production return a relative path so the browser picks ws/wss automatically.
  return withLeadingSlash(path);
};

// Validate production config early to catch regressions.
assertNoLocalhostInProd();
