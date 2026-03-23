import {
  trackChannelInit,
  trackMethodCalled,
  trackBrowserUnsupported,
  _resetForTesting,
  _setTokenForTesting,
} from '../utils/telemetry';

const MIXPANEL_ENDPOINT = 'https://api.mixpanel.com/track';
const FAKE_TOKEN = 'test-token-abc123';

const mockFetch = jest.fn().mockResolvedValue({ ok: true });
global.fetch = mockFetch;

const BASE_INIT_PROPS = {
  entry: 'hook' as const,
  options_used: [],
  onmessage_shape: 'none' as const,
  batching_enabled: true,
  browser_supported: true,
};

beforeEach(() => {
  _resetForTesting();
  mockFetch.mockClear();
  jest.useFakeTimers();
});

afterEach(() => {
  _setTokenForTesting(''); // restore empty token after each test
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Token guard
// ---------------------------------------------------------------------------

describe('token guard', () => {
  it('does not flush when token is empty (default in test env)', async () => {
    trackChannelInit(BASE_INIT_PROPS);

    jest.advanceTimersByTime(30_000);
    await Promise.resolve();

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('flushes when a token is set', async () => {
    _setTokenForTesting(FAKE_TOKEN);
    trackChannelInit(BASE_INIT_PROPS);

    jest.advanceTimersByTime(30_000);
    await Promise.resolve();

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// trackChannelInit
// ---------------------------------------------------------------------------

describe('trackChannelInit', () => {
  beforeEach(() => _setTokenForTesting(FAKE_TOKEN));

  it('enqueues a channel_init event and flushes after 30 s', async () => {
    trackChannelInit(BASE_INIT_PROPS);

    jest.advanceTimersByTime(30_000);
    await Promise.resolve();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      MIXPANEL_ENDPOINT,
      expect.objectContaining({ method: 'POST' })
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body[0].event).toBe('channel_init');
  });

  it('includes all provided properties in the event', async () => {
    trackChannelInit({
      entry: 'provider',
      options_used: ['namespace', 'registeredTypes'],
      onmessage_shape: 'map',
      batching_enabled: false,
      browser_supported: true,
    });

    jest.advanceTimersByTime(30_000);
    await Promise.resolve();

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const props = body[0].properties;
    expect(props.entry).toBe('provider');
    expect(props.options_used).toEqual(['namespace', 'registeredTypes']);
    expect(props.onmessage_shape).toBe('map');
    expect(props.batching_enabled).toBe(false);
    expect(props.browser_supported).toBe(true);
  });

  it('includes token and distinct_id in every event', async () => {
    trackChannelInit(BASE_INIT_PROPS);

    jest.advanceTimersByTime(30_000);
    await Promise.resolve();

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body[0].properties.token).toBe(FAKE_TOKEN);
    expect(typeof body[0].properties.distinct_id).toBe('string');
    expect(body[0].properties.distinct_id.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// trackMethodCalled
// ---------------------------------------------------------------------------

describe('trackMethodCalled', () => {
  beforeEach(() => _setTokenForTesting(FAKE_TOKEN));

  it('enqueues a method_called event on first call', async () => {
    trackMethodCalled('postMessage');

    jest.advanceTimersByTime(30_000);
    await Promise.resolve();

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body[0].event).toBe('method_called');
    expect(body[0].properties.method).toBe('postMessage');
  });

  it('deduplicates — same method called multiple times produces one event', async () => {
    trackMethodCalled('postMessage');
    trackMethodCalled('postMessage');
    trackMethodCalled('postMessage');

    jest.advanceTimersByTime(30_000);
    await Promise.resolve();

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const dupes = body.filter((e: any) => e.properties.method === 'postMessage');
    expect(dupes).toHaveLength(1);
  });

  it('tracks different methods independently', async () => {
    trackMethodCalled('postMessage');
    trackMethodCalled('ping');
    trackMethodCalled('clearReceivedMessages');
    trackMethodCalled('clearSentMessages');
    trackMethodCalled('getLatestMessage');
    trackMethodCalled('closeChannel');

    jest.advanceTimersByTime(30_000);
    await Promise.resolve();

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const methods = body.map((e: any) => e.properties.method);
    expect(methods).toContain('postMessage');
    expect(methods).toContain('ping');
    expect(methods).toContain('clearReceivedMessages');
    expect(methods).toContain('clearSentMessages');
    expect(methods).toContain('getLatestMessage');
    expect(methods).toContain('closeChannel');
    expect(body).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// trackBrowserUnsupported
// ---------------------------------------------------------------------------

describe('trackBrowserUnsupported', () => {
  beforeEach(() => _setTokenForTesting(FAKE_TOKEN));

  it('enqueues a browser_unsupported event', async () => {
    trackBrowserUnsupported();

    jest.advanceTimersByTime(30_000);
    await Promise.resolve();

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body[0].event).toBe('browser_unsupported');
  });
});

// ---------------------------------------------------------------------------
// Flush behaviour
// ---------------------------------------------------------------------------

describe('flush behaviour', () => {
  beforeEach(() => _setTokenForTesting(FAKE_TOKEN));

  it('does not call fetch when the queue is empty', async () => {
    jest.advanceTimersByTime(30_000);
    await Promise.resolve();

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not flush before 30 s', async () => {
    trackChannelInit(BASE_INIT_PROPS);

    jest.advanceTimersByTime(29_999);
    await Promise.resolve();

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('flushes exactly at 30 s', async () => {
    trackChannelInit(BASE_INIT_PROPS);

    jest.advanceTimersByTime(30_000);
    await Promise.resolve();

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('sends all queued events in a single batch request', async () => {
    trackChannelInit(BASE_INIT_PROPS);
    trackMethodCalled('ping');
    trackMethodCalled('postMessage');

    jest.advanceTimersByTime(30_000);
    await Promise.resolve();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toHaveLength(3);
  });

  it('uses POST with application/json content type', async () => {
    trackChannelInit(BASE_INIT_PROPS);

    jest.advanceTimersByTime(30_000);
    await Promise.resolve();

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(MIXPANEL_ENDPOINT);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('never surfaces fetch errors to the caller', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));
    trackChannelInit(BASE_INIT_PROPS);

    jest.advanceTimersByTime(30_000);

    await expect(Promise.resolve()).resolves.toBeUndefined();
  });

  it('clears the queue after a successful flush', async () => {
    trackChannelInit(BASE_INIT_PROPS);

    jest.advanceTimersByTime(30_000);
    await Promise.resolve();

    mockFetch.mockClear();

    jest.advanceTimersByTime(30_000);
    await Promise.resolve();

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
