/**
 * Servicios TV y Radio: muro de bouquets con isMain=false (excluidos de Inicio).
 */

import { Navigate } from 'react-router-dom';
import { usePlayer } from '../contexts/PlayerContext';
import { useParentalGate } from '../hooks/useParentalGate';
import BouquetWall from '../components/bouquet/BouquetWall';
import { usePreload } from '../store/usePreload';
import { hasTvRadioServiceBouquets } from '../services/tvDataService';
import panaccessService from '../services/panaccessService';
import { useCallback } from 'react';
import { useHomeHeaderDispatch } from '../contexts/homeHeaderContext';
import { useBouquetMuroTvNav } from '../hooks/useBouquetMuroTvNav';
import '../styles/pages/_bouquet.scss';

export function TvRadioServicesPage() {
  const { play } = usePlayer();
  const { requestPlayChannel } = useParentalGate();
  const { epg } = usePreload();
  const { setFocusedChannel } = useHomeHeaderDispatch();
  const handleChannelFocus = useCallback(
    (channel) => setFocusedChannel(channel),
    [setFocusedChannel]
  );

  useBouquetMuroTvNav({ route: 'serviciosTvRadio' });

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

    try {
      url = panaccessService.normalizePlaybackUrl(url);
    } catch (e) {
      if (import.meta.env?.DEV) {
        console.warn('[TvRadioServicesPage] normalizePlaybackUrl:', e?.message || e);
      }
    }

    requestPlayChannel({
      channel,
      playFn: () =>
        play({
          type: 'service',
          id: channel.id ?? channel.lcn ?? undefined,
          url,
          item: channel,
          autoPlay: true,
        }),
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
            <BouquetWall
              variant="servicios"
              onChannelSelect={handleChannelSelect}
              onChannelFocus={handleChannelFocus}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default TvRadioServicesPage;
