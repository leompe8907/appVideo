import EpgCards from '../components/epg/EpgCards';
import { usePlayer } from '../contexts/PlayerContext';
import '../styles/pages/_epg.scss';

export function EpgCardsPage() {
  // El background común lo maneja Home (.home-content)
  const { containerRef, state: playerState } = usePlayer();

  return (
    <div className="epg-page">
      <div className="epg-page-overlay" />
      <div
        className={`epg-player-video${playerState?.url ? ' epg-player-video--active' : ''}`}
        ref={containerRef}
      >
        {playerState?.url && playerState?.isLoading && (
          <div className="epg-player-loading">
            <div className="epg-player-loading-spinner" />
          </div>
        )}
      </div>
      <div className="epg-page-content">
        <EpgCards />
      </div>
    </div>
  );
}

export default EpgCardsPage;

