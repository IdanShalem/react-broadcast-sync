import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('generated docs survive release version bumps but still detect content drift', () => {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'rbs-llms-'));
  try {
    mkdirSync(path.join(fixture, 'scripts'));
    for (const file of ['README.md', 'package.json', 'scripts/generate-llms-txt.mjs']) {
      copyFileSync(path.join(root, file), path.join(fixture, file));
    }
    const run = (...args) =>
      spawnSync(process.execPath, ['scripts/generate-llms-txt.mjs', ...args], {
        cwd: fixture,
        encoding: 'utf8',
      });
    assert.equal(run().status, 0);
    const original = readFileSync(path.join(fixture, 'llms.txt'), 'utf8');
    const pkgPath = path.join(fixture, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    pkg.version = '99.0.0';
    writeFileSync(pkgPath, JSON.stringify(pkg));
    assert.equal(run('--check').status, 0, 'version-only changes must not cause drift');
    assert.equal(run().status, 0);
    assert.equal(readFileSync(path.join(fixture, 'llms.txt'), 'utf8'), original);
    const readmePath = path.join(fixture, 'README.md');
    const readme = readFileSync(readmePath, 'utf8');
    writeFileSync(
      readmePath,
      readme.replace('## Gotchas', '## Gotchas\n\nRegression-test documentation change.')
    );
    const stale = run('--check');
    assert.equal(stale.status, 1, 'README content changes must still fail the drift check');
    assert.match(stale.stderr, /llms.txt is out of date/);
    assert.equal(run().status, 0);
    assert.equal(run('--check').status, 0);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
