import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return;
          }

          if (id.includes('recharts')) {
            return 'vendor-recharts';
          }

          if (id.includes('@supabase')) {
            return 'vendor-supabase';
          }

          if (id.includes('react-router-dom')) {
            return 'vendor-router';
          }

          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }

          if (id.includes('papaparse')) {
            return 'vendor-data';
          }

          if (id.includes('react-dom') || id.includes('/react/')) {
            return 'vendor-react';
          }
        },
      },
    },
  },
});
