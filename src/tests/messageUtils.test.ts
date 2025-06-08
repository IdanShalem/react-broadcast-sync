import {
  generateRandomPart,
  generateSourceName,
  generateMessageId,
  isValidMessage,
  isMessageExpired,
  createMessage,
  getInternalMessageType,
  isInternalType,
  isValidInternalClearMessage,
  debounce,
} from '../utils/messageUtils';

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('messageUtils', () => {
  it('generateRandomPart returns a non-empty string', () => {
    const part = generateRandomPart();
    expect(typeof part).toBe('string');
    expect(part).toHaveLength(9);
  });

  it('generateSourceName includes "tab-" prefix', () => {
    expect(generateSourceName()).toMatch(/^tab-/);
  });

  it('generateMessageId returns a base64 string', () => {
    const id = generateMessageId('source-1', Date.now());
    expect(typeof id).toBe('string');
    expect(id).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });

  it('isValidMessage identifies a valid message object', () => {
    expect(isValidMessage({ id: '123' })).toBe(true);
    expect(isValidMessage(null)).toBe(false);
    expect(isValidMessage({})).toBe(false);
  });

  it('isMessageExpired works correctly', () => {
    const now = Date.now();
    expect(isMessageExpired({ expirationDate: now - 1000 })).toBe(true);
    expect(isMessageExpired({ expirationDate: now + 1000 })).toBe(false);
    expect(isMessageExpired({})).toBe(false);
  });

  it('createMessage returns a valid message object', () => {
    const source = 'tab-abc';
    const msg = createMessage('type1', { hello: 'world' }, source, { expirationDuration: 1000 });
    expect(msg).toHaveProperty('id');
    expect(msg).toHaveProperty('type', 'type1');
    expect(msg).toHaveProperty('message.hello', 'world');
    expect(msg).toHaveProperty('source', source);
    expect(msg.expirationDate).toBeGreaterThan(Date.now());
  });

  it('createMessage uses provided expirationDate when given', () => {
    const expirationDate = Date.now() + 5000;
    const message = createMessage('type', {}, 'source', { expirationDate });
    expect(message.expirationDate).toBe(expirationDate);
  });

  it('getInternalMessageType produces unique hashes for different channels', () => {
    const one = getInternalMessageType('CLEAR_SENT_MESSAGES', 'chanA');
    const two = getInternalMessageType('CLEAR_SENT_MESSAGES', 'chanB');
    expect(one).not.toBe(two);
  });

  it('getInternalMessageType generates consistent hash string', () => {
    const type = getInternalMessageType('CLEAR_SENT_MESSAGES', 'my-channel', 'ns');
    expect(type).toContain('__INTERNAL__');
    expect(type).toContain('CLEAR_SENT_MESSAGES');
  });

  it('isInternalType detects internal message types', () => {
    const type = getInternalMessageType('CLEAR_SENT_MESSAGES', 'chan');
    expect(isInternalType(type)).toBe(true);
    expect(isInternalType('normal-type')).toBe(false);
  });

  it('isValidInternalClearMessage detects valid structure', () => {
    const valid = {
      id: 'abc',
      type: getInternalMessageType('CLEAR_SENT_MESSAGES', 'ch'),
      source: 'tab-1',
    };
    const invalid = { id: 123, type: 'bad', source: 'tab-1' };
    expect(isValidInternalClearMessage(valid)).toBe(true);
    expect(isValidInternalClearMessage(invalid)).toBe(false);
  });
});

describe('debounce', () => {
  it('debounce delays function call and can cancel/flush', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    debounced.flush();
    expect(fn).toHaveBeenCalled();

    debounced();
    debounced.cancel();
    jest.advanceTimersByTime(150);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('debounce handles multiple calls and preserves this context', () => {
    const obj = {
      value: 0,
      increment: function () {
        this.value++;
      },
    };
    const debounced = debounce(obj.increment.bind(obj), 100);

    debounced();
    debounced();
    debounced.flush();
    expect(obj.value).toBe(1);
  });

  it('debounce flush returns undefined when no pending call', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    expect(debounced.flush()).toBeUndefined();
    expect(fn).not.toHaveBeenCalled();
  });

  it('debounce handles function with return value', () => {
    const fn = jest.fn().mockReturnValue('test');
    const debounced = debounce(fn, 100);

    debounced();
    expect(debounced.flush()).toBe('test');
  });

  it('debounce.cancel cancels the timeout', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);
    debounced();
    debounced.cancel();
    jest.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });

  it('debounce.flush executes immediately', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);
    debounced('test');
    debounced.flush();
    expect(fn).toHaveBeenCalledWith('test');
  });

  it('debounce handles multiple calls with different arguments', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced('first');
    debounced('second');
    debounced('third');

    expect(fn).not.toHaveBeenCalled();
    debounced.flush();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('third');
  });

  it('debounce handles cancel and flush in sequence', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced('test');
    debounced.cancel();
    expect(debounced.flush()).toBeUndefined();
    expect(fn).not.toHaveBeenCalled();
  });

  it('debounce.flush executes the function with latest arguments immediately', () => {
    jest.useFakeTimers();

    const fn = jest.fn((x: number) => x + 1);
    const debounced = debounce(fn, 200);

    debounced(41);

    expect(fn).not.toHaveBeenCalled();

    const flushResult = debounced.flush();

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(41);
    expect(flushResult).toBe(42);

    jest.useRealTimers();
  });

  it('debounce.flush does nothing if timeout is set but lastArgs were reset manually', () => {
    const fn = jest.fn();

    const debounced = debounce(fn, 100);

    // Call once, schedule the debounce
    debounced('first');

    // Simulate internal cleanup (cannot access lastArgs directly, so instead cancel it)
    debounced.cancel(); // This will clear lastArgs and lastThis but not call fn

    const result = debounced.flush(); // Should do nothing

    expect(fn).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('debounce.flush handles case where timeoutId exists but lastArgs is null', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    // Schedule a call
    debounced('test');

    // Force the timeout to be set but clear lastArgs
    jest.advanceTimersByTime(50); // Advance partially through the timeout
    debounced.cancel(); // This clears lastArgs but might not clear timeoutId immediately

    // Call flush when timeoutId exists but lastArgs is null
    const result = debounced.flush();
    expect(result).toBeUndefined();
    expect(fn).not.toHaveBeenCalled();
  });

  it('debounce.flush handles multiple calls with different arguments and preserves return value', () => {
    const fn = jest.fn((x: number) => x * 2);
    const debounced = debounce(fn, 100);

    debounced(1);
    debounced(2);
    debounced(3);

    const result = debounced.flush();
    expect(result).toBe(6); // 3 * 2
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
  });
});
