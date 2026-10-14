import { useEffect, useRef, useState } from 'react';

/**
 * Estadísticas del reproductor (diagnóstico de cortes y saltos): perfil de
 * descarga, red, segmentos .ts (descargado vs. reproduciendo), buffer, ajuste
 * al vivo, idioma y memoria. Mismo contenido que el panel de Fire TV
 * (apps/vega/src/player/StatsPanel.jsx). Se actualiza cada 1 s.
 * Datos: `getDiagnostics()` del PlayerContext (hls.js, ver hlsDiagnostics.js).
 */
const fmtS = (s) => (s == null ? '—' : `${s.toFixed(1)} s`);
const fmtKbps = (k) => (!k ? '—' : k >= 1000 ? `${(k / 1000).toFixed(2)} Mbps` : `${k} kbps`);
const ago = (at) => (at ? `${Math.round((Date.now() - at) / 1000)} s` : '—');

function Row({ label, value, warn }) {
  return (
    <div className="player-stats__row">
      <span className="player-stats__label">{label}</span>
      <span className={`player-stats__value${warn ? ' player-stats__value--warn' : ''}`}>{value}</span>
    </div>
  );
}

export function PlayerStatsPanel({ getDiagnostics }) {
  const [d, setD] = useState(() => getDiagnostics?.() || null);
  // `getDiagnostics` cambia de identidad en cada render del PlayerContext:
  // se lee desde un ref para no reiniciar el intervalo en cada render.
  const getRef = useRef(getDiagnostics);
  useEffect(() => {
    getRef.current = getDiagnostics;
  }, [getDiagnostics]);
  useEffect(() => {
    const timer = setInterval(() => setD(getRef.current?.() || null), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!d || d.error) {
    return (
      <div className="player-stats" aria-hidden="true">
        <div className="player-stats__title">Estadísticas</div>
        <div className={`player-stats__value${d?.error ? ' player-stats__value--warn' : ''}`}>
          {d?.error || 'No disponible con este reproductor (solo HLS con hls.js)'}
        </div>
      </div>
    );
  }

  const p = d.profile;
  const net = d.net || {};
  const lastV = net.last?.video;
  const lastA = net.last?.audio;
  const recentV = net.recent || [];
  const avgKbps = recentV.length ? Math.round(recentV.reduce((a, r) => a + r.kbps, 0) / recentV.length) : 0;
  const avgVideoKb = recentV.length ? Math.round(recentV.reduce((a, r) => a + r.bytes, 0) / recentV.length / 1024) : 0;
  const segText = (x) => (x ? `${x.name} · ${Math.round(x.bytes / 1024)} KB · ${x.ms} ms · hace ${ago(x.at)}` : '—');
  const bufferingPct = d.uptimeS > 0 ? Math.round((d.bufferingS / d.uptimeS) * 100) : 0;
  const lowBuffer = d.state === 'playing' && d.bufferAheadS < 2;
  const slowNet = p && avgKbps > 0 && avgKbps < p.kbps * 1.2;
  const lat = d.latency || {};
  const lb = d.liveBuffer;

  return (
    <div className="player-stats" aria-hidden="true">
      <div className="player-stats__title">
        {`Estadísticas · ${d.live ? 'En vivo' : 'VOD'} · ${d.state || '—'} · ${d.uptimeS} s · ${d.engine}`}
      </div>

      <div className="player-stats__section">Perfil de descarga</div>
      <Row
        label="Actual"
        value={p ? `${p.width || '?'}×${p.height || '?'}${p.fps ? ` @${Math.round(p.fps)}` : ''} · ${fmtKbps(p.kbps)}` : '—'}
      />
      <Row label="Códecs" value={p?.codecs || '—'} />
      <Row
        label="Perfiles"
        value={(d.profiles || []).map((x) => `${x.active ? '▶' : ''}${x.height || '?'}p/${fmtKbps(x.kbps)}`).join('  ') || '—'}
      />
      <Row label="Cambios ABR" value={String(d.switches)} />

      <div className="player-stats__section">Red</div>
      <Row
        label="Estimado (hls.js)"
        value={`${fmtKbps(d.estimatedKbps)}${d.downlinkMbps ? ` · navegador ${d.downlinkMbps} Mbps` : ''}`}
        warn={p && d.estimatedKbps > 0 && d.estimatedKbps < p.kbps}
      />
      <Row
        label="Video, últimos 5"
        value={recentV.length ? `${fmtKbps(avgKbps)} · ${avgVideoKb} KB promedio` : '—'}
        warn={slowNet}
      />
      <Row label="Último .ts descargado" value={segText(lastV)} />
      <Row
        label=".ts reproduciendo"
        value={d.playing ? `${d.playing.name}${d.segmentsAhead != null ? ` · ${d.segmentsAhead} .ts descargados por delante` : ''}` : '—'}
        warn={d.segmentsAhead != null && d.segmentsAhead < 1}
      />
      {lastA ? <Row label="Último .ts audio" value={segText(lastA)} /> : null}
      <Row
        label="Descargas"
        value={`${net.counts?.video || 0} .ts video${net.counts?.audio ? ` · ${net.counts.audio} .ts audio` : ''} · ${net.manifests || 0} m3u8 · ${net.keys || 0} keys · ${((net.bytes || 0) / 1048576).toFixed(1)} MB`}
      />

      <div className="player-stats__section">Buffer y cortes</div>
      <Row label="Buffer adelante" value={fmtS(d.bufferAheadS)} warn={lowBuffer} />
      {d.live ? (
        <Row
          label="Latencia vivo"
          value={`${fmtS(d.latencyS)}${lat.distanceSegs != null ? ` (${lat.distanceSegs.toFixed(1)} .ts del borde, objetivo ${lat.targetSegs ?? '?'})` : ''}${d.playlistSegments != null ? ` · manifiesto ${d.playlistSegments} .ts` : ''}${d.segmentDurationS ? ` · .ts de ${d.segmentDurationS.toFixed(1)} s` : ''}`}
          warn={lat.distanceSegs != null && lat.targetSegs != null && lat.distanceSegs < lat.targetSegs - 0.75}
        />
      ) : null}
      {d.live ? (
        <Row
          label="Ajuste al vivo"
          value={`ritmo ${(lat.rate || 1).toFixed(2)}× · ${lat.slowdowns || 0} frenadas · ${lat.backJumps || 0} saltos atrás${lat.rateUnsupported ? ' · el equipo no cambia la velocidad' : ''}`}
          warn={(lat.rate || 1) !== 1}
        />
      ) : null}
      {lb ? (
        <Row
          label="Config. (marca)"
          value={`${lb.liveSyncDurationCount} .ts del vivo (mín ${lb.liveMinLatencyDurationCount}, máx ${lb.liveMaxLatencyDurationCount}) · ${lb.maxBufferLength} s adelante · ${lb.backBufferLength} s atrás`}
        />
      ) : null}
      <Row
        label="Cortes / saltos"
        value={`${d.stalls} cortes · ${d.gaps} saltos · ${fmtS(d.bufferingS)} cargando (${bufferingPct}%)`}
        warn={d.stalls > 0 || d.gaps > 0 || bufferingPct >= 5}
      />
      <Row label="Cuadros" value={`${d.dropped} perdidos de ${d.decoded}`} warn={d.dropped > 0} />
      <Row
        label="Errores"
        value={net.errors?.length ? net.errors.map((e) => `${e.code}${e.fatal ? ' (fatal)' : ''} hace ${ago(e.at)}`).join('  ') : 'ninguno'}
        warn={net.errors?.length > 0}
      />

      <div className="player-stats__section">Otros</div>
      <Row
        label="Idioma"
        value={`audio ${p?.audioLang || '—'}${d.audioLangs?.length > 1 ? ` (de ${d.audioLangs.join(', ')})` : ''} · subtítulos ${d.textLang || 'no'}`}
      />
      <Row
        label="Memoria"
        value={`app ${d.jsHeapMb != null ? `${d.jsHeapMb} MB` : '—'}${d.deviceMemoryGb ? ` · equipo ${d.deviceMemoryGb} GB` : ''}`}
      />
    </div>
  );
}

export default PlayerStatsPanel;
