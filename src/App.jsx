import { useEffect, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useViewport } from './hooks/useViewport';
import { useAuthValidator } from './hooks/useAuthValidator';
import { SpatialNavigationProvider } from './components/navigation/SpatialNavigationProvider';
import { isAuthenticated } from './utils/userSession';
import { PlayerProvider } from './contexts/PlayerContext';
import { PreloadProvider } from './contexts/PreloadContext';
import { PreloadGate } from './components/preload/PreloadGate';

// Lazy loading de páginas
const SplashPage = lazy(() => import('./pages/SplashPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SmartCardPage = lazy(() => import('./pages/SmartCardPage'));
const BouquetPage = lazy(() => import('./pages/BouquetPage'));
const VodPage = lazy(() => import('./pages/VodPage'));
const PreloadDataPage = lazy(() => import('./pages/PreloadDataPage'));

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
      <PlayerProvider>
        <PreloadProvider>
          <div className="App">
            <Routes>
              {/* Rutas públicas */}
              <Route
                path="/"
                element={
                  <Suspense fallback={<Loading />}>
                    <SplashPage />
                  </Suspense>
                }
              />
              <Route
                path="/login"
                element={
                  <Suspense fallback={<Loading />}>
                    <LoginPage />
                  </Suspense>
                }
              />
              {/* Rutas protegidas */}
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<Loading />}>
                      <ProfilePage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/smartcard"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<Loading />}>
                      <SmartCardPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/preload"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<Loading />}>
                      <PreloadDataPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bouquets"
                element={
                  <ProtectedRoute>
                    <PreloadGate required="epg">
                      <Suspense fallback={<Loading />}>
                        <BouquetPage />
                      </Suspense>
                    </PreloadGate>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vod"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<Loading />}>
                      <VodPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </PreloadProvider>
      </PlayerProvider>
    </SpatialNavigationProvider>
  );
}

export default App;
