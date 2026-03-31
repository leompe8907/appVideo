import { useTranslation } from 'react-i18next';
import { usePlayer } from '../../contexts/PlayerContext';

/**
 * Contenedor visual del reproductor.
 * El engine pinta el <video> dentro de player-video-area.
 */
export function PlayerContainer() {
  const { t } = useTranslation();
  const { state, containerRef, play, pause } = usePlayer();

  const togglePlay = () => {
    if (!state.url) return;
    if (state.isPlaying) {
      pause();
    } else {
      play({
        type: state.type,
        id: state.id,
        url: state.url,
        item: state.item,
        autoPlay: true,
      });
    }
  };

  const hasContent = Boolean(state.url);

  return (
    <div className="player-shell">
      <div className="player-video-area" ref={containerRef} />
      <div className="player-controls">
        <button
          type="button"
          className="player-toggle-button"
          onClick={togglePlay}
          disabled={!hasContent}
          title={!hasContent ? t('player.selectChannelFirst') : undefined}
        >
          {state.isPlaying ? t('player.pause') : t('player.play')}
        </button>
        <span className="player-time">
          {Number.isFinite(state.currentTime) ? Math.floor(state.currentTime) : 0} /
          {Number.isFinite(state.duration) ? Math.floor(state.duration) : 0} s
        </span>
        {state.error && (
          <span className="player-error">
            {typeof state.error === 'string' ? state.error : t('player.playbackError')}
          </span>
        )}
      </div>
    </div>
  );
}

export default PlayerContainer;

