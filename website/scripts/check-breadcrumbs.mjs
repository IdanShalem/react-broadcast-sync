import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function validateBreadcrumbs(data, file) {
  const items = data.itemListElement;
  if (!Array.isArray(items) || items.length < 2) throw new Error(`${file}: need two crumbs`);
  items.forEach((item, index) => {
    if (item.position !== index + 1 || !item.name) throw new Error(`${file}: invalid crumb`);
    if (index < items.length - 1 && !item.item) throw new Error(`${file}: missing item`);
    if (item.item && new URL(item.item).protocol !== 'https:')
      throw new Error(`${file}: item must be an HTTPS page URL`);
  });
}

function checkDirectory(dir) {
  let checked = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) checked += checkDirectory(path);
    else if (entry.name.endsWith('.mdx')) {
      const source = readFileSync(path, 'utf8');
      const matches = source.matchAll(/content: '([^\n]*"@type": "BreadcrumbList"[^\n]*)'/g);
      for (const match of matches) {
        validateBreadcrumbs(JSON.parse(match[1]), path);
        checked++;
      }
    }
  }
  return checked;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const checked = checkDirectory(new URL('../src/content/docs', import.meta.url).pathname);
  if (!checked) throw new Error('No breadcrumb markup found');
  console.log(`Validated ${checked} breadcrumb lists`);
}
