import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Built assets are served by the docs site under /demos/hook/.
  base: command === 'build' ? '/demos/hook/' : '/',
  build: {
    outDir: '../../website/public/demos/hook',
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
    port: 4100,
    strictPort: true,
  },
}));
