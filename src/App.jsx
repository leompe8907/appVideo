import { useEffect, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useViewport } from './hooks/useViewport';
import { useAuthValidator } from './hooks/useAuthValidator';
import { SpatialNavigationProvider } from './components/navigation/SpatialNavigationProvider';
import { isAuthenticated } from './utils/userSession';

// Lazy loading de páginas
const SplashPage = lazy(() => import('./pages/SplashPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SmartCardPage = lazy(() => import('./pages/SmartCardPage'));
const BouquetPage = lazy(() => import('./pages/BouquetPage'));

function Loading() {
  const { t } = useTranslation();
  return <div className="loading">{t('common.loading')}</div>;
}

/** Valida/reactiva sesión en rutas protegidas; redirige a / si falla */
function AuthValidator() {
  useAuthValidator();
  return null;
}

/**
 * Ruta protegida: redirige a splash si no hay sesión; valida/reactiva sesión al entrar.
 */
function ProtectedRoute({ children }) {
  if (!isAuthenticated()) {
    return <Navigate to="/" replace />;
  }
  return (
    <>
      <AuthValidator />
      {children}
    </>
  );
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

  return (
    <SpatialNavigationProvider>
      <div className="App">
        <Routes>
          {/* Rutas públicas */}
          <Route path="/" element={<SplashPage />} />
          <Route path="/login" element={<LoginPage />} />
            {/* Rutas protegidas */}
            <Route path="/profile" element={<ProtectedRoute><Suspense fallback={<Loading />}><ProfilePage /></Suspense></ProtectedRoute>} />
            <Route path="/smartcard" element={<ProtectedRoute><Suspense fallback={<Loading />}><SmartCardPage /></Suspense></ProtectedRoute>} />
            <Route path="/bouquets" element={<ProtectedRoute><Suspense fallback={<Loading />}><BouquetPage /></Suspense></ProtectedRoute>} />
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </SpatialNavigationProvider>
  );
}

export default App;
