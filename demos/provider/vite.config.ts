import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Built assets are served by the docs site under /demos/provider/.
  base: command === 'build' ? '/demos/provider/' : '/',
  build: {
    outDir: '../../website/public/demos/provider',
    emptyOutDir: true,
  },
  // Keep the @rbs-demos/shared symlink unresolved so its peer imports
  // (@mui, react, react-broadcast-sync) resolve from this app's node_modules.
  resolve: {
    preserveSymlinks: true,
  },
  server: {
    port: 4200,
    strictPort: true,
  },
}));
