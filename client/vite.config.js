import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
