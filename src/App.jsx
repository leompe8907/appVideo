import { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthValidator } from './hooks/useAuthValidator';

import { isAuthenticated } from './utils/userSession';
import { PlayerProvider } from './contexts/PlayerContext';
import { PreloadGate } from './components/preload/PreloadGate';

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
const ParentalSettingsPage = lazy(() => import('./pages/ParentalSettingsPage'));
const OsmsPage = lazy(() => import('./pages/OsmsPage'));
const HomePlaceholderPage = lazy(() =>
  import('./pages/HomePage').then((m) => ({ default: m.HomePlaceholderPage }))
);

/** Fallback Suspense: mismo look que #app-boot-shell del index (transición continua). */
function Loading() {
  const { t } = useTranslation();
  return (
    <div className="app-route-loading" role="status" aria-live="polite" aria-busy="true">
      <div className="app-route-loading__spinner" aria-hidden="true" />
      <p className="app-route-loading__label">{t('common.loading')}</p>
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
  useTranslation();

  return (
    <>
      <PlayerProvider>
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
                <Route path="control-parental" element={<PreloadGate required="epg"><Suspense fallback={<Loading />}><ParentalSettingsPage /></Suspense></PreloadGate>}/>
                <Route path="osms" element={<Suspense fallback={<Loading />}><OsmsPage /></Suspense>}/>
                <Route path="*" element={<Navigate to="/home/inicio" replace />} />
              </Route>
              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </PlayerProvider>
    </>
  );
}

export default App;
