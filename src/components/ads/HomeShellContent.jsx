/**
 * Contenido principal de Home: publicidad superior, Outlet de rutas, publicidad inferior.
 */

import { useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { usePlayer } from '../../contexts/PlayerContext';
import panaccessService from '../../services/panaccessService';
import { AdZone } from './AdZone';
import { useAdsQuery } from '../../query/hooks/useAdsQuery';
import { usePreload } from '../../store/usePreload';

function findStreamById(streams, id) {
  if (id == null || !Array.isArray(streams)) return null;
  const sid = String(id);
  return streams.find((s) => s && String(s.id) === sid) || null;
}

export function HomeShellContent() {
  const navigate = useNavigate();
  const { play } = usePlayer();
  const { epg } = usePreload();
  const adsQuery = useAdsQuery({ enabled: true });

  const handleActivate = useCallback(
    (ad) => {
      if (!ad) return;

      const actionUrl = ad.actionUrl;
      const generic = ad.genericData != null ? String(ad.genericData) : '';

      const isValidUrl =
        actionUrl &&
        typeof actionUrl === 'string' &&
        actionUrl !== '#' &&
        actionUrl !== 'null' &&
        actionUrl !== 'undefined';

      if (isValidUrl) {
        try {
          window.open(actionUrl, '_blank', 'noopener,noreferrer');
        } catch {
          window.location.href = actionUrl;
        }
        return;
      }

      if (generic.startsWith('stream_id')) {
        const parts = generic.split('=');
        const rawId = parts.length > 1 ? parts[1] : '';
        const id = parseInt(rawId, 10);
        if (Number.isNaN(id)) return;
        const stream = findStreamById(epg.streams, id);
        if (!stream) {
          if (import.meta.env?.DEV) {
            console.warn('[HomeShellContent] stream no encontrado para id', id);
          }
          return;
        }
        const streamId = stream.epgStreamId ?? stream.id;
        let url = stream.url || stream.streamUrl || stream.hlsUrl || stream.hls;
        if (!url && streamId != null) {
          try {
            url = panaccessService.getStreamM3u8Url({ streamId });
          } catch (e) {
            if (import.meta.env?.DEV) console.warn('[HomeShellContent] getStreamM3u8Url', e);
          }
        }
        try {
          url = panaccessService.normalizePlaybackUrl(url);
        } catch (e) {
          if (import.meta.env?.DEV) console.warn('[HomeShellContent] normalizePlaybackUrl', e);
        }
        if (url) {
          play({
            type: 'service',
            id: stream.id,
            url,
            item: stream,
            autoPlay: true,
          });
        }
        return;
      }

      if (generic.startsWith('catchup_id=')) {
        const id = parseInt(generic.split('=')[1], 10);
        if (Number.isNaN(id)) return;
        try {
          const url = panaccessService.normalizePlaybackUrl(panaccessService.getCatchupM3u8Url({ catchupId: id }));
          if (url) {
            play({ type: 'catchup', id, url, item: { catchupId: id }, autoPlay: true });
          }
        } catch (e) {
          if (import.meta.env?.DEV) console.warn('[HomeShellContent] catchup', e);
        }
        return;
      }

      if (generic.startsWith('vod_id=')) {
        const id = parseInt(generic.split('=')[1], 10);
        if (Number.isNaN(id)) return;
        navigate('/home/vod', { state: { adOpenVodId: id } });
      }
    },
    [epg.streams, navigate, play]
  );

  const { top, bottom } = adsQuery.data || { top: [], bottom: [] };
  const hasTop = Array.isArray(top) && top.length > 0;
  const hasBottom = Array.isArray(bottom) && bottom.length > 0;

  return (
    <div className="home-content-stack">
      {hasTop && (
        <AdZone
          key={`top-${top.map((a) => a.id).join('-')}`}
          zoneKey="top"
          ads={top}
          onActivate={handleActivate}
        />
      )}
      <div className="home-content-outlet">
        <Outlet />
      </div>
      {hasBottom && (
        <AdZone
          key={`bottom-${bottom.map((a) => a.id).join('-')}`}
          zoneKey="bottom"
          ads={bottom}
          onActivate={handleActivate}
        />
      )}
    </div>
  );
}

export default HomeShellContent;
