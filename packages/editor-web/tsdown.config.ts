import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['iife'],
  platform: 'browser',
  globalName: 'swarmnoteEditor',
  // 把所有依赖都打进 bundle（WebView 里没有 node_modules）
  noExternal: [/.*/],
  minify: true,
  outDir: 'dist',
});
