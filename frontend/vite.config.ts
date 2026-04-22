import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/trace': 'http://localhost:8000',
      '/narrate': 'http://localhost:8000',
    },
  },
})
