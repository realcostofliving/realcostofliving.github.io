import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the site from /<repository>/. The deploy workflow sets BASE_PATH to
// that path; locally (and for any other static host) a relative base keeps assets working.
export default defineConfig({
  base: process.env.BASE_PATH || './',
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: { echarts: ['echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers'] },
      },
    },
  },
});
