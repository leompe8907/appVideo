import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const brand = process.env.VITE_BRAND || '';
  
  return {
    plugins: [react()],
    
    // Configuración de CSS/SCSS
    css: {
      preprocessorOptions: {
        scss: {
          // Configuración para Sass
          // Nota: Los warnings de Bootstrap (node_modules) no se pueden eliminar
          // porque Bootstrap usa sintaxis antigua. Nuestros archivos ya usan @use
          api: 'modern-compiler',
          // Suprimir warnings de dependencias (Bootstrap)
          quietDeps: true,
          // Suprimir warnings específicos de deprecación
          silenceDeprecations: ['import', 'global-builtin', 'if-function', 'color-functions'],
        },
      },
    },
    
    // Configuración para builds por cliente
    build: {
      outDir: brand ? `dist/${brand}` : 'dist',
      // Optimizaciones para TVs antiguas
      target: 'es2015',
      cssTarget: 'chrome61',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: false, // true en prod quita todos los console.*; false para ver logs
          //drop_console: mode === 'production', // true en prod quita todos los console.*; false para ver logs
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
