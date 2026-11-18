import { test, expect, BrowserContext, Page } from '@playwright/test';

interface TabOptions {
  channel?: string;
  source?: string;
  batchingDelayMs?: number;
  recoveryLab?: boolean;
}

async function openTab(context: BrowserContext, options: TabOptions = {}): Promise<Page> {
  const params = new URLSearchParams();
  if (options.channel) params.set('channel', options.channel);
  if (options.source) params.set('source', options.source);
  if (options.batchingDelayMs !== undefined)
    params.set('batchingDelayMs', String(options.batchingDelayMs));
  if (options.recoveryLab) params.set('recoveryLab', '1');
  const page = await context.newPage();
  await page.goto(`/?${params.toString()}`);
  await expect(page.getByTestId('source-name')).toBeVisible();
  return page;
}

test('an awaited send resolves and the other tab receives the message', async ({ context }) => {
  const tabA = await openTab(context, { source: 'tab-a', channel: 'awaited-basic' });
  const tabB = await openTab(context, { source: 'tab-b', channel: 'awaited-basic' });

  await tabA.getByTestId('type-input').fill('chat');
  await tabA.getByTestId('content-input').fill('hello awaited');
  await tabA.getByTestId('send-awaited').click();

  await expect(tabA.getByTestId('send-outcome')).toContainText('resolved:');
  await expect(tabB.getByTestId('received')).toContainText('tab-a|chat|hello awaited');
});

test('an awaited send resolves through automatic recovery after the channel dies', async ({
  context,
}) => {
  const tabA = await openTab(context, {
    source: 'tab-a',
    channel: 'awaited-recovery',
    batchingDelayMs: 0,
    recoveryLab: true,
  });

  await tabA.getByTestId('kill-held-channel').click();
  await tabA.getByTestId('type-input').fill('chat');
  await tabA.getByTestId('content-input').fill('recovered send');
  await tabA.getByTestId('send-awaited').click();

  await expect(tabA.getByTestId('send-outcome')).toContainText('resolved:');
  await expect(tabA.getByTestId('recovered-count')).toHaveText('1');
});

test('an awaited send rejects with DataCloneError for an unclonable payload', async ({
  context,
}) => {
  const tabA = await openTab(context, {
    source: 'tab-a',
    channel: 'awaited-unclonable',
    batchingDelayMs: 0,
  });

  await tabA.getByTestId('send-awaited-unclonable').click();

  await expect(tabA.getByTestId('send-outcome')).toContainText('rejected:DataCloneError');
});

test('an awaited send rejects after the channel was closed', async ({ context }) => {
  const tabA = await openTab(context, {
    source: 'tab-a',
    channel: 'awaited-closed',
    batchingDelayMs: 0,
  });

  await tabA.getByTestId('close').click();
  await tabA.getByTestId('type-input').fill('chat');
  await tabA.getByTestId('content-input').fill('too late');
  await tabA.getByTestId('send-awaited').click();

  await expect(tabA.getByTestId('send-outcome')).toContainText('rejected:');
});

test('a pending awaited send settles when closeChannel flushes the batch', async ({ context }) => {
  const tabA = await openTab(context, {
    source: 'tab-a',
    channel: 'awaited-flush',
    batchingDelayMs: 60000,
  });
  const tabB = await openTab(context, {
    source: 'tab-b',
    channel: 'awaited-flush',
    batchingDelayMs: 60000,
  });

  await tabA.getByTestId('type-input').fill('chat');
  await tabA.getByTestId('content-input').fill('flushed on close');
  await tabA.getByTestId('send-awaited').click();
  await expect(tabA.getByTestId('send-outcome')).toHaveText('pending');

  await tabA.getByTestId('close').click();

  await expect(tabA.getByTestId('send-outcome')).toContainText('resolved:');
  await expect(tabB.getByTestId('received')).toContainText('tab-a|chat|flushed on close');
});
