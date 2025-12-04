import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React and router - loaded on every page
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Data management
          'vendor-query': ['@tanstack/react-query'],
          // UI libraries
          'vendor-ui': ['framer-motion', 'clsx', 'lucide-react'],
          // Chart library - only loaded when needed
          'vendor-chart': ['chart.js', 'react-chartjs-2'],
        },
      },
    },
  },
})
