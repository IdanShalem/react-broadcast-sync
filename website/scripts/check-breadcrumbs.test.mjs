import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBreadcrumbs } from './check-breadcrumbs.mjs';

const home = { position: 1, name: 'Docs', item: 'https://example.com/' };
test('rejects a middle heading without a real page URL', () => {
  assert.throws(
    () =>
      validateBreadcrumbs(
        { itemListElement: [home, { position: 2, name: 'Guides' }, { position: 3, name: 'Hook' }] },
        'fixture'
      ),
    /missing item/
  );
});
test('allows item omission on the final crumb only', () => {
  assert.doesNotThrow(() =>
    validateBreadcrumbs({ itemListElement: [home, { position: 2, name: 'Hook' }] }, 'fixture')
  );
});
test('rejects nonconsecutive positions', () => {
  assert.throws(
    () =>
      validateBreadcrumbs({ itemListElement: [home, { position: 3, name: 'Hook' }] }, 'fixture'),
    /invalid crumb/
  );
});
