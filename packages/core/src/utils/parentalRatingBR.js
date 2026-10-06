/**
 * Normaliza la clasificación indicativa Brasil desde backend.
 * Entradas posibles:
 * - number: 0, 10, 12, 14, 16, 18
 * - string: "L", "AL", "A10", "A12", "14", "+16", "16+"
 *
 * Salida:
 * - 0 | 10 | 12 | 14 | 16 | 18 | null
 */
export function normalizeBrParentalRating(raw) {
  if (raw == null) return null;

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    if (raw === 0) return 0; // Confirmado: 0 = Livre
    if (raw === 10 || raw === 12 || raw === 14 || raw === 16 || raw === 18) return raw;
    return null;
  }

  const s = String(raw).trim().toUpperCase();
  if (!s) return null;

  if (s === 'L' || s === 'AL') return 0;

  const map = { A10: 10, A12: 12, A14: 14, A16: 16, A18: 18 };
  if (map[s] != null) return map[s];

  // Extraer dígitos (soporta "+14", "14+", "rating:14")
  const m = s.match(/\d{2}/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  if (n === 0) return 0;
  if (n === 10 || n === 12 || n === 14 || n === 16 || n === 18) return n;
  return null;
}

export function formatBrRatingLabel(value) {
  const v = normalizeBrParentalRating(value);
  if (v == null) return '';
  if (v === 0) return 'L';
  return String(v);
}

