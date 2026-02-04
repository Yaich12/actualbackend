import fs from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), 'src');
const patterns = [/localhost:4000/g, /127\.0\.0\.1:4000/g];
const matches = [];
const allowed = new Set([path.join(root, 'utils', 'runtimeUrls.js')]);

const walk = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!entry.isFile()) continue;
    if (allowed.has(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        matches.push(fullPath);
        break;
      }
    }
  }
};

if (fs.existsSync(root)) {
  walk(root);
}

if (matches.length) {
  console.error('[check] Found localhost references in src:');
  matches.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

console.log('[check] no localhost in prod bundle');
