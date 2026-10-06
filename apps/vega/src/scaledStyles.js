import {Dimensions, StyleSheet} from 'react-native';

/**
 * Los estilos se escriben en píxeles de una TV de 1920×1080 (como los diseños
 * de la web) y se escalan al ancho lógico real: en el Fire TV Stick son
 * 960×540 con escala 2.
 */
const DESIGN_WIDTH = 1920;
const factor = Dimensions.get('window').width / DESIGN_WIDTH;

const UNSCALED = new Set(['flex', 'flexGrow', 'flexShrink', 'opacity', 'zIndex', 'scale', 'aspectRatio', 'fontWeight']);

/**
 * Agrandado extra para pantallas de lectura a distancia (login, smartcard):
 * las medidas de la web a 1920 se ven chicas en una TV a ~1 m.
 */
export const ENTRY_SCALE = 1.35;

export function px(n, extra = 1) {
  return Math.round(n * factor * extra);
}

function scaleValue(key, value, extra) {
  if (typeof value === 'number') {
    if (UNSCALED.has(key)) return value;
    if (key === 'borderWidth') return Math.max(1, px(value));
    return px(value, extra);
  }
  if (Array.isArray(value)) return value.map((v) => scaleValue(key, v, extra));
  if (value && typeof value === 'object') return scaleObject(value, extra);
  return value;
}

function scaleObject(obj, extra) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = scaleValue(k, v, extra);
  return out;
}

/**
 * Como `StyleSheet.create`, con los números escalados (ver arriba).
 * `extra` agranda todo en la misma proporción (p. ej. ENTRY_SCALE); los
 * bordes no se agrandan.
 */
export function createScaledStyles(styles, extra = 1) {
  return StyleSheet.create(scaleObject(styles, extra));
}
