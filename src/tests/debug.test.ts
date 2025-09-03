// Set debug mode before requiring the debug module
process.env.REACT_APP_DEBUG_BROADCAST = 'true';
import { debug } from '../utils/debug';

describe('debug', () => {
  const originalEnv = process.env;
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    process.env = originalEnv;
  });

  describe('when debug mode is disabled', () => {
    beforeEach(() => {
      process.env.REACT_APP_DEBUG_BROADCAST = 'false';
    });

    it('does not log anything', () => {
      debug.channel.created('test-channel');
      debug.message.sent({ id: '123' });
      debug.error({ action: 'test error' });

      expect(console.log).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe('when debug mode is enabled', () => {
    beforeEach(() => {
      process.env.REACT_APP_DEBUG_BROADCAST = 'true';
    });

    it('logs channel events', () => {
      debug.channel.created('test-channel');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(
          /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] \[react-broadcast-sync\]/
        ),
        'Channel created:',
        'test-channel'
      );

      debug.channel.closed('test-channel');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(
          /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] \[react-broadcast-sync\]/
        ),
        'Channel closed:',
        'test-channel'
      );
    });

    it('logs message events', () => {
      const testMessage = { id: '123', type: 'test' };

      debug.message.sent(testMessage);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(
          /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] \[react-broadcast-sync\]/
        ),
        'Message sent:',
        testMessage
      );

      debug.message.received(testMessage);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(
          /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] \[react-broadcast-sync\]/
        ),
        'Message received:',
        testMessage
      );

      debug.message.cleared('123');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(
          /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] \[react-broadcast-sync\]/
        ),
        'Message cleared:',
        '123'
      );

      debug.message.expired('123');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(
          /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] \[react-broadcast-sync\]/
        ),
        'Message expired:',
        '123'
      );

      debug.message.duplicate('123');
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] \[react-broadcast-sync\]/
        ),
        'Duplicate message ignored:',
        '123'
      );
    });

    it('logs cleanup events', () => {
      debug.cleanup.started();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(
          /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] \[react-broadcast-sync\]/
        ),
        'Cleanup started',
        ''
      );

      debug.cleanup.completed(5);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(
          /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] \[react-broadcast-sync\]/
        ),
        'Cleanup completed:',
        5
      );
    });

    it('logs errors', () => {
      debug.error({ action: 'test error' });
      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] \[react-broadcast-sync\]/
        ),
        'Error:',
        'test error'
      );
    });

    it('includes string cause in error logs', () => {
      debug.error({ action: 'action', originalError: 'string-cause' });
      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*react-broadcast-sync\]/),
        'Error:',
        expect.stringContaining('action | cause: string-cause')
      );
    });

    it('includes object cause in error logs (JSON stringified)', () => {
      debug.error({ action: 'action', originalError: { reason: 'bad', code: 500 } });
      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*react-broadcast-sync\]/),
        'Error:',
        expect.stringContaining('action | cause: {"reason":"bad","code":500}')
      );
    });

    it('logs info with no data', () => {
      debug.channel.created('test-channel');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*react-broadcast-sync\]/),
        'Channel created:',
        'test-channel'
      );
    });

    it('logs warn with no data', () => {
      debug.message.duplicate('123');
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*react-broadcast-sync\]/),
        'Duplicate message ignored:',
        '123'
      );
    });

    it('logs error with no data', () => {
      debug.error({ action: 'error!' });
      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*react-broadcast-sync\]/),
        'Error:',
        'error!'
      );
    });

    it('logs message with no data', () => {
      debug.cleanup.started();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[react-broadcast-sync]'),
        'Cleanup started',
        ''
      );
    });
  });

  describe('when process.env is undefined', () => {
    beforeEach(() => {
      // @ts-expect-error - Testing invalid input
      process.env = undefined;
    });

    it('does not log anything', () => {
      debug.channel.created('test-channel');
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  it('logs info messages', () => {
    debug.channel.created('test-channel');
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('[react-broadcast-sync]'),
      'Channel created:',
      'test-channel'
    );
  });

  it('logs warning messages', () => {
    debug.message.duplicate('test-id');
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[react-broadcast-sync]'),
      'Duplicate message ignored:',
      'test-id'
    );
  });

  it('logs error messages', () => {
    debug.error({ action: 'Test error' });
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[react-broadcast-sync]'),
      'Error:',
      'Test error'
    );
  });

  it('logs cleanup information', () => {
    debug.cleanup.started();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('[react-broadcast-sync]'),
      'Cleanup started',
      ''
    );

    debug.cleanup.completed(2);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('[react-broadcast-sync]'),
      'Cleanup completed:',
      2
    );
  });

  it('logs all-cleared messages', () => {
    debug.message.allSentCleared();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('[react-broadcast-sync]'),
      'All sent messages cleared',
      ''
    );

    debug.message.allReceivedCleared();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('[react-broadcast-sync]'),
      'All received messages cleared',
      ''
    );
  });
});
