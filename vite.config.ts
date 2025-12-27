
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {
      API_KEY: process.env.API_KEY,
      NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
