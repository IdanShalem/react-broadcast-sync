import { test, expect, Page } from '@playwright/test';
import path from 'node:path';
import type { createStateSession } from '../../src/utils/stateSession';

type Session = ReturnType<typeof createStateSession<string>>;
declare global {
  interface Window {
    draftSession: Session;
    draftChanges: string[];
    draftErrors: string[];
  }
}

/** Native transport test only; this is not a package export or React API. */
const openSession = async (page: Page, name: string, key = 'filters') => {
  await page.goto('/');
  await page.evaluate(
    async ({ name, key, moduleUrl }) => {
      const { createStateSession } = (await import(moduleUrl)) as {
        createStateSession: typeof import('../../src/utils/stateSession').createStateSession;
      };
      window.draftChanges = [];
      window.draftErrors = [];
      window.draftSession = createStateSession(
        key,
        'fallback',
        new BroadcastChannel(name),
        state => window.draftChanges.push(state.value),
        error => window.draftErrors.push(String(error))
      );
    },
    { name, key, moduleUrl: `/@fs${path.resolve('src/utils/stateSession.ts')}` }
  );
};
const value = (page: Page) => page.evaluate(() => window.draftSession.getSnapshot().value);

test('a late native tab joins the written value and receivers do not rebroadcast', async ({
  context,
}) => {
  const a = await context.newPage();
  const b = await context.newPage();
  await openSession(a, 'draft-late');
  await a.evaluate(() => window.draftSession.setValue('saved before join'));
  await openSession(b, 'draft-late');
  expect(await value(b)).toBe('fallback');
  expect(await b.evaluate(() => window.draftSession.sync(150))).toBe('received');
  expect(await value(b)).toBe('saved before join');
  await b.evaluate(() => window.draftSession.setValue('live change'));
  await expect.poll(() => value(a)).toBe('live change');
  expect(await a.evaluate(() => window.draftErrors)).toEqual([]);
  expect(await b.evaluate(() => window.draftErrors)).toEqual([]);
  await a.evaluate(() => window.draftSession.dispose());
  await b.evaluate(() => window.draftSession.dispose());
});

test('keys isolate native peers and no peer does not claim successful sync', async ({
  context,
}) => {
  const a = await context.newPage();
  const b = await context.newPage();
  await openSession(a, 'draft-keys', 'a');
  await openSession(b, 'draft-keys', 'b');
  await a.evaluate(() => window.draftSession.setValue('private to key a'));
  expect(await b.evaluate(() => window.draftSession.sync(150))).toBe('no-peer');
  expect(await value(b)).toBe('fallback');
  await a.evaluate(() => window.draftSession.dispose());
  await b.evaluate(() => window.draftSession.dispose());
});

test('concurrent native writes converge to the same deterministic winner', async ({ context }) => {
  const a = await context.newPage();
  const b = await context.newPage();
  await openSession(a, 'draft-concurrent');
  await openSession(b, 'draft-concurrent');
  // Queue both writes at one future instant; either delivery order is legal.
  const at = Date.now() + 150;
  await Promise.all(
    [a, b].map((page, i) =>
      page.evaluate(
        ({ at, i }) =>
          new Promise<void>(resolve => {
            setTimeout(
              () => {
                window.draftSession.setValue(`edit-${i}`);
                resolve();
              },
              Math.max(0, at - Date.now())
            );
          }),
        { at, i }
      )
    )
  );
  await expect.poll(async () => (await value(a)) === (await value(b))).toBe(true);
  expect(await value(a)).toMatch(/^edit-[01]$/);
  await a.evaluate(() => window.draftSession.dispose());
  await b.evaluate(() => window.draftSession.dispose());
});

test('disposal cancels sync and a replacement native connection starts fresh', async ({ page }) => {
  await openSession(page, 'draft-dispose');
  expect(
    await page.evaluate(async () => {
      const pending = window.draftSession.sync(1000);
      window.draftSession.dispose();
      return pending;
    })
  ).toBe('cancelled');
  expect(await page.evaluate(() => window.draftSession.setValue('after close'))).toBe(false);
  await openSession(page, 'draft-dispose');
  expect(await value(page)).toBe('fallback');
  expect(await page.evaluate(() => window.draftSession.sync(100))).toBe('no-peer');
  await page.evaluate(() => window.draftSession.dispose());
});
