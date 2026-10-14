import Hls from 'hls.js';

/**
 * Estadísticas del reproductor hls.js para el panel del HUD (mismo contenido
 * que el panel de Fire TV, apps/vega/src/player/StatsPanel.jsx): perfil de
 * descarga, red, segmentos .ts (descargado vs. reproduciendo), buffer, cortes,
 * idioma y memoria. Solo escucha eventos y lee estado: no cambia nada de la
 * reproducción.
 */
const RECENT = 5;
const MAX_ERRORS = 5;

const segName = (url) => {
  try {
    return String(url || '').split('?')[0].split('/').pop() || '—';
  } catch {
    return '—';
  }
};

export function attachHlsDiagnostics(hls, video, { liveBuffer, guard } = {}) {
  const startedAt = Date.now();
  const net = {
    last: { video: null, audio: null },
    recent: [],
    counts: { video: 0, audio: 0 },
    bytes: 0,
    manifests: 0,
    keys: 0,
    errors: [],
  };
  let playing = null; // sn y nombre del .ts que se está viendo
  let switches = 0;
  let stalls = 0;
  let gaps = 0;
  let bufferingMs = 0;
  let waitingSince = null;

  const onFragLoaded = (_e, data) => {
    const frag = data?.frag;
    if (!frag) return;
    const s = frag.stats || {};
    const bytes = Number(s.loaded || s.total) || 0;
    const ms = Math.max(1, Math.round((s.loading?.end || 0) - (s.loading?.start || 0)));
    const entry = { sn: frag.sn, name: segName(frag.url), bytes, ms, kbps: Math.round((bytes * 8) / ms), at: Date.now() };
    const kind = frag.type === 'audio' ? 'audio' : 'video';
    net.last[kind] = entry;
    net.counts[kind] += 1;
    net.bytes += bytes;
    if (kind === 'video') {
      net.recent.push(entry);
      if (net.recent.length > RECENT) net.recent.shift();
    }
  };
  const onFragChanged = (_e, data) => {
    if (data?.frag) playing = { sn: data.frag.sn, name: segName(data.frag.url) };
  };
  const onLevelLoaded = () => {
    net.manifests += 1;
  };
  const onKeyLoaded = () => {
    net.keys += 1;
  };
  const onLevelSwitched = () => {
    switches += 1;
  };
  const onError = (_e, data) => {
    const details = data?.details || 'error';
    if (details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) stalls += 1;
    if (details === Hls.ErrorDetails.BUFFER_SEEK_OVER_HOLE || details === Hls.ErrorDetails.BUFFER_NUDGE_ON_STALL) {
      gaps += 1;
    }
    net.errors.push({ code: details, fatal: !!data?.fatal, at: Date.now() });
    if (net.errors.length > MAX_ERRORS) net.errors.shift();
  };
  const onWaiting = () => {
    if (waitingSince == null) waitingSince = Date.now();
  };
  const onPlaying = () => {
    if (waitingSince != null) bufferingMs += Date.now() - waitingSince;
    waitingSince = null;
  };

  hls.on(Hls.Events.FRAG_LOADED, onFragLoaded);
  hls.on(Hls.Events.FRAG_CHANGED, onFragChanged);
  hls.on(Hls.Events.LEVEL_LOADED, onLevelLoaded);
  hls.on(Hls.Events.KEY_LOADED, onKeyLoaded);
  hls.on(Hls.Events.LEVEL_SWITCHED, onLevelSwitched);
  hls.on(Hls.Events.ERROR, onError);
  video?.addEventListener('waiting', onWaiting);
  video?.addEventListener('playing', onPlaying);

  const getDiagnostics = () => {
    try {
      const levelIdx = hls.currentLevel >= 0 ? hls.currentLevel : hls.loadLevel;
      const level = hls.levels?.[levelIdx] || null;
      const details = level?.details || hls.latestLevelDetails || null;
      const now = Number(video?.currentTime) || 0;
      let bufferAheadS = 0;
      const b = video?.buffered;
      for (let i = 0; b && i < b.length; i += 1) {
        if (now >= b.start(i) - 0.5 && now <= b.end(i) + 0.5) bufferAheadS = Math.max(0, b.end(i) - now);
      }
      const quality = video?.getVideoPlaybackQuality?.() || {};
      const audio = hls.audioTracks?.[hls.audioTrack];
      const sub = hls.subtitleDisplay ? hls.subtitleTracks?.[hls.subtitleTrack] : null;
      const mem = typeof performance !== 'undefined' ? performance.memory : null;
      const buffering = waitingSince != null ? Date.now() - waitingSince : 0;
      const lastSn = net.last.video?.sn;
      return {
        engine: 'hls.js',
        state: video?.paused ? 'paused' : waitingSince != null ? 'buffering' : 'playing',
        live: !!details?.live,
        uptimeS: Math.round((Date.now() - startedAt) / 1000),
        profile: level
          ? {
              width: level.width,
              height: level.height,
              kbps: Math.round((level.bitrate || 0) / 1000),
              fps: level.frameRate || null,
              codecs: [level.videoCodec, level.audioCodec].filter(Boolean).join(', '),
              audioLang: audio?.lang || audio?.name || '',
            }
          : null,
        profiles: (hls.levels || [])
          .map((l, i) => ({ height: l.height, kbps: Math.round((l.bitrate || 0) / 1000), active: i === levelIdx }))
          .sort((a, b2) => a.kbps - b2.kbps),
        audioLangs: [...new Set((hls.audioTracks || []).map((t) => t.lang || t.name).filter(Boolean))],
        textLang: sub?.lang || sub?.name || '',
        estimatedKbps: Math.round((hls.bandwidthEstimate || 0) / 1000),
        switches,
        bufferAheadS,
        latencyS: details?.live && Number.isFinite(hls.latency) ? hls.latency : null,
        segmentDurationS: Number(details?.targetduration) || null,
        playlistSegments: details?.fragments?.length ?? null,
        // .ts que se está viendo vs. el último descargado: cuántos hay en el medio.
        playing,
        segmentsAhead: playing && Number.isFinite(lastSn) && Number.isFinite(playing.sn) ? lastSn - playing.sn : null,
        liveBuffer: liveBuffer || null,
        latency: guard
          ? { ...guard.stats, rateUnsupported: guard.rateUnsupported }
          : null,
        stalls,
        gaps,
        bufferingS: (bufferingMs + buffering) / 1000,
        dropped: quality.droppedVideoFrames || 0,
        decoded: quality.totalVideoFrames || 0,
        net: { ...net, last: { ...net.last }, recent: [...net.recent], errors: [...net.errors] },
        jsHeapMb: mem?.usedJSHeapSize ? Math.round(mem.usedJSHeapSize / 1048576) : null,
        deviceMemoryGb: typeof navigator !== 'undefined' ? navigator.deviceMemory ?? null : null,
        downlinkMbps: typeof navigator !== 'undefined' ? navigator.connection?.downlink ?? null : null,
      };
    } catch (err) {
      return { error: String(err?.message || err) };
    }
  };

  const detach = () => {
    try {
      hls.off(Hls.Events.FRAG_LOADED, onFragLoaded);
      hls.off(Hls.Events.FRAG_CHANGED, onFragChanged);
      hls.off(Hls.Events.LEVEL_LOADED, onLevelLoaded);
      hls.off(Hls.Events.KEY_LOADED, onKeyLoaded);
      hls.off(Hls.Events.LEVEL_SWITCHED, onLevelSwitched);
      hls.off(Hls.Events.ERROR, onError);
    } catch {
      /* noop: hls ya destruido */
    }
    video?.removeEventListener('waiting', onWaiting);
    video?.removeEventListener('playing', onPlaying);
  };

  return { getDiagnostics, detach };
}
