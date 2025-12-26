/**
 * Página Home / Dashboard con navegación espacial
 */

import { useNavigate } from 'react-router-dom';
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import { useBrand } from '../contexts/BrandContext';
import { useDevice } from '../contexts/DeviceContext';

/**
 * Card de navegación focusable
 */
function NavCard({ icon, label, path }) {
  const navigate = useNavigate();
  
  const { ref, focused } = useFocusable({
    onEnterPress: () => navigate(path),
  });

  return (
    <div
      ref={ref}
      className={`nav-card ${focused ? 'focused' : ''}`}
      onClick={() => navigate(path)}
      role="button"
      tabIndex={-1}
    >
      <span className="icon">{icon}</span>
      <span className="label">{label}</span>
    </div>
  );
}

export function HomePage() {
  const { appName, currentBrand } = useBrand();
  const { isTV, deviceType } = useDevice();

  // Contenedor principal
  const { ref, focusKey } = useFocusable({
    focusable: false,
    trackChildren: true,
  });

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="home-page">
        <header className="home-header">
          <h1>{appName}</h1>
          <span className="device-badge">
            {isTV ? '📺 TV' : '💻 PC'} ({deviceType})
          </span>
        </header>

        <nav className="home-nav">
          <NavCard icon="📺" label="Canales" path="/channels" />
          <NavCard icon="🎬" label="VOD" path="/vod" />
          <NavCard icon="📅" label="EPG" path="/epg" />
        </nav>

        <footer className="home-footer">
          <p>{appName} v{currentBrand?.version || '1.0.0'}</p>
        </footer>
      </div>
    </FocusContext.Provider>
  );
}

export default HomePage;
