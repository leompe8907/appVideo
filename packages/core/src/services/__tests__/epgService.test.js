import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadEPGForChannels, DEFAULT_EPG_BATCH_SIZE } from '../epgService.js';

/**
 * Regresión del hallazgo de auditoría "carga de EPG 100% secuencial,
 * canal por canal, con yieldToMain(8ms) que alarga la carga total" —
 * `loadEPGForChannels` ahora pide hasta `batchSize` (default 5) canales en
 * simultáneo en vez de uno por vez. Estos tests verifican con un `fetch`
 * mockeado (controlando cuándo resuelve cada request) que:
 *   1. nunca hay más de `batchSize` requests en vuelo al mismo tiempo,
 *   2. TODOS los canales terminan con `epgItems` asignado,
 *   3. `onProgress` llega a `toProcess` con conteos no decrecientes.
 */
describe('loadEPGForChannels — carga en paralelo por tandas', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function makeChannels(n) {
    return Array.from({ length: n }, (_, i) => ({
      id: `ch-${i}`,
      epgStreamId: 1000 + i,
    }));
  }

  const baseOpts = {
    epgApiKey: 'key',
    epgApiToken: 'token',
    epgCdnUrl: 'https://epg.example.invalid/guide',
    operatorName: 'operator',
  };

  it('nunca supera `batchSize` requests simultáneas y todas terminan con epgItems', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const resolvers = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        return new Promise((resolve) => {
          resolvers.push(() => {
            inFlight -= 1;
            resolve({ text: () => Promise.resolve('[]') });
          });
        });
      }),
    );

    const channels = makeChannels(12);
    const batchSize = 5;
    const donePromise = loadEPGForChannels(channels, { ...baseOpts, batchSize });

    // Dejar que la primera tanda arranque (todas sus requests deberían
    // haberse disparado ya, en paralelo, antes de que ninguna resuelva).
    await Promise.resolve();
    await Promise.resolve();
    expect(inFlight).toBe(Math.min(batchSize, channels.length));

    // Resolver requests de a una, dejando correr microtasks entre medio,
    // hasta drenar todos los canales.
    //
    // OJO: la condición de corte compara contra un CONTADOR ACUMULADO
    // (`resolvedCount`), no contra `resolvers.length` (tamaño de la cola
    // PENDIENTE en este instante). Con batchSize=5 y 12 canales, la cola
    // pendiente nunca llega a 12 (el máximo real son 5 en simultáneo), así
    // que `resolvers.length < channels.length` es siempre verdadero y nunca
    // corta el loop — una vez procesados los 12 canales, `resolvers` queda
    // vacío para siempre y el `while` gira en un loop infinito de microtasks
    // sin nunca llegar a `await donePromise`, colgando el test.
    let resolvedCount = 0;
    while (resolvedCount < channels.length) {
      const toResolve = resolvers.splice(0, resolvers.length);
      resolvedCount += toResolve.length;
      toResolve.forEach((r) => r());
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }
    resolvers.forEach((r) => r());

    await donePromise;

    expect(maxInFlight).toBeLessThanOrEqual(batchSize);
    expect(maxInFlight).toBeGreaterThan(1); // confirma que SÍ hubo paralelismo real
    channels.forEach((ch) => {
      expect(Array.isArray(ch.epgItems)).toBe(true);
    });
  });

  it('usa DEFAULT_EPG_BATCH_SIZE (5) cuando no se pasa batchSize', async () => {
    let maxInFlight = 0;
    let inFlight = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        return Promise.resolve({ text: () => Promise.resolve('[]') }).finally(() => {
          inFlight -= 1;
        });
      }),
    );

    const channels = makeChannels(9);
    await loadEPGForChannels(channels, baseOpts);

    expect(DEFAULT_EPG_BATCH_SIZE).toBe(5);
    expect(maxInFlight).toBeLessThanOrEqual(DEFAULT_EPG_BATCH_SIZE);
  });

  it('onProgress llega a toProcess con conteos no decrecientes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ text: () => Promise.resolve('[]') })),
    );

    const channels = makeChannels(11);
    const progressCalls = [];
    await loadEPGForChannels(channels, {
      ...baseOpts,
      batchSize: 5,
      onProgress: (current, total) => progressCalls.push([current, total]),
    });

    expect(progressCalls.length).toBe(channels.length);
    expect(progressCalls[progressCalls.length - 1]).toEqual([channels.length, channels.length]);
    for (let i = 1; i < progressCalls.length; i++) {
      expect(progressCalls[i][0]).toBeGreaterThanOrEqual(progressCalls[i - 1][0]);
    }
  });

  it('respeta maxChannels: los canales fuera de rango quedan con epgItems=[] sin pegarle a la red', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ text: () => Promise.resolve('[]') }));
    vi.stubGlobal('fetch', fetchMock);

    const channels = makeChannels(10);
    await loadEPGForChannels(channels, { ...baseOpts, maxChannels: 4 });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    channels.slice(4).forEach((ch) => {
      expect(ch.epgItems).toEqual([]);
    });
  });
});
