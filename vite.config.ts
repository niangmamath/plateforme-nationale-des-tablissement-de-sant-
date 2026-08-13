import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': process.env.API_URL || 'http://localhost:4000',
      },
    },
    // Sert de banc de test perf local sur le bundle de prod (`npm run build && npm run preview`) :
    // `vite preview` n'hérite pas de `server.proxy`, donc on le redéclare ici.
    preview: {
      proxy: {
        '/api': process.env.API_URL || 'http://localhost:4000',
      },
    },
  };
});
