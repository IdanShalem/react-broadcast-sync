import { defineConfig } from 'vite';

// The library expects the bundler to inline these (rollup does via
// @rollup/plugin-replace); the integration app must do the same.
export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env.MIXPANEL_TOKEN': JSON.stringify(''),
  },
});
