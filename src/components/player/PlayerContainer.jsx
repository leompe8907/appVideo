import { usePlayer } from '../../contexts/PlayerContext';

/**
 * Contenedor visual del reproductor.
 * El engine pinta el <video> dentro de player-video-area.
 */
export function PlayerContainer() {
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

  return (
    <div className="player-shell">
      <div className="player-video-area" ref={containerRef} />
      <div className="player-controls">
        <button
          type="button"
          className="player-toggle-button"
          onClick={togglePlay}
          disabled={!state.url}
        >
          {state.isPlaying ? 'Pausar' : 'Reproducir'}
        </button>
        <span className="player-time">
          {Number.isFinite(state.currentTime) ? Math.floor(state.currentTime) : 0} /
          {Number.isFinite(state.duration) ? Math.floor(state.duration) : 0} s
        </span>
        {state.error && (
          <span className="player-error">
            {typeof state.error === 'string' ? state.error : 'Error en reproducción'}
          </span>
        )}
      </div>
    </div>
  );
}

export default PlayerContainer;

