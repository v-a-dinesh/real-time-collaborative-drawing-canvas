import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: './client',
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true
      }
    }
  },
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'client/index.html'),
        landing: resolve(__dirname, 'client/landing.html')
      }
    }
  }
});