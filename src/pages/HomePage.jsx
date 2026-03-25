import { Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { HomeShellContent } from '../components/ads/HomeShellContent';
import { usePlayer } from '../contexts/PlayerContext';
import PlayerHud from '../components/player/PlayerHud';
import '../styles/pages/_home-shell.scss';

export function HomePlaceholderPage({ title, description }) {
  return (
    <section className="home-placeholder" aria-label={title}>
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  );
}

export function HomePage() {
  const { pathname } = useLocation();
  const { containerRef, state: playerState } = usePlayer();
  const isPlayerActive = Boolean(playerState?.url);

  if (pathname === '/home') {
    return <Navigate to="/home/bouquets" replace />;
  }

  return (
    <div className={`home-shell${isPlayerActive ? ' home-shell--player-active' : ''}`}>
      <div className={`home-global-player${isPlayerActive ? ' home-global-player--active' : ''}`} ref={containerRef}>
        {isPlayerActive && (playerState?.isLoading || playerState?.isSeeking) && (
          <div className="home-global-player-loading">
            <div className="home-global-player-loading-spinner" />
          </div>
        )}
        {isPlayerActive && !(playerState?.isLoading || playerState?.isSeeking) && <PlayerHud />}
      </div>

      <div className={`home-shell-ui${isPlayerActive ? ' home-shell-ui--hidden' : ''}`} aria-hidden={isPlayerActive}>
        <Sidebar />
        <main className="home-content">
          <HomeShellContent />
        </main>
      </div>
    </div>
  );
}

export default HomePage;

