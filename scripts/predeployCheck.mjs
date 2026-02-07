import { spawnSync } from 'node:child_process';

console.log('[predeploy] Running npm ci --omit=dev to validate lockfile...');
const result = spawnSync('npm', ['ci', '--omit=dev'], { stdio: 'inherit', env: process.env });

if (result.error) {
  console.error('[predeploy] Failed to run npm ci:', result.error?.message || result.error);
  process.exit(1);
}

if (typeof result.status === 'number' && result.status !== 0) {
  console.error('[predeploy] npm ci --omit=dev failed. Ensure package-lock.json matches package.json.');
  console.error('[predeploy] Run: npm install && commit the updated package-lock.json');
  process.exit(result.status);
}

console.log('[predeploy] Lockfile OK.');
