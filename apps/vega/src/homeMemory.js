/**
 * Dónde estaba el usuario en el home (sección, bouquet y canal), para volver
 * al mismo lugar al salir del reproductor (dura lo que dura la app).
 */
const memory = {section: 'inicio', bouquetKey: null, channelId: null};

export const getHomeMemory = () => ({...memory});

export function rememberSection(section) {
  memory.section = section;
}

export function rememberPlayback(bouquetKey, channelId) {
  memory.bouquetKey = bouquetKey;
  memory.channelId = channelId == null ? null : String(channelId);
}

/** El reproductor actualiza el canal al hacer zapping. */
export function rememberChannel(channelId) {
  memory.channelId = channelId == null ? null : String(channelId);
}

export function resetHomeMemory() {
  memory.section = 'inicio';
  memory.bouquetKey = null;
  memory.channelId = null;
}
