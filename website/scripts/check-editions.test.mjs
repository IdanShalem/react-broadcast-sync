import test from 'node:test';
import { URL } from 'node:url';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { archivePages, archiveCommit, editionTarget, isArchivePath } from '../src/editions.mjs';
const root = new URL('../archive/v1.11.2/', import.meta.url);

test('frozen historical sources match provenance', () => {
  const manifest = JSON.parse(readFileSync(new URL('provenance.json', root), 'utf8'));
  assert.equal(manifest.commit, archiveCommit);
  for (const [file, sha] of Object.entries(manifest.files)) {
    assert.equal(
      createHash('sha256')
        .update(readFileSync(new URL(file, root)))
        .digest('hex'),
      sha
    );
  }
  const exports = readFileSync(new URL('index.ts.txt', root), 'utf8');
  assert.ok(!exports.includes('useSyncedState'));
  assert.match(readFileSync(new URL('types.ts.txt', root), 'utf8'), /telemetry\?: boolean/);
});
test('selector maps only real equivalents and explains fallback', () => {
  assert.equal(editionTarget('/api/use-broadcast-channel/', 'v1'), '/v1/api/');
  assert.equal(editionTarget('/api/use-synced-state/', 'v1'), '/v1/#no-equivalent-page');
  assert.equal(editionTarget('/v1/provider/', 'v2'), '/api/broadcast-provider/');
  assert.equal(isArchivePath('/v1fake/'), false);
  for (const page of archivePages) assert.ok(isArchivePath(page.href));
});
test('every archive page warns, pins historical sources, and avoids v2 demos', () => {
  const dir = new URL('../src/content/docs/v1/', import.meta.url);
  for (const file of readdirSync(dir)) {
    const text = readFileSync(new URL(file, dir), 'utf8');
    assert.match(text, /Read-only v1\.11\.2 archive/);
    assert.match(text, new RegExp(archiveCommit));
    assert.ok(!text.includes('](/demos/'));
    assert.ok(!/npm install react-broadcast-sync\n/.test(text));
  }
});
