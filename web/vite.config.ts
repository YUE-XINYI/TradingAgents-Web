import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath, URL } from 'node:url';

function inlineDemoAssets(): Plugin {
  return {
    name: 'inline-demo-assets',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const htmlAsset = Object.values(bundle).find(
        (item) => item.type === 'asset' && item.fileName === 'index.html',
      );
      const entryChunk = Object.values(bundle).find(
        (item) => item.type === 'chunk' && item.isEntry,
      );
      const cssAsset = Object.values(bundle).find(
        (item) => item.type === 'asset' && item.fileName.endsWith('.css'),
      );

      if (!htmlAsset || htmlAsset.type !== 'asset' || !entryChunk || entryChunk.type !== 'chunk') {
        return;
      }

      let html = String(htmlAsset.source);
      const safeScript = entryChunk.code.replace(/<\/script/gi, '<\\/script');
      html = html.replace(
        /<script type="module" crossorigin src="[^"]+"><\/script>/,
        () => `<script type="module">${safeScript}</script>`,
      );

      if (cssAsset?.type === 'asset') {
        const safeStyles = String(cssAsset.source).replace(/<\/style/gi, '<\\/style');
        html = html.replace(
          /<link rel="stylesheet" crossorigin href="[^"]+">/,
          () => `<style>${safeStyles}</style>`,
        );
      }

      htmlAsset.source = html;
    },
  };
}

export default defineConfig({
  base: './',
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [react(), inlineDemoAssets()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
});
