import { test, expect } from '@playwright/test';

test('local UI and peer update before save, without peer save or rebroadcast', async ({
  context,
}) => {
  let saves = 0;
  let finishSave = () => {};
  const hold = new Promise<void>(resolve => {
    finishSave = resolve;
  });
  await context.route('**/api/tasks/write-docs/complete', async route => {
    saves++;
    await hold;
    await route.fulfill({ status: 204 });
  });
  const a = await context.newPage();
  const b = await context.newPage();
  await a.goto('/?optimisticTask');
  await b.goto('/?optimisticTask');
  await a.getByRole('button', { name: 'Complete task' }).click();
  await expect(a.getByText('Write the docs: Complete', { exact: true })).toBeVisible();
  await expect(a.getByRole('status')).toHaveText('Saving in this tab');
  await expect(b.getByRole('status')).toHaveText('Completion received from another connection');
  await expect(b.getByText('Write the docs: Complete', { exact: true })).toBeVisible();
  expect(saves).toBe(1);
  finishSave();
  await expect(a.getByRole('status')).toHaveText('Saved by this tab');
  await expect(b.getByRole('status')).toHaveText('Completion received from another connection');
  // Positive server-result barrier: A would change to received status if B echoed.
  expect(saves).toBe(1);
  const late = await context.newPage();
  await late.goto('/?optimisticTask');
  await expect(late.getByText('Write the docs: Incomplete', { exact: true })).toBeVisible();
});

test('failed save is local and never presented as peer server confirmation', async ({
  context,
}) => {
  await context.route('**/api/tasks/write-docs/complete', route => route.fulfill({ status: 500 }));
  const a = await context.newPage();
  const b = await context.newPage();
  await a.goto('/?optimisticTask');
  await b.goto('/?optimisticTask');
  await a.getByRole('button', { name: 'Complete task' }).click();
  await expect(a.getByRole('status')).toHaveText(
    'Save failed: reload authoritative data before retrying'
  );
  await expect(b.getByRole('status')).toHaveText('Completion received from another connection');
  await expect(a.getByText('Write the docs: Complete', { exact: true })).toBeVisible();
  await expect(b.getByText('Write the docs: Complete', { exact: true })).toBeVisible();
});
