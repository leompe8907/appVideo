/**
 * Dónde estaba el usuario en el home (sección, bouquet y canal), para volver
 * al mismo lugar al salir del reproductor (dura lo que dura la app).
 */
const memory = {section: 'inicio', bouquetKey: null, channelIndex: null};

export const getHomeMemory = () => ({...memory});

export function rememberSection(section) {
  memory.section = section;
}

export function rememberPlayback(bouquetKey, channelIndex) {
  memory.bouquetKey = bouquetKey;
  memory.channelIndex = channelIndex;
}

/** El reproductor actualiza el canal al hacer zapping dentro del bouquet. */
export function rememberChannel(channelIndex) {
  memory.channelIndex = channelIndex;
}

export function resetHomeMemory() {
  memory.section = 'inicio';
  memory.bouquetKey = null;
  memory.channelIndex = null;
}
