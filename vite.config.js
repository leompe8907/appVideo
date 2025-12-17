import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const brand = process.env.VITE_BRAND || '';
  
  return {
    plugins: [react()],
    
    // Configuración para builds por cliente
    build: {
      outDir: brand ? `dist/${brand}` : 'dist',
      // Optimizaciones para TVs antiguas
      target: 'es2015',
      cssTarget: 'chrome61',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: true,
        },
      },
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
          },
        },
      },
    },

    // Base URL dinámica por cliente
    base: brand ? `/${brand}/` : '/',

    // Variables de entorno
    define: {
      __BRAND__: JSON.stringify(brand),
    },

    // Optimizaciones para desarrollo
    server: {
      host: true,
      port: 3000,
    },
  };
})
