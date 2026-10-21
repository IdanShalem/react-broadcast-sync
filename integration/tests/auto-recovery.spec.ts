import { test, expect, BrowserContext, Page } from '@playwright/test';

interface LabTabOptions {
  source: string;
  channel?: string;
  recovery?: 'manual' | 'auto';
  maxRecoveryAttempts?: number;
}

async function openLabTab(context: BrowserContext, options: LabTabOptions): Promise<Page> {
  const params = new URLSearchParams({
    recoveryLab: '1',
    source: options.source,
    channel: options.channel ?? 'recovery-lab',
    batchingDelayMs: '0',
  });
  if (options.recovery) params.set('recovery', options.recovery);
  if (options.maxRecoveryAttempts !== undefined)
    params.set('maxRecoveryAttempts', String(options.maxRecoveryAttempts));
  const page = await context.newPage();
  await page.goto(`/?${params.toString()}`);
  await expect(page.getByTestId('source-name')).toBeVisible();
  return page;
}

async function sendChat(page: Page, content: string) {
  await page.getByTestId('type-input').fill('chat');
  await page.getByTestId('content-input').fill(content);
  await page.getByTestId('send').click();
}

test('an out-of-band close of the held channel recovers automatically and the send is delivered exactly once', async ({
  context,
}) => {
  // no recovery option: automatic recovery is the default policy
  const tabA = await openLabTab(context, { source: 'tab-a' });
  const tabB = await openLabTab(context, { source: 'tab-b' });

  await sendChat(tabA, 'before-kill');
  await expect(tabB.getByTestId('received')).toContainText('before-kill');

  // Close the channel the SENDING hook holds, out of band, then send from it.
  await tabA.getByTestId('kill-held-channel').click();
  await sendChat(tabA, 'after-kill');

  const receivedAfterKill = tabB.getByTestId('received').locator('li', { hasText: 'after-kill' });
  await expect(receivedAfterKill).toHaveCount(1);
  await expect(tabA.getByTestId('recovered-count')).toHaveText('1');
  await expect(tabA.getByTestId('error')).toHaveCount(0);
});

test("an explicit 'manual' opt-out does not recover from an out-of-band close", async ({
  context,
}) => {
  const tabA = await openLabTab(context, { source: 'tab-a', recovery: 'manual' });
  const tabB = await openLabTab(context, { source: 'tab-b' });

  await tabA.getByTestId('kill-held-channel').click();
  await sendChat(tabA, 'no-recovery');

  await expect(tabA.getByTestId('error')).toBeVisible();
  await expect(tabB.getByTestId('received')).not.toContainText('no-recovery');
  await expect(tabA.getByTestId('recovered-count')).toHaveText('0');
});

test('failed recreations exhaust the budget, then explicit reconnect rescues', async ({
  context,
}) => {
  const tabA = await openLabTab(context, {
    source: 'tab-a',
    recovery: 'auto',
    maxRecoveryAttempts: 2,
  });
  const tabB = await openLabTab(context, { source: 'tab-b' });

  await tabA.getByTestId('arm-born-dead').click();
  await tabA.getByTestId('kill-held-channel').click();
  await sendChat(tabA, 'x1'); // failed recovery attempt 1
  await sendChat(tabA, 'x2'); // failed recovery attempt 2
  await sendChat(tabA, 'x3'); // cap reached: dead ref dropped
  await sendChat(tabA, 'x4'); // down-channel signal
  await expect(tabA.getByTestId('error')).toHaveText(
    'BroadcastChannel is closed. Call reconnect() to open it again.'
  );
  await expect(tabA.getByTestId('recovered-count')).toHaveText('0');
  await expect(tabB.getByTestId('received')).not.toContainText('x1');
  await expect(tabB.getByTestId('received')).not.toContainText('x4');

  await tabA.getByTestId('heal-born-dead').click();
  await tabA.getByTestId('reconnect').click();
  await sendChat(tabA, 'rescued');
  await expect(tabB.getByTestId('received').locator('li', { hasText: 'rescued' })).toHaveCount(1);
});
