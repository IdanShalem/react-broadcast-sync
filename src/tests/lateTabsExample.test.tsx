import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as ts from 'typescript';
import * as React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import * as library from '../index';

// Execute the actual documented bootstrap snippet. The mock preserves native sender exclusion.
const guide = readFileSync(
  resolve(__dirname, '../../website/src/content/docs/recipes/late-tabs.mdx'),
  'utf8'
);
const snippet = guide.match(/```tsx\n([\s\S]*?)```/)![1];
const compiled = ts.transpileModule(snippet, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
}).outputText;
const exportsObject: { default?: React.ComponentType } = {};
new Function('require', 'exports', 'React', compiled)(
  (name: string) => (name === 'react' ? React : library),
  exportsObject,
  React
);
const Counter = exportsObject.default!;

class Channel {
  static peers: Channel[] = [];
  // Real BroadcastChannel keeps one listener set per event type; the hook
  // subscribes to both "message" and "messageerror".
  listeners = new Map<string, (event: MessageEvent) => void>();
  constructor(public name: string) {
    Channel.peers.push(this);
  }
  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(type, listener);
  }
  removeEventListener(type: string) {
    this.listeners.delete(type);
  }
  postMessage(data: unknown) {
    Channel.peers
      .filter(peer => peer !== this && peer.name === this.name)
      .forEach(peer => peer.listeners.get('message')?.({ data } as MessageEvent));
  }
  close() {
    Channel.peers = Channel.peers.filter(peer => peer !== this);
  }
}

describe('actual late-tab recipe', () => {
  let original: typeof BroadcastChannel;
  beforeEach(() => {
    original = global.BroadcastChannel;
    global.BroadcastChannel = Channel as unknown as typeof BroadcastChannel;
    Channel.peers = [];
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    global.BroadcastChannel = original;
  });

  it('bootstraps a late tab without overwriting the existing tab', () => {
    const first = render(<Counter />);
    act(() => jest.advanceTimersByTime(100));
    fireEvent.click(first.getByRole('button'));
    act(() => jest.advanceTimersByTime(100));
    expect(first.getByRole('button').textContent).toBe('Count: 1');
    const second = render(<Counter />);
    act(() => jest.advanceTimersByTime(100));
    expect(Array.from(document.querySelectorAll('button')).map(b => b.textContent)).toEqual([
      'Count: 1',
      'Count: 1',
    ]);
    first.unmount();
    second.unmount();
  });

  it('keeps a local edit made before the bootstrap response arrives', () => {
    const first = render(<Counter />);
    act(() => jest.advanceTimersByTime(100));
    fireEvent.click(first.getByRole('button'));
    fireEvent.click(first.getByRole('button'));
    act(() => jest.advanceTimersByTime(100));
    const second = render(<Counter />);
    const secondButton = Array.from(document.querySelectorAll('button'))[1];
    fireEvent.click(secondButton);
    act(() => jest.advanceTimersByTime(100));
    expect(secondButton.textContent).toBe('Count: 1');
    first.unmount();
    second.unmount();
  });
  it('ignores replies for another request and replies after a live update', () => {
    const view = render(<Counter />);
    const peer = new Channel('counter');
    let requestId = '';
    peer.listeners.set('message', (event: MessageEvent) => {
      const batch = Array.isArray(event.data) ? event.data : [event.data];
      requestId =
        batch.find((msg: { type: string }) => msg.type === 'state-request')?.message.requestId ??
        requestId;
    });
    act(() => jest.advanceTimersByTime(30));
    const send = (type: string, message: unknown, id: string) =>
      peer.postMessage({ id, type, message, source: 'peer', timestamp: Date.now() });
    act(() => send('state-response', { requestId: 'someone-else', value: 99 }, 'wrong'));
    expect(view.getByRole('button').textContent).toBe('Count: 0');
    act(() => send('set', 5, 'live'));
    act(() => send('state-response', { requestId, value: 2 }, 'late'));
    expect(view.getByRole('button').textContent).toBe('Count: 5');
    view.unmount();
    peer.close();
  });
});
