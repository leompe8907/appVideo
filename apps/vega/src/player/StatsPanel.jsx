import * as React from 'react';
import {useEffect, useState} from 'react';
import {Text, View} from 'react-native';
import {createScaledStyles} from '../scaledStyles';

const fmtS = (s) => (s == null ? '—' : `${s.toFixed(1)} s`);
const fmtKbps = (k) => (!k ? '—' : k >= 1000 ? `${(k / 1000).toFixed(2)} Mbps` : `${k} kbps`);
const ago = (at) => (at ? `${Math.round((Date.now() - at) / 1000)} s` : '—');

function Row({label, value, warn}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, warn && styles.warn]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Estadísticas del reproductor (diagnóstico de cortes y repeticiones):
 * perfil de descarga, ancho de banda, buffer, cortes, segmentos .ts, idioma
 * y memoria de la app. Se actualiza cada 1 s. `playerRef.current` es el
 * VegaHlsPlayer en uso.
 */
export function StatsPanel({playerRef}) {
  const [d, setD] = useState(null);
  useEffect(() => {
    const timer = setInterval(() => setD(playerRef.current?.getDiagnostics?.() || null), 1000);
    return () => clearInterval(timer);
  }, [playerRef]);

  if (!d) {
    return (
      <View style={styles.box} pointerEvents="none">
        <Text style={styles.title}>Estadísticas</Text>
        <Text style={styles.value}>Sin reproductor activo</Text>
      </View>
    );
  }
  if (d.error) {
    return (
      <View style={styles.box} pointerEvents="none">
        <Text style={styles.title}>Estadísticas</Text>
        <Text style={styles.warn}>{d.error}</Text>
      </View>
    );
  }

  const p = d.profile;
  const net = d.net || {};
  const last = net.last;
  const avgKbps = net.recent?.length ? Math.round(net.recent.reduce((a, r) => a + r.kbps, 0) / net.recent.length) : 0;
  const lowBuffer = d.state === 'playing' && d.bufferAheadS < 2;
  const slowNet = p && avgKbps > 0 && avgKbps < p.kbps * 1.2;

  return (
    <View style={styles.box} pointerEvents="none">
      <Text style={styles.title}>{`Estadísticas · ${d.live ? 'En vivo' : 'VOD'} · ${d.state || '—'} · ${d.uptimeS} s`}</Text>

      <Text style={styles.section}>Perfil de descarga</Text>
      <Row label="Actual" value={p ? `${p.width}×${p.height}${p.fps ? ` @${Math.round(p.fps)}` : ''} · ${fmtKbps(p.kbps)}` : '—'} />
      <Row label="Códecs" value={p?.codecs || '—'} />
      <Row label="Perfiles" value={(d.profiles || []).map((x) => `${x.active ? '▶' : ''}${x.height}p/${fmtKbps(x.kbps)}`).join('  ') || '—'} />
      <Row label="Cambios ABR" value={String(d.switches)} />

      <Text style={styles.section}>Red</Text>
      <Row label="Estimado (Shaka)" value={fmtKbps(d.estimatedKbps)} warn={p && d.estimatedKbps > 0 && d.estimatedKbps < p.kbps} />
      <Row label="Últimos 5 .ts" value={fmtKbps(avgKbps)} warn={slowNet} />
      <Row label="Último .ts" value={last ? `${last.name} · ${Math.round(last.bytes / 1024)} KB · ${last.ms} ms · hace ${ago(last.at)}` : '—'} />
      <Row label="Descargas" value={`${net.segments} .ts · ${net.manifests} m3u8 · ${net.keys} keys · ${(net.bytes / 1048576).toFixed(1)} MB`} />

      <Text style={styles.section}>Buffer y cortes</Text>
      <Row label="Buffer adelante" value={fmtS(d.bufferAheadS)} warn={lowBuffer} />
      {d.live ? <Row label="Latencia vivo" value={fmtS(d.latencyS)} /> : null}
      <Row label="Cortes / saltos" value={`${d.stalls} cortes · ${d.gaps} saltos · ${fmtS(d.bufferingS)} cargando`} warn={d.stalls > 0} />
      <Row label="Cuadros" value={`${d.dropped} perdidos de ${d.decoded}`} warn={d.dropped > 0} />
      <Row
        label="Errores"
        value={net.errors?.length ? net.errors.map((e) => `${e.code} (hace ${ago(e.at)})`).join('  ') : 'ninguno'}
        warn={net.errors?.length > 0}
      />

      <Text style={styles.section}>Otros</Text>
      <Row label="Idioma" value={`audio ${p?.audioLang || '—'} · subtítulos ${d.textLang || 'no'}`} />
      <Row label="Memoria app (JS)" value={d.jsHeapMb != null ? `${d.jsHeapMb} MB` : '—'} />
    </View>
  );
}

// A 1920×1080.
const styles = createScaledStyles({
  box: {
    position: 'absolute',
    top: 100,
    right: 24,
    width: 820,
    zIndex: 40,
    padding: 20,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  title: {color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 6},
  section: {color: '#7fd3ff', fontSize: 19, fontWeight: '700', marginTop: 12, marginBottom: 4},
  row: {flexDirection: 'row', paddingVertical: 2},
  label: {width: 220, color: 'rgba(255,255,255,0.65)', fontSize: 18},
  value: {flex: 1, color: '#fff', fontSize: 18, fontVariant: ['tabular-nums']},
  warn: {color: '#ffb35c'},
});

// Visible o no: se recuerda entre canales y reproductores mientras la app esté abierta.
let statsVisible = false;
export const getStatsVisible = () => statsVisible;
export const setStatsVisible = (v) => {
  statsVisible = v;
};
