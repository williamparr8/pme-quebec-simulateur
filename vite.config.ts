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
  },
});
