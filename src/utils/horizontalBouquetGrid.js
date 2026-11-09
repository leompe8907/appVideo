/**
 * Utilidades de matriz para bouquets horizontales (grid column-flow / row-flow).
 */

/**
 * Agrupa tarjetas en filas lógicas con relleno por columnas (horizontal_grid del PDF).
 * Índice i → fila (i % rowsN), columna floor(i / rowsN).
 *
 * @param {HTMLElement[]} cards
 * @param {number} rowsN
 * @returns {HTMLElement[][]}
 */
export function buildColumnFlowGridRows(cards, rowsN) {
  const list = cards.filter((c) => c instanceof HTMLElement);
  const n = Math.max(1, Math.floor(Number(rowsN) || 1));
  if (!list.length) return [];

  const buckets = Array.from({ length: n }, () => []);
  list.forEach((card, index) => {
    buckets[index % n].push(card);
  });
  return buckets.filter((row) => row.length > 0);
}

/**
 * @param {number} index
 * @param {number} rowsN
 * @returns {{ row: number, col: number }}
 */
export function columnFlowIndexToCell(index, rowsN) {
  const n = Math.max(1, Math.floor(Number(rowsN) || 1));
  return {
    row: index % n,
    col: Math.floor(index / n),
  };
}

/**
 * @param {number} row
 * @param {number} col
 * @param {number} rowsN
 * @returns {number}
 */
export function columnFlowCellToIndex(row, col, rowsN) {
  const n = Math.max(1, Math.floor(Number(rowsN) || 1));
  return col * n + row;
}

/**
 * Agrupa ítems en columnas (relleno column-major) para Embla multi-fila en PC.
 * @template T
 * @param {T[]} items
 * @param {number} rowsN
 * @returns {Array<Array<{ item: T, index: number }>>}
 */
export function groupItemsIntoColumnMajorColumns(items, rowsN) {
  const list = Array.isArray(items) ? items : [];
  const n = Math.max(1, Math.floor(Number(rowsN) || 1));
  if (!list.length) return [];

  const numCols = Math.ceil(list.length / n);
  const columns = [];

  for (let col = 0; col < numCols; col += 1) {
    const column = [];
    for (let row = 0; row < n; row += 1) {
      const index = col * n + row;
      if (index < list.length) {
        column.push({ item: list[index], index });
      }
    }
    if (column.length) columns.push(column);
  }

  return columns;
}
