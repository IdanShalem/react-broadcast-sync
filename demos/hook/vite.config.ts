import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Keep the @rbs-demos/shared symlink unresolved so its peer imports
  // (@mui, react, react-broadcast-sync) resolve from this app's node_modules.
  resolve: {
    preserveSymlinks: true,
  },
  server: {
    port: 4100,
    strictPort: true,
  },
});
