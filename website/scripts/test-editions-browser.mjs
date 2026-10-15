/** Run after npm --prefix website run build. Uses repo's existing Playwright/Chromium. */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import { extname, join } from 'node:path';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
};
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    let target = join(root, path);
    if ((await stat(target)).isDirectory()) target = join(target, 'index.html');
    res.setHeader('Content-Type', types[extname(target)] || 'application/octet-stream');
    res.end(await readFile(target));
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const shot = async name => {
    if (process.env.EDITION_SCREENSHOTS) {
      await mkdir(process.env.EDITION_SCREENSHOTS, { recursive: true });
      await page.screenshot({ path: join(process.env.EDITION_SCREENSHOTS, name + '.png') });
    }
  };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    await page.goto(base + '/getting-started/');
    await page.getByLabel('Documentation edition: v2. Choose version').focus();
    await page.keyboard.press('Enter');
    await shot(`menu-${width}`);
    await page.getByRole('link', { name: 'v1 (1.11.2 archive)', exact: true }).click();
    await page
      .getByRole('heading', { name: 'Getting started with v1.11.2', exact: true })
      .waitFor();
    await shot(`archive-${width}`);
    assert.equal(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth
      ),
      false
    );
    await page.getByLabel('Documentation edition: v1. Choose version').click();
    await page.getByRole('link', { name: 'v2 (current)', exact: true }).click();
    await page.getByRole('heading', { name: 'Getting Started', exact: true }).waitFor();
  }
  for (const edition of ['v1', 'v2']) {
    await page.goto(base + (edition === 'v1' ? '/v1/api/' : '/api/use-broadcast-channel/'));
    await page.keyboard.press('Control+k');
    await page.locator('input[type="search"]').fill('telemetry');
    await page.locator('.pagefind-ui__result-link').first().waitFor();
    const links = await page
      .locator('.pagefind-ui__result-link')
      .evaluateAll(els => els.map(el => el.getAttribute('href')));
    assert.ok(links.length > 0);
    assert.ok(
      links.every(href => (edition === 'v1' ? href.startsWith('/v1/') : !href.startsWith('/v1/')))
    );
    await shot(`search-${edition}`);
    await page.setViewportSize({ width: 320, height: 850 });
    await shot(`search-mobile-${edition}`);
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.keyboard.press('Escape');
    await page.locator('dialog').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('dialog').evaluate(el => el.open), false);
  }
  await page.goto(base + '/api/use-synced-state/');
  await page.getByLabel('Documentation edition: v2. Choose version').click();
  await page.getByRole('link', { name: 'v1 (1.11.2 archive)', exact: true }).click();
  assert.ok(page.url().endsWith('/v1/#no-equivalent-page'));
  await page.getByRole('heading', { name: 'No equivalent page', exact: true }).waitFor();
  for (const path of [
    '/v1/',
    '/v1/getting-started/',
    '/v1/api/',
    '/v1/provider/',
    '/v1/telemetry/',
  ]) {
    await page.goto(base + path);
    await shot(path.replaceAll('/', '-'));
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    assert.equal(canonical, 'https://react-broadcast-sync-docs.vercel.app' + path);
    const sidebar = await page
      .locator('#starlight__sidebar a')
      .evaluateAll(els => els.map(a => a.getAttribute('href')));
    assert.ok(sidebar.length > 0);
    assert.ok(sidebar.filter(href => href.startsWith('/')).every(href => href.startsWith('/v1/')));
    const breadcrumbs = await page.locator('script[type="application/ld+json"]').allTextContents();
    assert.ok(breadcrumbs.some(text => text.includes('BreadcrumbList') && text.includes('/v1/')));
    const pager = await page
      .locator('.pagination-links a')
      .evaluateAll(els => els.map(a => a.getAttribute('href')));
    assert.ok(pager.every(href => href.startsWith('/v1/')));
  }
  assert.deepEqual(errors, []);
  console.log(
    'Edition browser checks pass: 320/390/1280, keyboard selector/search/Escape, equivalent/fallback routes, filtered search, archive sidebar/pagination/canonicals/schema.'
  );
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
