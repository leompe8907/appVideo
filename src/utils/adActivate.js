/**
 * Handler único para activar anuncios (click/enter).
 * Mantiene comportamiento alineado entre HomeShellContent y BouquetPage.
 */

/**
 * @param {Array} streams
 * @param {string|number} id
 * @returns {object|null}
 */
function findStreamById(streams, id) {
  if (id == null || !Array.isArray(streams)) return null;
  const sid = String(id);
  return streams.find((s) => s && String(s.id) === sid) || null;
}

/**
 * Crea un handler (closure) para `onActivate` de `AdZone`.
 *
 * @param {{
 *   epgStreams: Array,
 *   play: Function,
 *   requestPlayChannel?: Function,
 *   requestPlayMedia?: Function,
 *   t?: Function,
 *   navigate: Function,
 *   panaccessService: any,
 * }} deps
 */
export function createAdActivateHandler(deps) {
  const {
    epgStreams,
    play,
    requestPlayChannel,
    requestPlayMedia,
    t,
    navigate,
    panaccessService,
  } = deps || {};

  return (ad) => {
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

      const stream = findStreamById(epgStreams, id);
      if (!stream) return;

      const streamId = stream.epgStreamId ?? stream.id;
      let url = stream.url || stream.streamUrl || stream.hlsUrl || stream.hls;
      if (!url && streamId != null) {
        try {
          url = panaccessService.getStreamM3u8Url({ streamId });
        } catch {
          // noop
        }
      }
      try {
        url = panaccessService.normalizePlaybackUrl(url);
      } catch {
        // noop
      }

      if (url && requestPlayChannel) {
        requestPlayChannel({
          channel: stream,
          playFn: () =>
            play?.({
              type: 'service',
              id: stream.id,
              url,
              item: stream,
              autoPlay: true,
            }),
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
          if (requestPlayMedia) {
            requestPlayMedia({
              item: { catchupId: id },
              ratingRaw: null,
              title: t?.('parental.restrictedTitle', { defaultValue: 'Contenido restringido' }),
              message: t?.('parental.restrictedMessage', { defaultValue: 'Ingresa el PIN para reproducir contenido restringido por clasificación.' }),
              playFn: () => play?.({ type: 'catchup', id, url, item: { catchupId: id }, autoPlay: true }),
            });
          } else {
            play?.({ type: 'catchup', id, url, item: { catchupId: id }, autoPlay: true });
          }
        }
      } catch {
        // noop
      }
      return;
    }

    if (generic.startsWith('vod_id=')) {
      const id = parseInt(generic.split('=')[1], 10);
      if (Number.isNaN(id)) return;
      navigate?.('/home/vod', { state: { adOpenVodId: id } });
    }
  };
}

