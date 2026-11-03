import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let brand = { brand: 'demo' };
vi.mock('../../contexts/BrandContext', () => ({ useBrand: () => ({ currentBrand: brand }) }));

const { usePreloadStore } = await import('@appvideo/core/store/preloadStore');
const { useBackgroundEpgPreload } = await import('../useBackgroundEpgPreload.js');

function Probe() {
  useBackgroundEpgPreload();
  return null;
}

describe('useBackgroundEpgPreload', () => {
  let container;
  let root;
  let loadEPG;
  let original;

  beforeEach(() => {
    original = usePreloadStore.getState();
    loadEPG = vi.fn();
    brand = { brand: 'demo' };
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    usePreloadStore.setState({ epg: original.epg, loadEPG: original.loadEPG });
  });

  it('con la EPG sin cargar, la pide en segundo plano', () => {
    usePreloadStore.setState({ epg: { ...original.epg, status: 'idle' }, loadEPG });
    act(() => root.render(createElement(Probe)));
    expect(loadEPG).toHaveBeenCalledTimes(1);
    expect(loadEPG).toHaveBeenCalledWith(brand);
  });

  it('no repite la carga si ya está cargando, lista o con error', () => {
    for (const status of ['loading', 'ready', 'error']) {
      usePreloadStore.setState({ epg: { ...original.epg, status }, loadEPG });
      act(() => root.render(createElement(Probe)));
    }
    expect(loadEPG).not.toHaveBeenCalled();
  });
});
