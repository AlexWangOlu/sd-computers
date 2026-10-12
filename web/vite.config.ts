import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Build the desktop into web/build with relative asset paths so the
// FiveM NUI (nui://sd-computers/web/build/index.html) resolves them. Filenames
// are unhashed to match the lean fxmanifest files{} globs.
export default defineConfig({
  plugins: [react()],
  base: './',
  // '@' -> src, so cross-area imports read `@/i18n` instead of `../../../i18n`.
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    outDir: 'build',
    emptyOutDir: true,
    assetsDir: 'assets',
    target: 'chrome103', // FiveM's CEF is Chromium 103 (navigator.userAgent in game) - no toSorted, :has(), color-mix, dvh
    rollupOptions: {
      // The OS, and the /computeradmin panel it holds in an iframe (src/AdminFrame.tsx): a page of
      // its own, so its stylesheet (sd-bombs' admin UI) and the OS's never meet.
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
      },
      output: {
        // What both pages share from node_modules (React, zustand, the icons) in one chunk with a
        // name that says so, instead of one named after whichever module Rollup met first.
        manualChunks: id => (id.includes('node_modules') ? 'vendor' : undefined),
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});
