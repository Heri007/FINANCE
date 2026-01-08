import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: './postcss.config.js',
  },
  server: {
    port: 5173,
  },
  build: {
    sourcemap: false, // Désactive les sourcemaps
    rollupOptions: {
      onwarn(warning, warn) {
        // Ignorer les warnings spécifiques
        if (warning.code === 'SOURCEMAP_BROKEN') return;
        if (warning.plugin === '@tailwindcss/vite:generate:build') return;
        if (warning.message && warning.message.includes('defaultProps')) return;
        warn(warning);
      }
    }
  }
})
