/**
 * Configuración de rutas de la aplicación
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { LoginPage } from '../pages/LoginPage';
import { HomePage } from '../pages/HomePage';
import { ChannelsPage } from '../pages/ChannelsPage';
import { VodPage } from '../pages/VodPage';
import { EpgPage } from '../pages/EpgPage';
import { SettingsPage } from '../pages/SettingsPage';

// Componente para rutas protegidas
function ProtectedRoute({ children }) {
  const isAuthenticated = !!localStorage.getItem('cvSessionId');
  
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return children;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta pública: Login */}
        <Route path="/" element={<LoginPage />} />

        {/* Rutas protegidas con layout */}
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/home" element={<HomePage />} />
          <Route path="/channels" element={<ChannelsPage />} />
          <Route path="/vod" element={<VodPage />} />
          <Route path="/epg" element={<EpgPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* Redirect cualquier ruta no encontrada */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;

