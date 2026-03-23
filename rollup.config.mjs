import babel from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';
import { readFileSync } from 'fs';

// Load .env manually — dotenv is dev-only, not part of the bundle
const envFile = (() => {
  try {
    return Object.fromEntries(
      readFileSync('.env', 'utf-8')
        .split('\n')
        .filter(line => line.includes('='))
        .map(line => line.split('=').map(s => s.trim()))
    );
  } catch {
    return {};
  }
})();

const MIXPANEL_TOKEN = envFile.MIXPANEL_TOKEN ?? process.env.MIXPANEL_TOKEN ?? '';

const external = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  /^react\//,
  /^react-dom\//,
  'typescript',
  'tslib',
  '@babel/runtime',
];

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.esm.js',
      format: 'es',
      sourcemap: true,
      globals: {
        react: 'React',
        'react-dom': 'ReactDOM',
        typescript: 'ts',
        tslib: 'tslib',
        '@babel/runtime': 'babelRuntime',
      },
      exports: 'named',
    },
    {
      file: 'dist/index.cjs.js',
      format: 'cjs',
      sourcemap: true,
      globals: {
        react: 'React',
        'react-dom': 'ReactDOM',
        typescript: 'ts',
        tslib: 'tslib',
        '@babel/runtime': 'babelRuntime',
      },
      exports: 'named',
    },
  ],
  plugins: [
    replace({
      preventAssignment: true,
      values: {
        'process.env.MIXPANEL_TOKEN': JSON.stringify(MIXPANEL_TOKEN),
      },
    }),
    peerDepsExternal({
      includeDependencies: false,
    }),
    resolve({
      mainFields: ['module', 'main'],
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
      preferBuiltins: true,
      dedupe: ['react', 'react-dom'],
    }),
    commonjs({
      include: /node_modules/,
      transformMixedEsModules: true,
      requireReturnsDefault: 'auto',
    }),
    typescript({
      tsconfig: './tsconfig.json',
      exclude: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
      declaration: true,
      declarationDir: './dist',
      emitDeclarationOnly: false,
      sourceMap: true,
    }),
    babel({
      babelHelpers: 'runtime',
      presets: [
        [
          '@babel/preset-react',
          {
            runtime: 'automatic',
            development: process.env.NODE_ENV === 'development',
          },
        ],
      ],
      plugins: [
        [
          '@babel/plugin-transform-runtime',
          {
            regenerator: true,
            useESModules: true,
          },
        ],
      ],
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
      exclude: 'node_modules/**',
    }),
    terser(),
  ],
  external,
};
