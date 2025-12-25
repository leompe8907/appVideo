/**
 * Componente App principal
 * Viewport + Routing
 */

import { useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useViewport } from './hooks/useViewport';

// Lazy loading de páginas
const SplashPage = lazy(() => import('./pages/SplashPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const ChannelsPage = lazy(() => import('./pages/ChannelsPage'));
const VodPage = lazy(() => import('./pages/VodPage'));
const EpgPage = lazy(() => import('./pages/EpgPage'));

// Loading component
function Loading() {
  return <div className="loading">Cargando...</div>;
}

/**
 * Ruta protegida - redirige a splash si no hay sesión
 */
function ProtectedRoute({ children }) {
  const isAuthenticated = !!localStorage.getItem('cvSessionId') || !!localStorage.getItem('sessionId');
  
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return children;
}

function App() {
  const viewport = useViewport();

  // Aplicar clases de viewport al root
  useEffect(() => {
    const root = document.documentElement;
    
    // Escala CSS para pantallas grandes
    root.style.setProperty('--viewport-scale', viewport.scale > 1.5 ? viewport.scale : '1');

    // Clases según breakpoint
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

  // TODO: Inicializar FocusManager aquí cuando se implemente
  // useEffect(() => {
  //   focusManager.init();
  //   return () => focusManager.destroy();
  // }, []);

  return (
    <div className="App">
      <Suspense fallback={<Loading />}>
        <Routes>
          {/* Rutas públicas */}
          <Route path="/" element={<SplashPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Rutas protegidas */}
          <Route path="/home" element={
            <ProtectedRoute><HomePage /></ProtectedRoute>
          } />
          <Route path="/channels" element={
            <ProtectedRoute><ChannelsPage /></ProtectedRoute>
          } />
          <Route path="/vod" element={
            <ProtectedRoute><VodPage /></ProtectedRoute>
          } />
          <Route path="/epg" element={
            <ProtectedRoute><EpgPage /></ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default App;
