import {Dimensions, StyleSheet} from 'react-native';

/**
 * Los estilos se escriben en píxeles de una TV de 1920×1080 (como los diseños
 * de la web) y se escalan al ancho lógico real: en el Fire TV Stick son
 * 960×540 con escala 2.
 */
const DESIGN_WIDTH = 1920;
const factor = Dimensions.get('window').width / DESIGN_WIDTH;

const UNSCALED = new Set(['flex', 'flexGrow', 'flexShrink', 'opacity', 'zIndex', 'scale', 'aspectRatio', 'fontWeight']);

export function px(n) {
  return Math.round(n * factor);
}

function scaleValue(key, value) {
  if (typeof value === 'number') {
    if (UNSCALED.has(key)) return value;
    if (key === 'borderWidth') return Math.max(1, px(value));
    return px(value);
  }
  if (Array.isArray(value)) return value.map((v) => scaleValue(key, v));
  if (value && typeof value === 'object') return scaleObject(value);
  return value;
}

function scaleObject(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = scaleValue(k, v);
  return out;
}

/** Como `StyleSheet.create`, con los números escalados (ver arriba). */
export function createScaledStyles(styles) {
  return StyleSheet.create(scaleObject(styles));
}
