// LUNAR modification: development API forwards to the Python package launcher.
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the build works at any path (GitHub Pages serves it from /lunar-navigator/).
  base: './',
  plugins: [react()],
  server: { proxy: { '/api': process.env.LUNAR_ATLAS_API ?? 'http://127.0.0.1:5195' } },
})
