const { CortiClient, CortiEnvironment, CortiAuth } = require('@corti/sdk');

const resolvedCortiEnv = (process.env.CORTI_ENVIRONMENT || process.env.CORTI_ENV || 'eu').toLowerCase();
const resolvedEnvironment = resolvedCortiEnv === 'us' ? CortiEnvironment.Us : CortiEnvironment.Eu;

const missingCortiEnv = ['CORTI_CLIENT_ID', 'CORTI_CLIENT_SECRET', 'CORTI_TENANT_NAME'].filter(
  (key) => !process.env[key]
);

if (missingCortiEnv.length) {
  console.warn(`Missing Corti config: ${missingCortiEnv.join(', ')}`);
}

console.info(
  `Corti env status: ${JSON.stringify({
    CORTI_ENVIRONMENT: process.env.CORTI_ENVIRONMENT || process.env.CORTI_ENV ? 'OK' : 'MISSING',
    CORTI_TENANT_NAME: process.env.CORTI_TENANT_NAME ? 'OK' : 'MISSING',
    CORTI_CLIENT_ID: process.env.CORTI_CLIENT_ID ? 'OK' : 'MISSING',
    CORTI_CLIENT_SECRET: process.env.CORTI_CLIENT_SECRET ? 'OK' : 'MISSING',
  })}`
);

let cachedAccessToken = null;
let cachedTokenExpiresAt = 0;
const useTokenCaching = false; // force fresh token each call to avoid stale/invalid

const getAccessToken = async () => {
  const { CORTI_CLIENT_ID, CORTI_CLIENT_SECRET } = process.env;
  if (!CORTI_CLIENT_ID || !CORTI_CLIENT_SECRET || missingCortiEnv.length) {
    throw new Error(`Missing Corti config: ${missingCortiEnv.join(', ')}`);
  }

  const now = Date.now();
  if (useTokenCaching) {
    if (cachedAccessToken && cachedTokenExpiresAt > now + 30_000) {
      return cachedAccessToken;
    }
  }

  const auth = new CortiAuth({
    environment: resolvedEnvironment,
    tenantName: process.env.CORTI_TENANT_NAME,
  });

  const { accessToken, expiresIn } = await auth.getToken({
    clientId: CORTI_CLIENT_ID,
    clientSecret: CORTI_CLIENT_SECRET,
  });

  if (useTokenCaching) {
    cachedAccessToken = accessToken;
    cachedTokenExpiresAt = now + (expiresIn ? expiresIn * 1000 : 300_000);
  }

  return accessToken;
};

const createCortiClient = async () => {
  if (missingCortiEnv.length) {
    throw new Error(`Missing Corti config: ${missingCortiEnv.join(', ')}`);
  }

  const auth = new CortiAuth({
    environment: resolvedEnvironment,
    tenantName: process.env.CORTI_TENANT_NAME,
  });

  const { accessToken } = await auth.getToken({
    clientId: process.env.CORTI_CLIENT_ID,
    clientSecret: process.env.CORTI_CLIENT_SECRET,
  });

  return new CortiClient({
    environment: resolvedEnvironment,
    tenantName: process.env.CORTI_TENANT_NAME,
    auth: { accessToken },
  });
};

module.exports = {
  createCortiClient,
  getAccessToken,
  resolvedCortiEnv,
  resolvedEnvironment,
};
