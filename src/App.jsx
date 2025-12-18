/**
 * Componente App principal
 * Envuelve la app con BrandProvider para compartir configuración
 */

import { useEffect } from 'react';
import { BrandProvider } from './contexts/BrandContext';
import { DeviceProvider } from './contexts/DeviceContext';
import { TVNavigationProvider } from './contexts/TVNavigationContext';
import { AppRouter } from './routes/AppRouter';
import { useViewport } from './hooks/useViewport';

// Componente interno para aplicar viewport
function AppContent() {
  const viewport = useViewport();

  useEffect(() => {
    // Aplicar escala al root si es necesario
    const root = document.documentElement;
    
    // Para pantallas muy grandes, aplicar escala CSS
    if (viewport.scale > 1.5) {
      root.style.setProperty('--viewport-scale', viewport.scale);
    } else {
      root.style.setProperty('--viewport-scale', '1');
    }

    // Agregar clases según breakpoint
    root.classList.remove('mobile', 'tablet', 'desktop', 'hd', 'fullhd', 'ultrahd', 'tv-4k', 'tv-8k');
    
    if (viewport.isMobile) root.classList.add('mobile');
    if (viewport.isTablet) root.classList.add('tablet');
    if (viewport.isDesktop) root.classList.add('desktop');
    if (viewport.isHD) root.classList.add('hd');
    if (viewport.isFullHD) root.classList.add('fullhd');
    if (viewport.isUltraHD) root.classList.add('ultrahd');
    if (viewport.is4K) root.classList.add('tv-4k');
    if (viewport.is8K) root.classList.add('tv-8k');
  }, [viewport]);

  return <AppRouter />;
}

function App() {
  return (
    <DeviceProvider>
      <TVNavigationProvider>
        <BrandProvider>
          <AppContent />
        </BrandProvider>
      </TVNavigationProvider>
    </DeviceProvider>
  );
}

export default App;
