import { Suspense, lazy, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { HomeEpgRoutesLayout } from './components/preload/HomeEpgRoutesLayout';
import { useAuthValidator } from './hooks/useAuthValidator';
import { useAppLifecycle } from './hooks/useAppLifecycle';
import { useBrand } from './contexts/BrandContext';
import { isAuthenticated } from './utils/userSession';
import { PlayerProvider } from './contexts/PlayerContext';
import { TvFocusRing } from './components/navigation/TvFocusRing';
import { OsdKeyboardProvider } from './contexts/OsdKeyboardContext';
import { navigationRouter } from './navigation/NavigationRouter';
import { useDevice } from './contexts/DeviceContext';
import HomePage from './pages/HomePage';
import BouquetPage from './pages/BouquetPage';
import {
  startSessionValidator,
  stopSessionValidator,
  setOnSessionInvalid,
} from './utils/sessionValidator';

// Lazy loading de páginas
const SplashPage = lazy(() => import('./pages/SplashPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SmartCardPage = lazy(() => import('./pages/SmartCardPage'));
const TvRadioServicesPage = lazy(() => import('./pages/TvRadioServicesPage'));
const VodPage = lazy(() => import('./pages/VodPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const PreloadDataPage = lazy(() => import('./pages/PreloadDataPage'));
const EpgCardsPage = lazy(() => import('./pages/EpgCardsPage'));
const CatchupPage = lazy(() => import('./pages/CatchupPage'));
const ParentalSettingsPage = lazy(() => import('./pages/ParentalSettingsPage'));
const OsmsPage = lazy(() => import('./pages/OsmsPage'));
const MiCuentaPage = lazy(() => import('./pages/MiCuentaPage'));
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

function AppLifecycleHost() {
  useAppLifecycle();
  return null;
}

function App() {
  useTranslation();
  const navigate = useNavigate();
  const { currentBrand } = useBrand();
  const { isTV } = useDevice();

  useEffect(() => {
    try {
      sessionStorage.removeItem('app_reloaded_from_error');
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    // El router siempre corre (BACK/Escape de modales debe funcionar en cualquier
    // dispositivo). El movimiento de foco por geometría (LRUD) solo se habilita en TV.
    navigationRouter.setSpatialNavEnabled(isTV);
    navigationRouter.start();
    return () => navigationRouter.stop();
  }, [isTV]);

  useEffect(() => {
    setOnSessionInvalid(() => {
      navigate('/', { replace: true });
    });
    return () => setOnSessionInvalid(null);
  }, [navigate]);

  useEffect(() => {
    if (currentBrand?.token) {
      startSessionValidator(currentBrand);
    } else {
      stopSessionValidator();
    }
    return () => {
      stopSessionValidator();
    };
  }, [currentBrand]);

  return (
    <>
      <PlayerProvider>
        <AppLifecycleHost />
        <OsdKeyboardProvider>
          <TvFocusRing />
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
                <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>}>
                  <Route element={<HomeEpgRoutesLayout />}>
                    <Route path="inicio" element={<BouquetPage />} />
                    <Route path="buscador" element={<Suspense fallback={<Loading />}><SearchPage /></Suspense>} />
                    <Route path="servicios-tv-radio" element={<Suspense fallback={<Loading />}><TvRadioServicesPage /></Suspense>} />
                    <Route path="epg" element={<Suspense fallback={<Loading />}><EpgCardsPage /></Suspense>} />
                    <Route path="control-parental" element={<Suspense fallback={<Loading />}><ParentalSettingsPage /></Suspense>} />
                  </Route>
                  <Route path="vod" element={<Suspense fallback={<Loading />}><VodPage /></Suspense>} />
                  <Route path="catchup" element={<Suspense fallback={<Loading />}><CatchupPage /></Suspense>} />
                  <Route path="osms" element={<Suspense fallback={<Loading />}><OsmsPage /></Suspense>} />
                  <Route path="mi-cuenta" element={<Suspense fallback={<Loading />}><MiCuentaPage /></Suspense>} />
                  <Route path="*" element={<Navigate to="/home/inicio" replace />} />
                </Route>
                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </OsdKeyboardProvider>
      </PlayerProvider>
    </>
  );
}

export default App;
