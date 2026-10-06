/**
 * Bouquet y canal elegidos en el home, para volver al mismo lugar al salir
 * del reproductor (dura lo que dura la app).
 */
const memory = {bouquetIndex: 0, channelIndex: null};

export const getHomeMemory = () => ({...memory});

export function rememberBouquet(index) {
  memory.bouquetIndex = index;
}

export function rememberChannel(index) {
  memory.channelIndex = index;
}

export function resetHomeMemory() {
  memory.bouquetIndex = 0;
  memory.channelIndex = null;
}
