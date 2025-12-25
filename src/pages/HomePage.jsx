/**
 * Página Home / Dashboard principal
 */

import { useBrand } from '../contexts/BrandContext';
import { useDevice } from '../contexts/DeviceContext';

export function HomePage() {
  const { appName, currentBrand } = useBrand();
  const { isTV, deviceType } = useDevice();

  return (
    <div className="home-page">
      <header className="home-header">
        <h1>{appName}</h1>
        <span className="device-badge">
          {isTV ? '📺 TV' : '💻 PC'} ({deviceType})
        </span>
      </header>

      <nav className="home-nav">
        <a href="/channels" className="nav-card">
          <span className="icon">📺</span>
          <span className="label">Canales</span>
        </a>
        <a href="/vod" className="nav-card">
          <span className="icon">🎬</span>
          <span className="label">VOD</span>
        </a>
        <a href="/epg" className="nav-card">
          <span className="icon">📅</span>
          <span className="label">EPG</span>
        </a>
      </nav>

      <footer className="home-footer">
        <p>{appName} v{currentBrand?.version || '1.0.0'}</p>
      </footer>
    </div>
  );
}

export default HomePage;

