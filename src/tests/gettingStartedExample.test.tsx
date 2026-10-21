import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as ts from 'typescript';
import * as React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import * as library from '../index';

// Execute the actual documented snippet so changes to the guide cannot silently
// revert local-click handling. The mock preserves native sender exclusion.
const guide = readFileSync(
  resolve(__dirname, '../../website/src/content/docs/getting-started.mdx'),
  'utf8'
);
const section = guide.split('## 5. Receive and render')[1];
const snippet = section.match(/```tsx\n([\s\S]*?)```/)![1];
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

it('counts local and remote clicks using the actual Getting Started example', () => {
  const original = global.BroadcastChannel;
  global.BroadcastChannel = Channel as unknown as typeof BroadcastChannel;
  jest.useFakeTimers();
  const first = render(<Counter />);
  const second = render(<Counter />);
  const [buttonA, buttonB] = Array.from(document.querySelectorAll('button'));
  fireEvent.click(buttonA);
  expect(buttonA.textContent).toBe('Count: 1');
  act(() => jest.advanceTimersByTime(30));
  expect(buttonB.textContent).toBe('Count: 1');
  fireEvent.click(buttonB);
  act(() => jest.advanceTimersByTime(30));
  expect(buttonA.textContent).toBe('Count: 2');
  expect(buttonB.textContent).toBe('Count: 2');
  first.unmount();
  second.unmount();
  jest.useRealTimers();
  global.BroadcastChannel = original;
});
