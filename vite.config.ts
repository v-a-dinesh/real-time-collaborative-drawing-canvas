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
  // Plugin to serve landing.html at root
  plugins: [
    {
      name: 'rewrite-root-to-landing',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/' || req.url === '') {
            req.url = '/landing.html';
          }
          next();
        });
      }
    }
  ],
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'client/index.html'),
        landing: resolve(__dirname, 'client/landing.html')
      }
    }
  },
  appType: 'mpa'
});