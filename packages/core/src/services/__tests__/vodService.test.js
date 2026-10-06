import { describe, it, expect } from 'vitest';
import { prepareDataForVOD, FALLBACK_MOVIES_CATEGORY_ID } from '../vodService.js';

const t = (k) => ({ 'vod.title': 'Películas', 'vod.seriesCategory': 'Séries' })[k] || k;

describe('prepareDataForVOD', () => {
  it('agrupa por categorías cuando la API las manda', () => {
    const vods = [{ id: 1, name: 'A', categories: [10] }, { id: 2, name: 'B', categories: [11] }];
    const out = prepareDataForVOD(vods, [{ id: 10, name: 'Acción' }, { id: 11, name: 'Drama' }], -1, 'https://x', {}, t);
    expect(out.categories.map((c) => [c.name, c.vods.length])).toEqual([['Acción', 1], ['Drama', 1]]);
    expect(out.allVods).toHaveLength(2);
  });

  it('sin grupos de categorías no descarta el contenido: Películas (más nuevas primero) + Séries', () => {
    const vods = [
      { id: 1, name: 'Vieja', isSeries: false, categories: [2], libraryReleaseDate: '2025-01-01 10:00:00' },
      { id: 2, name: 'Nueva', isSeries: false, categories: [2], libraryReleaseDate: '2026-08-31 19:26:00' },
      { id: 3, name: 'Serie', isSeries: true, categories: [4], image1Id: 9 },
    ];
    const out = prepareDataForVOD(vods, [], -1, 'https://x', {}, t);
    expect(out.categories.map((c) => c.name)).toEqual(['Películas', 'Séries']);
    expect(out.categories[0].id).toBe(FALLBACK_MOVIES_CATEGORY_ID);
    expect(out.categories[0].vods.map((v) => v.name)).toEqual(['Nueva', 'Vieja']);
    expect(out.allVods.map((v) => v.id).sort()).toEqual([1, 2, 3]);
    expect(out.categories[1].vods[0]).toHaveProperty('posterListURL');
  });

  it('sin contenido devuelve vacío', () => {
    expect(prepareDataForVOD([], [], -1, '', {}, t)).toEqual({ categories: [], allVods: [], vodRecommended: [] });
  });
});
