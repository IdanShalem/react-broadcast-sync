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
  // Single-copy guarantees for the linked @rbs-demos/shared package:
  // without dedupe its peer imports (@mui, react) bundle a second copy and
  // MUI components render with the default (light) theme.
  resolve: {
    dedupe: [
      'react',
      'react-dom',
      'react-broadcast-sync',
      '@mui/material',
      '@mui/icons-material',
      '@emotion/react',
      '@emotion/styled',
    ],
  },
  server: {
    port: 4200,
    strictPort: true,
  },
}));
