/**
 * Página Home / Dashboard
 */

import { useNavigate } from 'react-router-dom';
import { useBrand } from '../contexts/BrandContext';
import { useDevice } from '../contexts/DeviceContext';

/**
 * Card de navegación
 */
function NavCard({ icon, label, path }) {
  const navigate = useNavigate();

  return (
    <div
      className="nav-card"
      onClick={() => navigate(path)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') navigate(path);
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

  return (
    <div className="home-page">
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
  );
}

export default HomePage;
