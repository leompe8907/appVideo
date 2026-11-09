/**
 * Ventana de elementos montados alrededor del que tiene el foco (índices
 * inclusivos). Listas largas (canales de la Guía, rieles de Catchup) montadas
 * enteras cuestan segundos y miles de nodos en un TV de 2020. La navegación
 * espacial solo ve lo montado, por eso la ventana incluye varios elementos por
 * delante del foco.
 */
export function getMountedRange(focusIndex, total, behind, ahead) {
  // Si la lista se achica (recarga de la EPG/Catchup) el foco guardado puede quedar más allá del final.
  const focus = Math.min(Math.max(focusIndex, 0), Math.max(total - 1, 0));
  return { start: Math.max(0, focus - behind), end: Math.min(total - 1, focus + ahead) };
}
