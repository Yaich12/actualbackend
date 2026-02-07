import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const cwd = process.cwd();
const firebasercPath = path.join(cwd, '.firebaserc');

if (!fs.existsSync(firebasercPath)) {
  console.error('[deploy:live] Missing .firebaserc in repo root.');
  process.exit(1);
}

let firebaserc = null;
try {
  const raw = fs.readFileSync(firebasercPath, 'utf8');
  firebaserc = JSON.parse(raw);
} catch (error) {
  console.error('[deploy:live] Failed to parse .firebaserc:', error?.message || error);
  process.exit(1);
}

const projects = firebaserc?.projects || {};
const projectId = projects.default || Object.values(projects)[0];
if (!projectId) {
  console.error('[deploy:live] No Firebase project id found in .firebaserc.');
  process.exit(1);
}

const serviceId = 'actualbackend-api';
const region = process.env.CLOUD_RUN_REGION || 'us-central1';

const run = (label, command, args, { capture = false } = {}) => {
  console.log(`\n[deploy:live] ${label}`);
  const result = spawnSync(command, args, {
    stdio: capture ? 'pipe' : 'inherit',
    env: process.env,
    encoding: capture ? 'utf8' : undefined,
  });
  if (result.error) {
    console.error(`[deploy:live] Failed to run ${command}:`, result.error?.message || result.error);
    process.exit(1);
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    console.error(`[deploy:live] Failed: ${label} (exit ${result.status})`);
    process.exit(result.status);
  }
  return result.stdout || '';
};

const apiDeploy = spawnSync('npm', ['run', 'deploy:api'], { stdio: 'inherit', env: process.env });
if (apiDeploy.error) {
  console.error('[deploy:live] Failed to run deploy:api:', apiDeploy.error?.message || apiDeploy.error);
  console.error('[deploy:live] Cloud Run deploy failed; skipping hosting deploy.');
  process.exit(1);
}
if (typeof apiDeploy.status === 'number' && apiDeploy.status !== 0) {
  console.error(`[deploy:live] Cloud Run deploy failed (exit ${apiDeploy.status}); skipping hosting deploy.`);
  process.exit(apiDeploy.status);
}

const serviceUrl = run('Verifying Cloud Run service exists', 'gcloud', [
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

if (!serviceUrl) {
  console.error('[deploy:live] Cloud Run service not found or URL empty; skipping hosting deploy.');
  process.exit(1);
}

console.log(`[deploy:live] Cloud Run service URL: ${serviceUrl}`);

run('Deploying Hosting', 'npm', ['run', 'deploy:hosting']);

const hostingUrl = `https://${projectId}.web.app`;
const hostingUrlAlt = `https://${projectId}.firebaseapp.com`;

console.log('\n[deploy:live] Done. Verify:');
console.log(`- ${hostingUrl}`);
console.log(`- ${hostingUrlAlt}`);
console.log(`- ${hostingUrl}/api/corti/health`);
console.log('- DevTools Network: /api/* requests should be same-origin (no :4000)');
console.log('- WebSocket should connect to /ws/corti/transcribe in production');
