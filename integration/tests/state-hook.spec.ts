import { test, expect } from '@playwright/test';

test('draft hook joins and shares state under real React StrictMode, then isolates a key change', async ({
  context,
}) => {
  const a = await context.newPage();
  const b = await context.newPage();
  await a.goto('/?draftState=1&channel=strict-native');
  await a.getByTestId('state-input').fill('saved');
  await expect(a.getByTestId('state-value')).toHaveText('saved');
  await b.goto('/?draftState=1&channel=strict-native');
  await expect(b.getByTestId('state-value')).toHaveText('saved');
  await b.getByTestId('state-input').fill('from b');
  await expect(a.getByTestId('state-value')).toHaveText('from b');
  await b.getByTestId('state-change-key').click();
  await expect(b.getByTestId('state-value')).toHaveText('fallback');
  await a.getByTestId('state-input').fill('isolated');
  await b.getByTestId('state-sync').click();
  await expect(b.getByTestId('state-result')).toHaveText('no-peer');
  await expect(b.getByTestId('state-value')).toHaveText('fallback');
  await expect(a.getByTestId('state-error')).toBeEmpty();
  await expect(b.getByTestId('state-error')).toBeEmpty();
});
