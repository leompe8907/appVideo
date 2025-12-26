/**
 * Página Home / Dashboard
 * - TV: Navegación con Norigin (D-pad)
 * - PC: Navegación nativa (Tab, Click)
 */

import { useNavigate } from 'react-router-dom';
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import { useBrand } from '../contexts/BrandContext';
import { useDevice } from '../contexts/DeviceContext';

/**
 * Card de navegación
 */
function NavCard({ icon, label, path, isTV }) {
  const navigate = useNavigate();
  
  const { ref, focused } = useFocusable({
    onEnterPress: () => {
      if (isTV) navigate(path);
    },
  });

  return (
    <div
      ref={ref}
      className={`nav-card ${isTV && focused ? 'focused' : ''}`}
      onClick={() => navigate(path)}
      role="button"
      tabIndex={isTV ? -1 : 0}
      onKeyDown={(e) => {
        if (!isTV && e.key === 'Enter') navigate(path);
      }}
    >
      <span className="icon">{icon}</span>
      <span className="label">{label}</span>
    </div>
  );
}

export function HomePage() {
  const { appName, currentBrand } = useBrand();
  const { isTV, deviceType } = useDevice();

  console.log(`🖥️ [HOME] Modo: ${isTV ? 'TV' : 'PC'}`);

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
          <NavCard icon="📺" label="Canales" path="/channels" isTV={isTV} />
          <NavCard icon="🎬" label="VOD" path="/vod" isTV={isTV} />
          <NavCard icon="📅" label="EPG" path="/epg" isTV={isTV} />
        </nav>

        <footer className="home-footer">
          <p>{appName} v{currentBrand?.version || '1.0.0'}</p>
        </footer>
      </div>
    </FocusContext.Provider>
  );
}

export default HomePage;
