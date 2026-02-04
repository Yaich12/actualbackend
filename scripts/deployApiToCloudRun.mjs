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
const region = 'europe-west1';
const repoName = 'run-images';
const registryHost = `${region}-docker.pkg.dev`;

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

const ensureRepo = () => {
  const describe = spawnSync(
    'gcloud',
    [
      'artifacts',
      'repositories',
      'describe',
      repoName,
      '--location',
      region,
      '--project',
      projectId,
    ],
    { stdio: 'pipe', env: process.env }
  );

  if (describe.status === 0) return;

  run('Creating Artifact Registry repo (run-images)', 'gcloud', [
    'artifacts',
    'repositories',
    'create',
    repoName,
    '--repository-format',
    'docker',
    '--location',
    region,
    '--project',
    projectId,
    '--description',
    'Cloud Run images',
    '--quiet',
  ]);
};

const buildTag = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
    pad(now.getUTCSeconds()),
  ].join('');
  return `deploy-${stamp}`;
};

const tailCloudBuildLogs = (buildId) => {
  if (!buildId) return;
  const output = spawnSync(
    'gcloud',
    [
      'builds',
      'log',
      buildId,
      '--region',
      region,
      '--project',
      projectId,
    ],
    { stdio: 'pipe', env: process.env, encoding: 'utf8' }
  );

  const stdout = output.stdout || '';
  const lines = stdout.split('\n');
  const tail = lines.slice(-120).join('\n');
  if (tail.trim()) {
    console.error('\n[deploy:api] Cloud Build log tail (last 120 lines):');
    console.error(tail);
  } else {
    console.error('\n[deploy:api] Cloud Build logs unavailable.');
  }
};

console.log(`[deploy:api] Firebase project: ${projectId}`);
console.log(`[deploy:api] Region: ${region}`);
console.log(`[deploy:api] Service: ${serviceId}`);

ensureRepo();

run('Configuring docker auth for Artifact Registry', 'gcloud', [
  'auth',
  'configure-docker',
  registryHost,
  '--quiet',
]);

const tag = buildTag();
const image = `${registryHost}/${projectId}/${repoName}/${serviceId}:${tag}`;

const buildId = run('Submitting Cloud Build (Dockerfile)', 'gcloud', [
  'builds',
  'submit',
  '--tag',
  image,
  '--region',
  region,
  '--project',
  projectId,
  '--async',
  '--format',
  'value(id)',
], { capture: true }).trim();

if (!buildId) {
  console.error('[deploy:api] Cloud Build did not return a build id.');
  process.exit(1);
}

const buildUrl = `https://console.cloud.google.com/cloud-build/builds;region=${region}/${buildId}?project=${projectId}`;
console.log(`[deploy:api] Cloud Build ID: ${buildId}`);
console.log(`[deploy:api] Cloud Build URL: ${buildUrl}`);

const buildWait = spawnSync(
  'gcloud',
  [
    'builds',
    'wait',
    buildId,
    '--region',
    region,
    '--project',
    projectId,
  ],
  { stdio: 'inherit', env: process.env }
);

if (buildWait.error) {
  console.error('[deploy:api] Failed to wait for Cloud Build:', buildWait.error?.message || buildWait.error);
  console.error('[deploy:api] Cloud Build failed. Hosting deploy should be skipped.');
  tailCloudBuildLogs(buildId);
  process.exit(1);
}

if (typeof buildWait.status === 'number' && buildWait.status !== 0) {
  console.error(`[deploy:api] Cloud Build failed (exit ${buildWait.status}).`);
  console.error('[deploy:api] Cloud Build URL:', buildUrl);
  console.error('[deploy:api] Hosting deploy should be skipped.');
  tailCloudBuildLogs(buildId);
  process.exit(buildWait.status);
}

const deployResult = spawnSync(
  'gcloud',
  [
    'run',
    'deploy',
    serviceId,
    '--image',
    image,
    '--region',
    region,
    '--allow-unauthenticated',
    '--project',
    projectId,
    '--quiet',
  ],
  { stdio: 'inherit', env: process.env }
);

if (deployResult.error) {
  console.error('[deploy:api] Failed to run gcloud:', deployResult.error?.message || deployResult.error);
  console.error('[deploy:api] Cloud Run deploy failed. Hosting deploy should be skipped.');
  process.exit(1);
}

if (typeof deployResult.status === 'number' && deployResult.status !== 0) {
  console.error(`[deploy:api] Cloud Run deploy failed (exit ${deployResult.status}).`);
  console.error('[deploy:api] Hosting deploy should be skipped.');
  process.exit(deployResult.status);
}

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

console.log('[deploy:api] Cloud Run deploy completed.');
if (serviceUrl) {
  console.log(`[deploy:api] Service URL: ${serviceUrl}`);
} else {
  console.log('[deploy:api] Service URL not found (describe returned empty).');
}
