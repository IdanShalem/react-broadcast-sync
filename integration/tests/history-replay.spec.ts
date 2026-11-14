import { test, expect, BrowserContext, Page } from '@playwright/test';

async function openTab(context: BrowserContext, source: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`/?source=${source}&batchingDelayMs=0`);
  await expect(page.getByTestId('source-name')).toBeVisible();
  return page;
}

async function sendMessage(page: Page, type: string, content: string) {
  await page.getByTestId('type-input').fill(type);
  await page.getByTestId('content-input').fill(content);
  await page.getByTestId('send').click();
}

test('a filtered clear blocks only the cleared messages from history replay', async ({
  context,
}) => {
  // tabB posts an 'alert' before tabA opens, so tabA never holds it live
  const tabB = await openTab(context, 'tab-b');
  await sendMessage(tabB, 'alert', 'early');

  const tabA = await openTab(context, 'tab-a');
  await sendMessage(tabB, 'chat', 'spam');

  // tabA received only the chat message
  await expect(tabA.getByTestId('received')).toContainText('tab-b|chat|spam');
  await expect(tabA.getByTestId('received')).not.toContainText('alert');

  // Filtered clear: only 'chat' is cleared locally
  await tabA.getByTestId('type-input').fill('chat');
  await tabA.getByTestId('clear-received-by-type').click();
  await expect(tabA.getByTestId('received')).not.toContainText('spam');

  // History replay: the cleared chat stays blocked, but the older alert that
  // tabA never cleared must still be offered by tabB
  await tabA.getByTestId('request-history').click();
  await expect(tabA.getByTestId('received')).toContainText('tab-b|alert|early');
  await expect(tabA.getByTestId('received')).not.toContainText('spam');
});
