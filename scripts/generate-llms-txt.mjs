// Generates llms.txt from README.md so it never drifts from the canonical docs.
// Usage: node scripts/generate-llms-txt.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readme = readFileSync(path.join(root, 'README.md'), 'utf8');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const base = 'https://github.com/IdanShalem/react-broadcast-sync';

// Split README into sections by "## " headings, ignoring fenced code blocks.
const sections = new Map();
let current = null;
let inFence = false;
for (const line of readme.split('\n')) {
  if (line.startsWith('```')) inFence = !inFence;
  const m = !inFence && line.match(/^## (.+)$/);
  if (m) {
    current = m[1].trim();
    sections.set(current, []);
  } else if (current) {
    sections.get(current).push(line);
  }
}

const body = name => {
  const s = sections.get(name);
  if (!s) throw new Error(`README section not found: ${name}`);
  return s
    .join('\n')
    .replace(/\n---\s*$/m, '')
    .trim();
};

const out = [
  `# ${pkg.name}`,
  '',
  `> ${pkg.description}`,
  '',
  `Version ${pkg.version}. Install: \`npm install ${pkg.name}\`. Same origin only. Generated from README.md by scripts/generate-llms-txt.mjs; do not edit by hand.`,
  '',
  '## Syncing Shared State (filters, settings)',
  '',
  body('Syncing Shared State (filters, settings)'),
  '',
  '## API Reference',
  '',
  body('API Reference'),
  '',
  '## Gotchas',
  '',
  body('Gotchas'),
  '',
  '## Links',
  '',
  `- [README](${base}#readme)`,
  `- [Telemetry notice](${base}/blob/main/TELEMETRY.md)`,
  '',
].join('\n');

const target = path.join(root, 'llms.txt');
if (process.argv.includes('--check')) {
  let existing = '';
  try {
    existing = readFileSync(target, 'utf8');
  } catch {}
  if (existing !== out) {
    console.error('llms.txt is out of date. Run: npm run generate:llms');
    process.exit(1);
  }
} else {
  writeFileSync(target, out);
}
