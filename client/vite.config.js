import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // AG Grid is a large, legitimately shared dependency across every grid screen -
        // name its chunk clearly instead of Rollup's default (an arbitrary consumer's name).
        manualChunks(id) {
          if (id.includes('ag-grid')) return 'ag-grid-vendor'
        }
      }
    }
  }
})
