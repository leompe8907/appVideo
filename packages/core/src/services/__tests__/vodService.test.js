import { describe, it, expect, vi } from 'vitest';
import { prepareDataForVOD, FALLBACK_MOVIES_CATEGORY_ID, dedupeOttShelves, loadVODData } from '../vodService.js';
import panaccessService from '../panaccessService.js';

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

describe('dedupeOttShelves', () => {
  const cat = (id, groupId, ids) => ({ id, groupId, name: `c${id}`, vods: ids.map((v) => ({ id: v })) });

  it('quita filas de menos de 2 títulos y repetidas entre grupos; dentro del grupo no', () => {
    const out = dedupeOttShelves([
      cat(10, 1, [1, 2]), // Acción (Genero)
      cat(11, 1, [1, 2]), // Aventura (Genero): mismos títulos, mismo grupo → queda
      cat(20, 5, [2, 1]), // Acción (Listas): repite la de otro grupo → afuera
      cat(21, 5, [3]), // un solo título → afuera
      { id: 0, name: 'Séries', vods: [{ id: 9 }] }, // series siempre
    ]);
    expect(out.map((c) => c.id)).toEqual([10, 11, 0]);
  });

  it('entre grupos deja una sola fila por nombre, la de más títulos', () => {
    const named = (id, groupId, name, ids) => ({ ...cat(id, groupId, ids), name });
    const out = dedupeOttShelves([
      named(10, 1, 'Acción', [1, 2]),
      named(20, 5, 'Acción', [1, 2, 3]),
      named(21, 5, 'Drama', [4, 5]),
    ]);
    expect(out.map((c) => c.id)).toEqual([20, 21]);
  });
});

describe('loadVODData con getOttCategoryGroups', () => {
  it('sin grupos en la librería arma las filas con los grupos curados de OTT', async () => {
    vi.spyOn(panaccessService, 'getVodLibraries').mockResolvedValue([{ id: 1, categoryGroups: [] }]);
    vi.spyOn(panaccessService, 'getOttCategoryGroups').mockResolvedValue([
      { id: 100, type: 1, name: 'Genero', categories: [{ id: 10, name: 'Acción' }, { id: 11, name: 'Drama' }] },
      { id: 200, type: 3, name: 'Actor', categories: [{ id: 30, name: 'Tom Hanks' }] },
      { id: 300, type: 6, name: 'Recomendado', categories: [{ id: 60, name: 'Recomendado' }] },
    ]);
    vi.spyOn(panaccessService, 'getVodContent')
      .mockResolvedValueOnce([
        { id: 1, name: 'A', categories: [10, 60, 30] },
        { id: 2, name: 'B', categories: [10, 11, 60] },
        { id: 3, name: 'C', categories: [11] },
      ])
      .mockResolvedValue([]);

    const out = await loadVODData({ drm: 'https://x' }, { t });
    expect(out.categories.map((c) => c.name)).toEqual(['Acción', 'Drama']);
    expect(out.vodRecommended.map((v) => v.id)).toEqual([1, 2]);
    expect(out.allVods.find((v) => v.id === 1).actorNames).toEqual(['Tom Hanks']);
    vi.restoreAllMocks();
  });
});
