// Token is injected at build time via @rollup/plugin-replace from .env
// In test environments this will be undefined, which gracefully disables sending.
declare const process: { env: { MIXPANEL_TOKEN?: string } };
let MIXPANEL_TOKEN: string = process.env.MIXPANEL_TOKEN ?? '';

const MIXPANEL_ENDPOINT = 'https://api.mixpanel.com/track';
const FLUSH_INTERVAL_MS = 30_000;

// Session-scoped anonymous ID — not persisted, not tied to any user or device
const sessionId = (() => {
  try {
    return (
      (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.() ??
      Math.random().toString(36).slice(2) + Date.now().toString(36)
    );
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
})();

interface MixpanelEvent {
  event: string;
  properties: Record<string, unknown>;
}

// Module-level queue and state — shared across all hook instances on the same page
const queue: MixpanelEvent[] = [];
const calledMethods = new Set<string>(); // each method fires at most once per session
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function buildEvent(name: string, props: object): MixpanelEvent {
  return {
    event: name,
    properties: {
      token: MIXPANEL_TOKEN,
      distinct_id: sessionId,
      time: Math.floor(Date.now() / 1000),
      ...props,
    },
  };
}

async function flush(): Promise<void> {
  if (queue.length === 0 || !MIXPANEL_TOKEN) return;
  const batch = queue.splice(0);
  try {
    await fetch(MIXPANEL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
      keepalive: true,
    });
  } catch {
    // fire-and-forget — telemetry errors are never surfaced to consumers
  }
}

function scheduleFlush(): void {
  if (!MIXPANEL_TOKEN || flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_INTERVAL_MS);
}

// Register visibility listener once at module load (browser only)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (flushTimer !== null) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      flush();
    }
  });
}

export interface ChannelInitProps {
  entry: 'hook' | 'provider';
  options_used: string[];
  onmessage_shape: 'none' | 'function' | 'map';
  batching_enabled: boolean;
  browser_supported: boolean;
}

export function trackChannelInit(props: ChannelInitProps): void {
  queue.push(buildEvent('channel_init', props));
  scheduleFlush();
}

export function trackMethodCalled(method: string): void {
  if (calledMethods.has(method)) return; // fire at most once per method per session
  calledMethods.add(method);
  queue.push(buildEvent('method_called', { method }));
  scheduleFlush();
}

export function trackBrowserUnsupported(): void {
  queue.push(buildEvent('browser_unsupported', {}));
  scheduleFlush();
}

/** @internal — exposed only for unit tests, do not use in application code */
export function _resetForTesting(): void {
  queue.splice(0);
  calledMethods.clear();
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

/** @internal — allows tests to inject a fake token to exercise flush logic */
export function _setTokenForTesting(t: string): void {
  MIXPANEL_TOKEN = t;
}
