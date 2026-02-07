import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const cwd = process.cwd();
const firebasercPath = path.join(cwd, '.firebaserc');

if (!fs.existsSync(firebasercPath)) {
  console.error('[deploy] Missing .firebaserc in repo root.');
  process.exit(1);
}

let firebaserc = null;
try {
  const raw = fs.readFileSync(firebasercPath, 'utf8');
  firebaserc = JSON.parse(raw);
} catch (error) {
  console.error('[deploy] Failed to parse .firebaserc:', error?.message || error);
  process.exit(1);
}

const projects = firebaserc?.projects || {};
const projectId = projects.default || Object.values(projects)[0];
if (!projectId) {
  console.error('[deploy] No Firebase project id found in .firebaserc.');
  process.exit(1);
}

console.log(`[deploy] Firebase project: ${projectId}`);

const skipBuild = process.env.SKIP_BUILD === '1';
const skipFunctions = process.env.SKIP_FUNCTIONS === '1';
const skipHosting = process.env.SKIP_HOSTING === '1';

const run = (label, command, args) => {
  console.log(`\n[deploy] ${label}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    console.error(`[deploy] Failed to run ${command}:`, result.error?.message || result.error);
    process.exit(1);
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    console.error(`[deploy] Failed: ${label} (exit ${result.status})`);
    process.exit(result.status);
  }
};

if (skipBuild) {
  console.log('[deploy] SKIP_BUILD=1 -> skipping build.');
} else {
  run('Building CRA app', 'npm', ['run', 'build']);
}

if (skipFunctions) {
  console.log('[deploy] SKIP_FUNCTIONS=1 -> skipping functions deploy.');
} else {
  run('Deploying functions (python_functions)', 'npx', [
    'firebase-tools@latest',
    'deploy',
    '--only',
    'functions:python_functions',
  ]);
}

if (skipHosting) {
  console.log('[deploy] SKIP_HOSTING=1 -> skipping hosting deploy.');
} else {
  run('Deploying hosting', 'npx', [
    'firebase-tools@latest',
    'deploy',
    '--only',
    'hosting',
  ]);
}

console.log('\n[deploy] Done.');
