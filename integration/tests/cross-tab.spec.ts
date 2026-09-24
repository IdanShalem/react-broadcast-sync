import { test, expect, BrowserContext, Page } from '@playwright/test';

interface TabOptions {
  channel?: string;
  namespace?: string;
  source?: string;
  types?: string;
  cleaningInterval?: number;
}

async function openTab(context: BrowserContext, options: TabOptions = {}): Promise<Page> {
  const params = new URLSearchParams();
  if (options.channel) params.set('channel', options.channel);
  if (options.namespace) params.set('namespace', options.namespace);
  if (options.source) params.set('source', options.source);
  if (options.types) params.set('types', options.types);
  if (options.cleaningInterval) params.set('cleaningInterval', String(options.cleaningInterval));
  const page = await context.newPage();
  await page.goto(`/?${params.toString()}`);
  await expect(page.getByTestId('source-name')).toBeVisible();
  return page;
}

async function sendMessage(page: Page, type: string, content: string, expiring = false) {
  await page.getByTestId('type-input').fill(type);
  await page.getByTestId('content-input').fill(content);
  await page.getByTestId(expiring ? 'send-expiring' : 'send').click();
}

function receivedEntry(source: string, type: string, content: string) {
  return `${source}|${type}|${content}`;
}

test('a message posted in one tab is received in another tab on the same channel', async ({
  context,
}) => {
  const tabA = await openTab(context, { source: 'tab-a' });
  const tabB = await openTab(context, { source: 'tab-b' });

  await sendMessage(tabA, 'chat', 'hello from A');

  await expect(tabB.getByTestId('received')).toContainText(
    receivedEntry('tab-a', 'chat', 'hello from A')
  );
  await expect(tabA.getByTestId('sent')).toContainText(
    receivedEntry('tab-a', 'chat', 'hello from A')
  );
});

test('a tab never receives its own messages', async ({ context }) => {
  const tabA = await openTab(context, { source: 'tab-a' });
  await openTab(context, { source: 'tab-b' });

  await sendMessage(tabA, 'chat', 'self check');

  await expect(tabA.getByTestId('sent')).toContainText(
    receivedEntry('tab-a', 'chat', 'self check')
  );
  // Give the message a moment to (incorrectly) arrive before asserting absence.
  await tabA.waitForTimeout(300);
  await expect(tabA.getByTestId('received')).toBeEmpty();
});

test('sync is bidirectional between tabs', async ({ context }) => {
  const tabA = await openTab(context, { source: 'tab-a' });
  const tabB = await openTab(context, { source: 'tab-b' });

  await sendMessage(tabA, 'chat', 'ping from A');
  await sendMessage(tabB, 'chat', 'pong from B');

  await expect(tabB.getByTestId('received')).toContainText(
    receivedEntry('tab-a', 'chat', 'ping from A')
  );
  await expect(tabA.getByTestId('received')).toContainText(
    receivedEntry('tab-b', 'chat', 'pong from B')
  );
});

test('tabs in a different namespace are isolated', async ({ context }) => {
  const tabA = await openTab(context, { source: 'tab-a' });
  const tabB = await openTab(context, { source: 'tab-b', namespace: 'other' });

  await sendMessage(tabA, 'chat', 'namespace check');

  await tabA.waitForTimeout(300);
  await expect(tabB.getByTestId('received')).toBeEmpty();
});

test('registeredTypes filters out unregistered message types', async ({ context }) => {
  const tabA = await openTab(context, { source: 'tab-a' });
  const tabB = await openTab(context, { source: 'tab-b', types: 'chat' });

  await sendMessage(tabA, 'alert', 'should be filtered');
  await sendMessage(tabA, 'chat', 'should arrive');

  await expect(tabB.getByTestId('received')).toContainText(
    receivedEntry('tab-a', 'chat', 'should arrive')
  );
  await expect(tabB.getByTestId('received')).not.toContainText('should be filtered');
});

test('ping discovers active sources in other tabs', async ({ context }) => {
  const tabA = await openTab(context, { source: 'tab-a' });
  await openTab(context, { source: 'tab-b' });

  await tabA.getByTestId('ping').click();

  await expect(tabA.getByTestId('ping-result')).toHaveText('tab-b');
});

test('clearSentMessages with sync removes the messages from other tabs', async ({ context }) => {
  const tabA = await openTab(context, { source: 'tab-a' });
  const tabB = await openTab(context, { source: 'tab-b' });

  await sendMessage(tabA, 'chat', 'about to be cleared');
  await expect(tabB.getByTestId('received')).toContainText(
    receivedEntry('tab-a', 'chat', 'about to be cleared')
  );

  await tabA.getByTestId('clear-sent-sync').click();

  await expect(tabA.getByTestId('sent')).toBeEmpty();
  await expect(tabB.getByTestId('received')).toBeEmpty();
});

test('clearReceivedMessages only clears the local tab', async ({ context }) => {
  const tabA = await openTab(context, { source: 'tab-a' });
  const tabB = await openTab(context, { source: 'tab-b' });
  const tabC = await openTab(context, { source: 'tab-c' });

  await sendMessage(tabA, 'chat', 'still here');
  await expect(tabB.getByTestId('received')).toContainText(
    receivedEntry('tab-a', 'chat', 'still here')
  );
  await expect(tabC.getByTestId('received')).toContainText(
    receivedEntry('tab-a', 'chat', 'still here')
  );

  await tabB.getByTestId('clear-received').click();

  await expect(tabB.getByTestId('received')).toBeEmpty();
  await expect(tabC.getByTestId('received')).toContainText(
    receivedEntry('tab-a', 'chat', 'still here')
  );
});

test('expired messages are removed from receiving tabs', async ({ context }) => {
  const tabA = await openTab(context, { source: 'tab-a' });
  const tabB = await openTab(context, { source: 'tab-b', cleaningInterval: 100 });

  await sendMessage(tabA, 'chat', 'short lived', true);
  await expect(tabB.getByTestId('received')).toContainText(
    receivedEntry('tab-a', 'chat', 'short lived')
  );

  await expect(tabB.getByTestId('received')).toBeEmpty({ timeout: 5000 });
});
