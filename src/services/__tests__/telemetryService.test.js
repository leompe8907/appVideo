import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TelemetryService, TELEMETRY_ACTION } from '../telemetryService.js';

/**
 * Reglas replicadas del `Telemetry.js` legacy (ver comentario de cabecera en
 * telemetryService.js): anti-zapping de 1 min antes de confirmar un "inicio",
 * batching y persistencia en localStorage.
 */

vi.mock('../panaccessService', () => ({
  default: {
    brandConfig: {},
    pushTelemetryRecords: vi.fn(async () => ({})),
  },
}));

import panaccessService from '../panaccessService';

function actionsOf(mockCalls) {
  return mockCalls.flatMap(([records]) => records.map((r) => r.actionId));
}

describe('telemetryService', () => {
  beforeEach(() => {
    localStorage.clear();
    panaccessService.brandConfig = {};
    panaccessService.pushTelemetryRecords.mockReset();
    panaccessService.pushTelemetryRecords.mockResolvedValue({});
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('no reporta nada si el usuario corta antes del umbral anti-zapping (1 min)', async () => {
    const svc = new TelemetryService();
    svc.recordSwitch({ type: 'service', item: { id: 1, name: 'Canal 1' } });

    await vi.advanceTimersByTimeAsync(59_000);
    svc.stopCurrent({ finished: false, timeIndex: 59 });

    await svc._flush({ force: true });
    expect(panaccessService.pushTelemetryRecords).not.toHaveBeenCalled();
  });

  it('reporta inicio (confirmado a los 60s) y fin al cortar después del umbral', async () => {
    const svc = new TelemetryService();
    svc.recordSwitch({ type: 'service', item: { id: 1, name: 'Canal 1' } });

    // El propio confirm timer dispara un _flush() interno al llegar a MIN_TIME_MS.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(actionsOf(panaccessService.pushTelemetryRecords.mock.calls)).toContain(
      TELEMETRY_ACTION.SWITCHED_TO_SERVICE,
    );

    svc.stopCurrent({ finished: false, timeIndex: 300 });
    await svc._flush({ force: true });

    const allActions = actionsOf(panaccessService.pushTelemetryRecords.mock.calls);
    expect(allActions).toContain(TELEMETRY_ACTION.SWITCHED_TO_SERVICE);
    expect(allActions).toContain(TELEMETRY_ACTION.SWITCHED_AWAY_FROM_SERVICE);
  });

  it('distingue VOD_FINISHED de VOD_STOPPED_PREMATURELY según `finished`', async () => {
    const svc = new TelemetryService();
    svc.recordSwitch({ type: 'vod', item: { id: 42, name: 'Película', duration: 5400 } });
    await vi.advanceTimersByTimeAsync(60_000);

    svc.stopCurrent({ finished: true, timeIndex: 5400 });
    await svc._flush({ force: true });

    const allActions = actionsOf(panaccessService.pushTelemetryRecords.mock.calls);
    expect(allActions).toContain(TELEMETRY_ACTION.VOD_STARTED);
    expect(allActions).toContain(TELEMETRY_ACTION.VOD_FINISHED);
    expect(allActions).not.toContain(TELEMETRY_ACTION.VOD_STOPPED_PREMATURELY);
  });

  it('cambiar de contenido antes del umbral resuelve (descarta) lo anterior sin reportar nada', async () => {
    const svc = new TelemetryService();
    svc.recordSwitch({ type: 'service', item: { id: 1, name: 'Canal 1' } });
    await vi.advanceTimersByTimeAsync(10_000);

    // Zapping: cambia de canal antes de confirmar el primero.
    svc.recordSwitch({ type: 'service', item: { id: 2, name: 'Canal 2' } });
    await vi.advanceTimersByTimeAsync(59_000); // total 69s sobre el switch, pero solo ~59s sobre canal 2

    await svc._flush({ force: true });
    expect(panaccessService.pushTelemetryRecords).not.toHaveBeenCalled();

    // Recién ahora canal 2 llega a su propio minuto.
    await vi.advanceTimersByTimeAsync(1_000);
    const allActions = actionsOf(panaccessService.pushTelemetryRecords.mock.calls);
    expect(allActions).toEqual([TELEMETRY_ACTION.SWITCHED_TO_SERVICE]);
  });

  it('no encola nada si el item no trae un id identificable', async () => {
    const svc = new TelemetryService();
    svc.recordSwitch({ type: 'vod', item: {} });
    await vi.advanceTimersByTimeAsync(60_000);
    await svc._flush({ force: true });
    expect(panaccessService.pushTelemetryRecords).not.toHaveBeenCalled();
  });

  it('respeta telemetryEnabled=false por marca: no encola ni envía', async () => {
    panaccessService.brandConfig = { player: { telemetryEnabled: false } };
    const svc = new TelemetryService();
    svc.recordSwitch({ type: 'service', item: { id: 1, name: 'Canal 1' } });
    await vi.advanceTimersByTimeAsync(60_000);
    svc.stopCurrent({ finished: false, timeIndex: 60 });
    await svc._flush({ force: true });
    expect(panaccessService.pushTelemetryRecords).not.toHaveBeenCalled();
  });

  it('persiste en localStorage lo que no se pudo enviar (offline) y lo restaura en una instancia nueva', async () => {
    panaccessService.pushTelemetryRecords.mockRejectedValue(new Error('offline'));
    const svc = new TelemetryService();
    svc.recordSwitch({ type: 'service', item: { id: 1, name: 'Canal 1' } });
    await vi.advanceTimersByTimeAsync(60_000); // confirma -> intenta enviar -> falla (offline)
    // Debounce de guardado (500ms) del propio servicio.
    await vi.advanceTimersByTimeAsync(600);

    const svc2 = new TelemetryService();
    expect(svc2.debugStatus().queueLength).toBeGreaterThan(0);
  });

  it('reintenta tras un error de red respetando RETRY_AFTER_ERROR_MS', async () => {
    panaccessService.pushTelemetryRecords.mockRejectedValueOnce(new Error('network'));
    const svc = new TelemetryService();
    svc.recordSwitch({ type: 'service', item: { id: 1, name: 'Canal 1' } });
    await vi.advanceTimersByTimeAsync(60_000); // confirma -> intenta enviar -> falla

    expect(panaccessService.pushTelemetryRecords).toHaveBeenCalledTimes(1);
    expect(svc.debugStatus().queueLength).toBe(1); // no se vació: el envío falló

    panaccessService.pushTelemetryRecords.mockResolvedValue({});
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000); // RETRY_AFTER_ERROR_MS

    expect(panaccessService.pushTelemetryRecords).toHaveBeenCalledTimes(2);
    expect(svc.debugStatus().queueLength).toBe(0);
  });
});
