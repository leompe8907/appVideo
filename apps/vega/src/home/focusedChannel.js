import {useSyncExternalStore} from 'react';

// Canal con foco en el muro de Inicio, para la subcabecera. Fuera del estado del
// home a propósito: cambiar el foco sólo re-dibuja a quien lo lee, no el muro.
let current = null;
const listeners = new Set();

export function getFocusedChannel() {
  return current;
}

export function setFocusedChannel(channel) {
  if (channel === current) return;
  current = channel;
  listeners.forEach((listener) => listener());
}

export function subscribeFocusedChannel(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useFocusedChannel() {
  return useSyncExternalStore(subscribeFocusedChannel, getFocusedChannel);
}
