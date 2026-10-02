import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Le jeu est publié sur GitHub Pages à l'adresse https://<utilisateur>.github.io/pme-quebec-simulateur/
export default defineConfig({
  base: '/pme-quebec-simulateur/',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          const paquets = ['react', 'react-dom', 'scheduler', 'zustand'];
          if (paquets.some((p) => id.includes('/node_modules/' + p + '/'))) return 'react';
          return undefined;
        },
      },
    },
  },
});
