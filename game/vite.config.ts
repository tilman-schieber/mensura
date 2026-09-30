import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // Phaser allein ist ~1,4 MB; die Standard-Warnung ab 500 kB ist hier nicht hilfreich.
  build: { assetsInlineLimit: 0, chunkSizeWarningLimit: 2000 },
});
