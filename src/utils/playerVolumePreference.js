/**
 * Memoria de volumen/mute del reproductor, global por marca (no por canal --
 * a diferencia de audio/subtítulos en `playerTrackPreferences.js`, el
 * volumen es una sola preferencia del dispositivo, igual que el volumen del
 * sistema operativo o el de YouTube/Netflix).
 *
 * Solo tiene efecto si el brand activa `features.playerVolumeControls` (ver
 * `brands.js`) -- si el flag está apagado, este módulo simplemente no se usa
 * (el HUD no muestra el control y `PlayerContext` no lo consulta).
 */

const STORAGE_PREFIX = 'player.volume.';

function storageKey(brandId) {
  const id = String(brandId || 'default').trim() || 'default';
  return `${STORAGE_PREFIX}${id}`;
}

/** @returns {{ volume: number, muted: boolean }} */
export function getSavedVolumePreference(brandId) {
  try {
    const raw = localStorage.getItem(storageKey(brandId));
    if (!raw) return { volume: 1, muted: false };
    const parsed = JSON.parse(raw);
    const volume = Number.isFinite(parsed?.volume) ? Math.min(1, Math.max(0, parsed.volume)) : 1;
    const muted = parsed?.muted === true;
    return { volume, muted };
  } catch {
    return { volume: 1, muted: false };
  }
}

export function saveVolumePreference(brandId, { volume, muted }) {
  try {
    const safeVolume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;
    localStorage.setItem(
      storageKey(brandId),
      JSON.stringify({ volume: safeVolume, muted: muted === true }),
    );
  } catch {
    // noop -- localStorage puede fallar (modo privado, cuota, etc), no es crítico.
  }
}
