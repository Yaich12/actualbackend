import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const cwd = process.cwd();
const firebasercPath = path.join(cwd, '.firebaserc');

if (!fs.existsSync(firebasercPath)) {
  console.error('[deploy:api] Missing .firebaserc in repo root.');
  process.exit(1);
}

let firebaserc = null;
try {
  const raw = fs.readFileSync(firebasercPath, 'utf8');
  firebaserc = JSON.parse(raw);
} catch (error) {
  console.error('[deploy:api] Failed to parse .firebaserc:', error?.message || error);
  process.exit(1);
}

const projects = firebaserc?.projects || {};
const projectId = projects.default || Object.values(projects)[0];
if (!projectId) {
  console.error('[deploy:api] No Firebase project id found in .firebaserc.');
  process.exit(1);
}

const serviceId = 'actualbackend-api';
const region = process.env.CLOUD_RUN_REGION || 'us-central1';

const envPath = process.env.CLOUD_RUN_ENV_FILE || path.join(cwd, '.env');
const envLocalPath = path.join(cwd, '.env.production.local');

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf8');
  const env = {};
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  });
  return env;
};

const envFromFile = parseEnvFile(envPath);
const envFromLocal = parseEnvFile(envLocalPath);
const mergedEnv = { ...envFromFile, ...envFromLocal };

Object.entries(mergedEnv).forEach(([key, value]) => {
  if (!process.env[key] && value !== undefined) {
    process.env[key] = value;
  }
});

const CLOUD_RUN_ENV_KEYS = [
  'CORTI_ENVIRONMENT',
  'CORTI_TENANT_NAME',
  'CORTI_CLIENT_ID',
  'CORTI_CLIENT_SECRET',
];

const escapeEnvValue = (value) =>
  String(value ?? '')
    .replace(/,/g, '\\,')
    .replace(/=/g, '\\=');

const resolveCloudRunEnvVars = () => {
  const envVars = [];
  const missing = [];
  CLOUD_RUN_ENV_KEYS.forEach((key) => {
    const value = process.env[key];
    if (!value) {
      missing.push(key);
      return;
    }
    envVars.push(`${key}=${escapeEnvValue(value)}`);
  });
  return { envVars, missing };
};

const run = (label, command, args, { capture = false } = {}) => {
  console.log(`\n[deploy:api] ${label}`);
  const result = spawnSync(command, args, {
    stdio: capture ? 'pipe' : 'inherit',
    env: process.env,
    encoding: capture ? 'utf8' : undefined,
  });

  if (result.error) {
    console.error(`[deploy:api] Failed to run ${command}:`, result.error?.message || result.error);
    process.exit(1);
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    console.error(`[deploy:api] Failed: ${label} (exit ${result.status})`);
    process.exit(result.status);
  }

  return result.stdout || '';
};

console.log(`[deploy:api] Firebase project: ${projectId}`);
console.log(`[deploy:api] Region: ${region}`);
console.log(`[deploy:api] Service: ${serviceId}`);
if (fs.existsSync(envPath)) {
  console.log(`[deploy:api] Loaded env file: ${path.relative(cwd, envPath)}`);
}
if (fs.existsSync(envLocalPath)) {
  console.log(`[deploy:api] Loaded env file: ${path.relative(cwd, envLocalPath)}`);
}

const { envVars, missing } = resolveCloudRunEnvVars();
if (missing.length) {
  console.warn(`[deploy:api] Missing env vars for Cloud Run: ${missing.join(', ')}`);
}

const deployArgs = [
  'run',
  'deploy',
  serviceId,
  '--source',
  '.',
  '--region',
  region,
  '--allow-unauthenticated',
  '--port',
  '4000',
  '--project',
  projectId,
];
if (envVars.length) {
  deployArgs.push('--set-env-vars', envVars.join(','));
}

run('Deploying Cloud Run service (source build)', 'gcloud', deployArgs);

const serviceUrl = run('Fetching Cloud Run service URL', 'gcloud', [
  'run',
  'services',
  'describe',
  serviceId,
  '--region',
  region,
  '--project',
  projectId,
  '--format',
  'value(status.url)',
], { capture: true }).trim();

const hostingUrl = `https://${projectId}.web.app`;

console.log('[deploy:api] Cloud Run deploy completed.');
if (serviceUrl) {
  console.log(`[deploy:api] Cloud Run URL: ${serviceUrl}`);
} else {
  console.log('[deploy:api] Cloud Run URL not found (describe returned empty).');
}
console.log(`[deploy:api] Test: curl -i ${hostingUrl}/api/corti/health`);
