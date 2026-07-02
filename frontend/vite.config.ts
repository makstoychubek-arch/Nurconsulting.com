import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/rnp-app/',
  build: {
    outDir: '../rnp-app',
    emptyOutDir: true,
  },
});
