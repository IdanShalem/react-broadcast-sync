import { test, expect, BrowserContext, Page } from '@playwright/test';

interface DraftTabOptions {
  channel: string;
  recovery?: 'manual' | 'auto';
  maxRecoveryAttempts?: number;
}

async function openDraftTab(context: BrowserContext, options: DraftTabOptions): Promise<Page> {
  const params = new URLSearchParams({
    draftState: '1',
    recoveryLab: '1',
    channel: options.channel,
  });
  if (options.recovery) params.set('recovery', options.recovery);
  if (options.maxRecoveryAttempts !== undefined)
    params.set('maxRecoveryAttempts', String(options.maxRecoveryAttempts));
  const page = await context.newPage();
  await page.goto(`/?${params.toString()}`);
  await expect(page.getByTestId('state-value')).toBeVisible();
  return page;
}

test('a killed state channel recovers on the next write, resyncs and both tabs converge', async ({
  context,
}) => {
  // no recovery option: automatic recovery is the default policy
  const tabA = await openDraftTab(context, { channel: 'state-reco' });
  const tabB = await openDraftTab(context, { channel: 'state-reco' });

  await tabB.getByTestId('state-input').fill('before-kill');
  await expect(tabA.getByTestId('state-value')).toHaveText('before-kill');

  // Close the channel tab A holds, out of band, then update from tab B.
  await tabA.getByTestId('kill-held-channel').click();
  await tabB.getByTestId('state-input').fill('while-down');
  await expect(tabB.getByTestId('state-value')).toHaveText('while-down');
  // Tab A provably missed the update made while its channel was dead.
  await expect(tabA.getByTestId('state-value')).toHaveText('before-kill');

  // A's next write fails on the dead channel, recovers, retries and resyncs.
  await tabA.getByTestId('state-input').fill('a-edit');
  await expect(tabA.getByTestId('state-recovered-count')).toHaveText('1');

  // Logical last-write-wins picks one deterministic winner on both tabs.
  const winner = (await tabA.getByTestId('state-value').textContent()) ?? '';
  expect(['while-down', 'a-edit']).toContain(winner);
  await expect(tabB.getByTestId('state-value')).toHaveText(winner);
  await expect(tabA.getByTestId('state-error')).toBeEmpty();
});

test("an explicit 'manual' opt-out does not recover; explicit reconnect resyncs", async ({
  context,
}) => {
  const tabA = await openDraftTab(context, { channel: 'state-manual', recovery: 'manual' });
  const tabB = await openDraftTab(context, { channel: 'state-manual' });

  await tabB.getByTestId('state-input').fill('peer-value');
  await expect(tabA.getByTestId('state-value')).toHaveText('peer-value');

  await tabA.getByTestId('kill-held-channel').click();
  await tabA.getByTestId('state-input').fill('lost-edit');

  // No automatic recovery: the write failed, the error is reported and the
  // controlled input keeps the last committed value.
  await expect(tabA.getByTestId('state-recovered-count')).toHaveText('0');
  await expect(tabA.getByTestId('state-error')).not.toBeEmpty();
  await expect(tabA.getByTestId('state-value')).toHaveText('peer-value');
  await expect(tabB.getByTestId('state-value')).toHaveText('peer-value');

  // Explicit reconnect recreates the channel and resyncs from the peer.
  await tabB.getByTestId('state-input').fill('peer-newer');
  await tabA.getByTestId('state-reconnect').click();
  await expect(tabA.getByTestId('state-value')).toHaveText('peer-newer');
  await expect(tabA.getByTestId('state-recovered-count')).toHaveText('0');
});
