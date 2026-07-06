import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/marking-app/',
  define: {
    'process.env': {},
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: '../marking-app',
    emptyOutDir: true,
    lib: {
      entry: 'src/marking-main.tsx',
      formats: ['es'],
      fileName: 'marking',
    },
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        assetFileNames: 'marking[extname]',
      },
    },
  },
});
