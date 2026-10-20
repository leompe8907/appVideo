/** Edad máxima de un perfil de Wind: escala de Brasil (la del backend y de `parentalRatingBR.js`). */

// null = sin límite.
export const MAX_AGE_OPTIONS = [null, 0, 10, 12, 14, 16, 18];

export function maxAgeLabel(t, value) {
  if (value == null) return t('profile.maxAgeNone', { defaultValue: 'Sin límite' });
  if (value === 0) return 'L';
  return String(value);
}
