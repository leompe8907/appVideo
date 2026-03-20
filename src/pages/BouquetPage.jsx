/**
 * Página de Bouquets.
 * Solo muestra el muro de bouquets con canales (sin header/footer; resto configurable en Home).
 * La URL de reproducción se toma del backend o se construye con getStreamM3u8 (lógica 10foot).
 */

import { usePlayer } from '../contexts/PlayerContext';
import BouquetWall from '../components/bouquet/BouquetWall';
import panaccessService from '../services/panaccessService';
import '../styles/pages/_bouquet.scss';

export function BouquetPage() {
  // El background común lo maneja Home (.home-content)
  const { play, containerRef, state: playerState } = usePlayer();

  const handleChannelSelect = (channel) => {
    if (import.meta.env?.DEV) {
      console.log('[BouquetPage] handleChannelSelect', channel?.id ?? channel?.lcn, channel);
    }
    if (!channel) return;

    let url =
      channel.url ||
      channel.streamUrl ||
      channel.hlsUrl ||
      channel.hls ||
      null;

    if (!url) {
      const streamId = channel.id ?? channel.epgStreamId;
      if (streamId != null && streamId !== '') {
        try {
          url = panaccessService.getStreamM3u8Url({ streamId });
        } catch (e) {
          if (import.meta.env?.DEV) {
            console.warn('[BouquetPage] getStreamM3u8Url fallback:', e?.message || e);
          }
        }
      }
    }

    if (!url) {
      console.warn('[BouquetPage] Canal sin URL de streaming', channel);
      return;
    }

    play({
      type: 'service',
      id: channel.id ?? channel.lcn ?? undefined,
      url,
      item: channel,
      autoPlay: true,
    });
  };

  return (
    <div className="bouquet-page">
      <div className="bouquet-overlay" />
      {/* Zona donde se monta el video al reproducir; solo cubre la pantalla cuando hay stream activo para no bloquear clics/scroll en otros monitores */}
      <div
        className={`bouquet-player-video${playerState?.url ? ' bouquet-player-video--active' : ''}`}
        ref={containerRef}
      >
        {playerState?.url && playerState?.isLoading && (
          <div className="bouquet-player-loading">
            <div className="bouquet-player-loading-spinner" />
          </div>
        )}
      </div>
      <div className="bouquet-container">
        <div className="bouquet-content">
          <BouquetWall onChannelSelect={handleChannelSelect} />
        </div>
      </div>
    </div>
  );
}

export default BouquetPage;
