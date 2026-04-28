/**
 * Página de Bouquets.
 * Solo muestra el muro de bouquets con canales (sin header/footer; resto configurable en Home).
 * La URL de reproducción se toma del backend o se construye con getStreamM3u8 (lógica 10foot).
 */

import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../contexts/PlayerContext';
import { useBrand } from '../contexts/BrandContext';
import { useParentalGate } from '../hooks/useParentalGate';
import BouquetWall from '../components/bouquet/BouquetWall';
import VodRecommendedHomeRail from '../components/vod/VodRecommendedHomeRail';
import panaccessService from '../services/panaccessService';
import { useHomeHeader } from '../contexts/homeHeaderContext';
import { usePreload } from '../store/usePreload';
import { AdZone } from '../components/ads/AdZone';
import { createAdActivateHandler } from '../utils/adActivate';
import '../styles/pages/_bouquet.scss';

export function BouquetPage() {
  // El background común lo maneja Home (.home-content)
  const { play } = usePlayer();
  const { requestPlayChannel } = useParentalGate();
  const { setFocusedChannel } = useHomeHeader();
  const navigate = useNavigate();
  const { currentBrand } = useBrand();
  const { epg, ads } = usePreload();

  const topInBouquets = Boolean(currentBrand?.homeShell?.ads?.topInBouquets ?? false);
  const shouldRenderTopInside = topInBouquets === false;
  const hasTop = Array.isArray(ads.top) && ads.top.length > 0;
  const handleAdActivate = createAdActivateHandler({
    epgStreams: epg.streams,
    play,
    requestPlayChannel,
    navigate,
    panaccessService,
  });

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

  return (
    <div className="bouquet-page">
      <div className="bouquet-overlay" />
      <div className="bouquet-container">
        <div className="bouquet-content">
          <div className="bouquet-inicio-scroll">
            {shouldRenderTopInside && hasTop && (
              <AdZone
                key={`top-inicio-${ads.top.map((a) => a.id).join('-')}`}
                zoneKey="top"
                ads={ads.top}
                onActivate={handleAdActivate}
              />
            )}
            <BouquetWall
              variant="inicio"
              onChannelSelect={handleChannelSelect}
              onChannelFocus={(channel) => setFocusedChannel(channel)}
            />
            <VodRecommendedHomeRail />
          </div>
        </div>
      </div>
    </div>
  );
}

export default BouquetPage;
