import { test, expect, Locator } from '@playwright/test';

async function send(hook: Locator, content: string) {
  await hook.getByTestId('content-input').fill(content);
  await hook.getByTestId('send').click();
  await expect(hook.getByTestId('sent')).toContainText(content);
}

test('different sources on one page exchange messages without self-echo', async ({ page }) => {
  await page.goto('/?multiHook&batchingDelayMs=0');
  const first = page.getByTestId('hook-a');
  const second = page.getByTestId('hook-b');
  await send(first, 'from first');
  await expect(second.getByTestId('received')).toHaveText('hook-a|chat|from first');
  await send(second, 'from second');
  await expect(first.getByTestId('received')).toHaveText('hook-b|chat|from second');
  await expect(second.getByTestId('received')).toHaveText('hook-a|chat|from first');
});

test('equal sources on one page are filtered while a different source is received', async ({
  page,
  context,
}) => {
  await page.goto('/?multiHook&sameSource&batchingDelayMs=0');
  const first = page.getByTestId('hook-a');
  const second = page.getByTestId('hook-b');
  await send(first, 'filtered first');
  await send(second, 'filtered second');
  const observer = await context.newPage();
  await observer.goto('/?source=observer&batchingDelayMs=0');
  await observer.getByTestId('content-input').fill('external marker');
  await observer.getByTestId('send').click();
  // A positive delivery barrier avoids relying only on a timed absence check.
  await expect(first.getByTestId('received')).toHaveText('observer|chat|external marker');
  await expect(second.getByTestId('received')).toHaveText('observer|chat|external marker');
});

for (const action of ['close', 'unmount'] as const) {
  test(`the other hook still sends and receives after one hook ${action}s`, async ({
    page,
    context,
  }) => {
    await page.goto('/?multiHook&batchingDelayMs=0');
    const first = page.getByTestId('hook-a');
    const second = page.getByTestId('hook-b');
    await send(first, 'before cleanup');
    await expect(second.getByTestId('received')).toHaveText('hook-a|chat|before cleanup');
    if (action === 'close') await first.getByTestId('close').click();
    else await page.getByTestId('unmount-first').click();
    const observer = await context.newPage();
    await observer.goto('/?source=observer&batchingDelayMs=0');
    await send(second, 'survivor message');
    await expect(observer.getByTestId('received')).toHaveText('hook-b|chat|survivor message');
    await observer.getByTestId('content-input').fill('observer reply');
    await observer.getByTestId('send').click();
    await expect(second.getByTestId('received')).toContainText('observer|chat|observer reply');
    if (action === 'close') await expect(first.getByTestId('received')).toBeEmpty();
    else await expect(first.getByTestId('source-name')).toHaveCount(0);
  });
}
