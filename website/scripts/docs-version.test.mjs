import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { docsVersion } from '../src/docs-version.mjs';

test('published docs release belongs to the labelled major', () => {
  assert.equal(Number(docsVersion.latestRelease.split('.')[0]), docsVersion.major);
  assert.equal(docsVersion.label, `v${docsVersion.major}`);
  assert.equal(docsVersion.range, `>=${docsVersion.major}.0.0 <${docsVersion.major + 1}.0.0`);
});
test('public docs identify scope, minor availability, and a real historical archive', () => {
  const policy = readFileSync(
    new URL('../src/content/docs/changelog.mdx', import.meta.url),
    'utf8'
  );
  assert.ok(policy.includes(docsVersion.latestRelease));
  assert.match(policy, /2\.2\.0\+/);
  assert.match(policy, /read-only v1\.11\.2 archive/);
  assert.match(policy, /unreleased/);
});
