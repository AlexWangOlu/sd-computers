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
      // index.html is the resource's NUI page (src/host): it holds the OS (os.html) and the
      // /computeradmin panel (admin.html) as two frames - the OS so it can be laid over a prop's
      // screen with a window of its own, the panel so its stylesheet (sd-bombs' admin UI) and the
      // OS's never meet. screen.html is the page a computer's prop shows in the world (src/screen),
      // loaded by the game as a DUI.
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        os: fileURLToPath(new URL('./os.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
        screen: fileURLToPath(new URL('./screen.html', import.meta.url)),
      },
      output: {
        // What the pages share from node_modules (React, zustand, the icons) in one chunk with a
        // name that says so, instead of one named after whichever module Rollup met first. rrweb is
        // left out of it: the recorder is fetched only while a screen is being watched, and the
        // replayer belongs to screen.html alone. The OS's stylesheets, which screen.html borrows
        // for its lock faces, get the same treatment (os.css).
        manualChunks: id => {
          if (id.includes('node_modules')) return id.includes('rrweb') ? undefined : 'vendor';
          return /[\\/]src[\\/]styles(\.css$|[\\/])/.test(id) ? 'os' : undefined;
        },
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});
