// Run from a directory with React 16.8/react-test-renderer 16.8 installed.
// Copy dist/index.cjs.js beside this script as bundle.cjs first.
const React = require('react');
const Renderer = require('react-test-renderer');
const { useSyncedState, BroadcastProvider } = require('./bundle.cjs');
let value,
  setter,
  closes = 0;
global.BroadcastChannel = class {
  addEventListener() {}
  removeEventListener() {}
  postMessage() {}
  close() {
    closes++;
  }
};
function App() {
  [value, setter] = useSyncedState('compat', 'key', 'fallback');
  return React.createElement(
    BroadcastProvider,
    { channelName: 'messages' },
    React.createElement('div', null, value)
  );
}
let tree;
Renderer.act(() => {
  tree = Renderer.create(React.createElement(App));
});
if (value !== 'fallback') throw Error('wrong initial');
Renderer.act(() => {
  if (!setter(v => v + '!')) throw Error('write failed');
});
if (value !== 'fallback!') throw Error('functional write failed');
Renderer.act(() => tree.unmount());
if (closes !== 2) throw Error('cleanup failed');
console.log(
  'React',
  React.version,
  'root CJS hook/provider mount, functional setter and cleanup passed'
);
