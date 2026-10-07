// Site analytics for the live demos (not part of the npm package).
// Sends anonymous events to Mixpanel (EU) with a plain fetch: no cookies, no
// localStorage, no persisted ID, IP geolocation off. Does nothing unless
// MIXPANEL_TOKEN was set at build time. Independent of the library.

const ENDPOINT = 'https://api-eu.mixpanel.com/track?ip=0';
declare const __MIXPANEL_TOKEN__: string | undefined;
const TOKEN: string = typeof __MIXPANEL_TOKEN__ === 'string' ? __MIXPANEL_TOKEN__ : '';

// Random per page load, never stored.
const sessionId =
  globalThis.crypto?.randomUUID?.() ??
  Math.random().toString(36).slice(2) + Date.now().toString(36);

let demo: 'hook' | 'provider' | null = null;

export function initAnalytics(which: 'hook' | 'provider'): void {
  demo = which;
  track('demo_loaded', { entry: which === 'hook' ? 'useBroadcastChannel' : 'BroadcastProvider' });
}

export function track(event: string, props: Record<string, unknown> = {}): void {
  if (!TOKEN || typeof fetch === 'undefined') return;
  const body = JSON.stringify([
    {
      event,
      properties: {
        token: TOKEN,
        distinct_id: sessionId,
        time: Math.floor(Date.now() / 1000),
        app: 'demo',
        demo,
        entry:
          demo === 'hook'
            ? 'useBroadcastChannel'
            : demo === 'provider'
              ? 'BroadcastProvider'
              : undefined,
        ...props,
      },
    },
  ]);
  // text/plain keeps this a simple CORS request (no preflight).
  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body,
    keepalive: true,
  }).catch(() => {});
}

/** Debounce for noisy inputs: fires once after the user stops typing. */
export function trackDebounced(
  key: string,
  delayMs: number,
  event: string,
  props: Record<string, unknown>
): void {
  const t = timers.get(key);
  if (t) clearTimeout(t);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      track(event, props);
    }, delayMs)
  );
}
const timers = new Map<string, ReturnType<typeof setTimeout>>();
