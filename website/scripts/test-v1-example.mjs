/** Optional real-browser archive check. Run from repo with npm dependencies and Chromium installed. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
const root = fileURLToPath(new URL('../', import.meta.url));
const repo = resolve(root, '..');
const temp = await mkdtemp(join(tmpdir(), 'rbs-v1-archive-'));
let server, browser;
try {
  const manifest = JSON.parse(
    await readFile(join(root, 'archive/v1.11.2/provenance.json'), 'utf8')
  );
  const response = await globalThis.fetch(
    'https://registry.npmjs.org/react-broadcast-sync/-/react-broadcast-sync-1.11.2.tgz'
  );
  assert.ok(response.ok);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(
    'sha512-' + createHash('sha512').update(bytes).digest('base64'),
    manifest.npmIntegrity
  );
  await writeFile(join(temp, 'package.tgz'), bytes);
  execFileSync('tar', ['-xzf', join(temp, 'package.tgz'), '-C', temp]);
  await symlink(join(repo, 'node_modules'), join(temp, 'node_modules'));
  for (const [page, name] of [
    ['getting-started', 'Greeting'],
    ['provider', 'Provider'],
  ]) {
    const source = await readFile(join(root, `src/content/docs/v1/${page}.md`), 'utf8');
    await writeFile(join(temp, `${name}.tsx`), source.match(/```tsx\n([\s\S]*?)```/)[1]);
  }
  await writeFile(
    join(temp, 'index.html'),
    '<div id="root"></div><script type="module" src="/main.tsx"></script>'
  );
  await writeFile(
    join(temp, 'main.tsx'),
    `
import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import Greeting from './Greeting'; import Provider from './Provider';
function Harness() {const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);
return <><span data-ready={ready}/>{location.search.includes('provider')?<Provider/>:<Greeting/>}</>;}
createRoot(document.getElementById('root')!).render(<Harness/>);`
  );
  server = await createServer({
    configFile: false,
    root: temp,
    logLevel: 'error',
    esbuild: { jsx: 'automatic' },
    resolve: { alias: { 'react-broadcast-sync': join(temp, 'package/dist/index.esm.js') } },
    server: { host: '127.0.0.1', port: 0, fs: { allow: [temp, repo] } },
  });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  browser = await chromium.launch();
  const context = await browser.newContext();
  const telemetry = [];
  context.on('request', request => {
    if (/mixpanel/.test(request.url())) telemetry.push(request.url());
  });
  const page = async (suffix = '') => {
    const page = await context.newPage();
    await page.goto(url + suffix);
    await page.locator('[data-ready="true"]').waitFor({ state: 'attached' });
    return page;
  };
  const a = await page(),
    b = await page();
  await a.getByRole('button', { name: 'Send', exact: true }).click();
  await b.getByText('Hello!', { exact: true }).waitFor();
  assert.equal(await a.getByText('Hello!', { exact: true }).count(), 0);
  await b.getByRole('button', { name: 'Send', exact: true }).click();
  await a.getByText('Hello!', { exact: true }).waitFor();
  assert.equal(await b.getByText('Hello!', { exact: true }).count(), 1);
  const late = await page();
  assert.equal(await late.getByText('Hello!', { exact: true }).count(), 0);
  // The provider example intentionally uses a different channel. Exercise it with a native peer.
  const provider = await page('?provider');
  await a.evaluate(() => {
    const peer = new globalThis.BroadcastChannel('notifications');
    peer.postMessage({
      id: 'provider-check',
      type: 'greeting',
      message: { text: 'Provider received' },
      source: 'peer',
      timestamp: Date.now(),
    });
    peer.close();
  });
  await provider.getByText('Provider received', { exact: true }).waitFor();
  assert.deepEqual(telemetry, []);
  console.log(
    'Published1.11.2 integrity and actual archive examples pass: bidirectional delivery, self exclusion, late-tab no replay, provider reception, telemetry opt-out.'
  );
} finally {
  await browser?.close();
  await server?.close();
  await rm(temp, { recursive: true, force: true });
}
