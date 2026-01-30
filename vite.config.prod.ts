import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: 'client',
  base: '/',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'socket': ['socket.io-client']
        },
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js'
      }
    },
    chunkSizeWarningLimit: 500
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared')
    }
  },
  define: {
    'import.meta.env.VITE_WS_URL': JSON.stringify(process.env.VITE_WS_URL || '')
  }
});
