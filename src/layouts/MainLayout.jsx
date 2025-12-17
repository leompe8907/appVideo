/**
 * Layout principal con navegación
 */
import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useBrand } from '../contexts/BrandContext';
import { useAuthValidator } from '../hooks/useAuthValidator';
import panaccessService from '../services/panaccessService';

export function MainLayout() {
  const { currentBrand, getImage, getUIConfig, appName, isLoading } = useBrand();
  const [logoError, setLogoError] = useState(false);
  const navigate = useNavigate();

  // Validar sesión automáticamente
  useAuthValidator();

  const handleLogout = () => {
    // Cerrar sesión con el servicio
    panaccessService.logout();
    
    // Limpiar credenciales guardadas
    localStorage.removeItem('cvSessionId');
    localStorage.removeItem('encrypted_username');
    localStorage.removeItem('encrypted_password');
    
    console.log('[MainLayout] Sesión cerrada');
    
    // Redirigir a login
    navigate('/');
  };

  if (isLoading || !currentBrand) {
    return <div className="loading">Cargando...</div>;
  }

  const primaryColor = getUIConfig('primaryColor', '#3333FF');
  const logoPath = getImage('logo.png');

  return (
    <div className="main-layout">
      {/* Header */}
      <header className="main-header" style={{ borderBottom: `4px solid ${primaryColor}` }}>
        <div className="container-fluid">
          <div className="header-content">
            {/* Logo y título */}
            <div className="brand-section">
              {!logoError && logoPath && (
                <img 
                  src={logoPath} 
                  alt={`${appName} logo`}
                  className="brand-logo"
                  onError={() => setLogoError(true)}
                />
              )}
              <h1 style={{ color: primaryColor }}>
                {appName}
              </h1>
            </div>

            {/* Botón logout */}
            <button onClick={handleLogout} className="btn btn-outline-light logout-btn">
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      {/* Navegación */}
      <nav className="main-nav">
        <div className="container-fluid">
          <ul className="nav nav-tabs">
            <li className="nav-item">
              <NavLink to="/home" className="nav-link">
                🏠 Inicio
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/channels" className="nav-link">
                📺 Canales
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/vod" className="nav-link">
                🎬 VOD
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/epg" className="nav-link">
                📅 EPG
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/settings" className="nav-link">
                ⚙️ Configuración
              </NavLink>
            </li>
          </ul>
        </div>
      </nav>

      {/* Contenido principal */}
      <main className="main-content">
        <div className="container-fluid">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="main-footer">
        <div className="container-fluid">
          <p>
            {appName} v{currentBrand.version || '1.0.0'}
            {currentBrand.developedBy && ` - ${currentBrand.developedBy}`}
          </p>
          <p>Cambia de cliente: ?brand=bromteck, ?brand=intv, ?brand=gigmax</p>
        </div>
      </footer>
    </div>
  );
}

export default MainLayout;

