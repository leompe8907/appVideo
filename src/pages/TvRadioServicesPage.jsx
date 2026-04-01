/**
 * Servicios TV y Radio: muro de bouquets con isMain=false (excluidos de Inicio).
 */

import { Navigate } from 'react-router-dom';
import { usePlayer } from '../contexts/PlayerContext';
import BouquetWall from '../components/bouquet/BouquetWall';
import { usePreload } from '../store/usePreload';
import { hasTvRadioServiceBouquets } from '../services/tvDataService';
import panaccessService from '../services/panaccessService';
import '../styles/pages/_bouquet.scss';

export function TvRadioServicesPage() {
  const { play } = usePlayer();
  const { epg } = usePreload();

  const handleChannelSelect = (channel) => {
    if (import.meta.env?.DEV) {
      console.log('[TvRadioServicesPage] handleChannelSelect', channel?.id ?? channel?.lcn, channel);
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
            console.warn('[TvRadioServicesPage] getStreamM3u8Url fallback:', e?.message || e);
          }
        }
      }
    }

    if (!url) {
      console.warn('[TvRadioServicesPage] Canal sin URL de streaming', channel);
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

  if (
    epg.status === 'ready' &&
    !hasTvRadioServiceBouquets(epg.bouquetsWithChannels || [])
  ) {
    return <Navigate to="/home/inicio" replace />;
  }

  return (
    <div className="bouquet-page">
      <div className="bouquet-overlay" />
      <div className="bouquet-container">
        <div className="bouquet-content">
          <div className="bouquet-inicio-scroll">
            <BouquetWall variant="servicios" onChannelSelect={handleChannelSelect} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default TvRadioServicesPage;
