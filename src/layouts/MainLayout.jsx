/**
 * Layout principal con navegación tipo Netflix
 * Compatible con control remoto y mouse
 */
import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useBrand } from '../contexts/BrandContext';
import { useAuthValidator } from '../hooks/useAuthValidator';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import panaccessService from '../services/panaccessService';
import '../styles/components/_layout-netflix.scss';

export function MainLayout() {
  const { currentBrand, getImage, getUIConfig, appName, isLoading } = useBrand();
  const [logoError, setLogoError] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Validar sesión automáticamente
  useAuthValidator();

  // Items de navegación
  const navItems = [
    { path: '/home', label: 'Inicio', icon: '🏠' },
    { path: '/channels', label: 'Canales', icon: '📺' },
    { path: '/vod', label: 'VOD', icon: '🎬' },
    { path: '/epg', label: 'EPG', icon: '📅' },
    { path: '/settings', label: 'Configuración', icon: '⚙️' },
  ];

  // Encontrar índice inicial basado en la ruta actual
  const initialIndex = navItems.findIndex(item => item.path === location.pathname);
  const currentIndex = initialIndex >= 0 ? initialIndex : 0;

  // Navegación con teclado
  const handleNavSelect = (item) => {
    if (item && item.path) {
      navigate(item.path);
    }
  };

  const {
    focusedIndex,
    containerRef,
    itemRefs,
  } = useKeyboardNavigation(navItems, handleNavSelect, {
    loop: true,
    initialIndex: currentIndex,
    orientation: 'horizontal',
  });

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
    <div className="main-layout main-layout-netflix">
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
            <button 
              onClick={handleLogout} 
              className="btn btn-outline-light logout-btn"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleLogout();
                }
              }}
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      {/* Navegación tipo Netflix */}
      <nav className="main-nav-netflix" ref={containerRef}>
        <div className="nav-container">
          {navItems.map((item, index) => {
            const isActive = location.pathname === item.path;
            const isFocused = focusedIndex === index;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                ref={(el) => (itemRefs.current[index] = el)}
                className={`nav-item-netflix ${isActive ? 'active' : ''} ${isFocused ? 'focused' : ''}`}
                onMouseEnter={() => {
                  // Al hacer hover, actualizar focus visualmente
                  if (itemRefs.current[index]) {
                    itemRefs.current[index].focus();
                  }
                }}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            );
          })}
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

