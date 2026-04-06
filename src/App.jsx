import { useEffect, useRef, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useViewport } from './hooks/useViewport';
import { useAuthValidator } from './hooks/useAuthValidator';

import { isAuthenticated } from './utils/userSession';
import { PlayerProvider } from './contexts/PlayerContext';
import { SpatialNavigationProvider } from './components/navigation/SpatialNavigationProvider';
import { PreloadGate } from './components/preload/PreloadGate';
import { SkeletonText, SkeletonCard } from './components/ui/Skeleton';

// Lazy loading de páginas
const SplashPage = lazy(() => import('./pages/SplashPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SmartCardPage = lazy(() => import('./pages/SmartCardPage'));
const BouquetPage = lazy(() => import('./pages/BouquetPage'));
const TvRadioServicesPage = lazy(() => import('./pages/TvRadioServicesPage'));
const VodPage = lazy(() => import('./pages/VodPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const PreloadDataPage = lazy(() => import('./pages/PreloadDataPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const EpgCardsPage = lazy(() => import('./pages/EpgCardsPage'));
const CatchupPage = lazy(() => import('./pages/CatchupPage'));
const HomePlaceholderPage = lazy(() =>
  import('./pages/HomePage').then((m) => ({ default: m.HomePlaceholderPage }))
);

function Loading() {
  const { t } = useTranslation();
  return (
    <div className="loading">
      <div style={{ width: 260, marginBottom: 12 }}>
        <SkeletonText />
      </div>
      <div style={{ width: '70%', maxWidth: 520, marginBottom: 18 }}>
        <SkeletonText />
      </div>
      <div style={{ width: '100%', height: 220, maxWidth: 980 }}>
        <SkeletonCard style={{ height: '100%' }} />
      </div>
      <div style={{ marginTop: 10, opacity: 0.85 }}>{t('common.loading')}</div>
    </div>
  );
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
  const lastViewportClassRef = useRef('');
  const lastScaleRef = useRef(null);
  const rafRef = useRef(0);

  // Aplicar clases de viewport al root
  useEffect(() => {
    const root = document.documentElement;

    // Evitar repintadas masivas en TV: agrupar en rAF y aplicar solo si cambió.
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;

      const scaleValue = viewport.scale > 1.5 ? viewport.scale : 1;
      const prevScale = lastScaleRef.current;
      if (prevScale == null || Math.abs(Number(prevScale) - Number(scaleValue)) > 0.01) {
        root.style.setProperty('--viewport-scale', String(scaleValue));
        lastScaleRef.current = scaleValue;
      }

      const classes = [];
      if (viewport.isMobile) classes.push('mobile');
      if (viewport.isTablet) classes.push('tablet');
      if (viewport.isDesktop) classes.push('desktop');
      if (viewport.isHD) classes.push('hd');
      if (viewport.isFullHD) classes.push('fullhd');
      if (viewport.isUltraHD) classes.push('ultrahd');
      if (viewport.is4K) classes.push('tv-4k');
      if (viewport.is8K) classes.push('tv-8k');

      const classKey = classes.sort().join(' ');
      if (classKey !== lastViewportClassRef.current) {
        root.classList.remove('mobile', 'tablet', 'desktop', 'hd', 'fullhd', 'ultrahd', 'tv-4k', 'tv-8k');
        classes.forEach((c) => root.classList.add(c));
        lastViewportClassRef.current = classKey;
      }
    });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [viewport]);

  return (
    <>
      <PlayerProvider>
        <SpatialNavigationProvider>
          <div className="App">
            <Routes>
                {/* Rutas públicas */}
                <Route path="/" element={<Suspense fallback={<Loading />}><SplashPage /></Suspense>}/>
                <Route path="/login" element={<Suspense fallback={<Loading />}><LoginPage /></Suspense>}/>
                {/* Rutas protegidas */}
                <Route path="/profile" element={<ProtectedRoute><Suspense fallback={<Loading />}><ProfilePage /></Suspense></ProtectedRoute>}/>
                <Route path="/smartcard" element={<ProtectedRoute><Suspense fallback={<Loading />}><SmartCardPage /></Suspense></ProtectedRoute>}/>
                <Route path="/preload" element={<ProtectedRoute><Suspense fallback={<Loading />}><PreloadDataPage /></Suspense></ProtectedRoute>}/>
                <Route path="/inicio" element={<Navigate to="/home/inicio" replace />}/>
                <Route path="/vod" element={<Navigate to="/home/vod" replace />}/>
                <Route path="/epg" element={<Navigate to="/home/epg" replace />}/>
                <Route path="/home" element={<ProtectedRoute><Suspense fallback={<Loading />}><HomePage /></Suspense></ProtectedRoute>}>
                  <Route path="inicio" element={<PreloadGate required="epg"><Suspense fallback={<Loading />}><BouquetPage /></Suspense></PreloadGate>}/>
                  <Route path="buscador" element={<PreloadGate required="epg"><Suspense fallback={<Loading />}><SearchPage /></Suspense></PreloadGate>}/>
                  <Route path="servicios-tv-radio"element={<PreloadGate required="epg"><Suspense fallback={<Loading />}><TvRadioServicesPage /></Suspense></PreloadGate>}/>
                  <Route path="vod" element={<Suspense fallback={<Loading />}><VodPage /></Suspense>}/>
                  <Route path="epg" element={<PreloadGate required="epg"> <Suspense fallback={<Loading />}> <EpgCardsPage /></Suspense></PreloadGate>}/>
                  <Route path="catchup" element={<Suspense fallback={<Loading />}><CatchupPage /></Suspense>}/>
                  <Route path="osms" element={<Suspense fallback={<Loading />}><HomePlaceholderPage title="OSMS" description="Modulo en preparacion para mensajes del sistema." /></Suspense>}/>
                  <Route path="*" element={<Navigate to="/home/inicio" replace />} />
                </Route>
                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </SpatialNavigationProvider>
      </PlayerProvider>
    </>
  );
}

export default App;
