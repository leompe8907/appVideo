import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  TelemetryService,
  TELEMETRY_ACTION,
  MIN_TIME_STREAM_MS,
  MIN_TIME_VOD_OR_CATCHUP_MS,
  RETRY_AFTER_ERROR_MS,
} from '../telemetryService.js';

/**
 * Reglas replicadas de `TelemetryRecords.java` (SDK Android de Panaccess,
 * referencia autoritativa): anti-zapping antes de confirmar un "inicio",
 * shape exacto de `data` por tipo/fase (inicio vs fin), batching y
 * persistencia en localStorage.
 *
 * Los tests usan las constantes exportadas (`MIN_TIME_STREAM_MS`, etc.) en
 * vez de literales — esos valores están reducidos temporalmente para
 * testeo en frío (ver comentarios en telemetryService.js), así que estos
 * tests siguen siendo válidos aunque cambien.
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

function dataOf(record) {
  return JSON.parse(record.data);
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

  it('no reporta nada si el usuario corta un canal antes del umbral anti-zapping', async () => {
    const svc = new TelemetryService();
    svc.recordSwitch({ type: 'service', item: { id: 1, name: 'Canal 1' } });

    await vi.advanceTimersByTimeAsync(MIN_TIME_STREAM_MS - 1_000);
    svc.stopCurrent({ finished: false });

    await svc._flush({ force: true });
    expect(panaccessService.pushTelemetryRecords).not.toHaveBeenCalled();
  });

  it('canal: confirma al llegar al umbral con streamId/streamName, y el fin agrega duration real', async () => {
    const svc = new TelemetryService();
    svc.recordSwitch({ type: 'service', item: { id: 274, name: 'Tooncast' } });

    await vi.advanceTimersByTimeAsync(MIN_TIME_STREAM_MS);
    let calls = panaccessService.pushTelemetryRecords.mock.calls;
    expect(actionsOf(calls)).toContain(TELEMETRY_ACTION.SWITCHED_TO_STREAM);
    const startRecord = calls[0][0][0];
    expect(dataOf(startRecord)).toEqual({
      streamId: 274,
      streamName: 'Tooncast',
      serviceId: 274,
      serviceName: 'Tooncast',
    });

    const extraWatchMs = 20_000;
    await vi.advanceTimersByTimeAsync(extraWatchMs);
    svc.stopCurrent({ finished: false });
    await svc._flush({ force: true });

    calls = panaccessService.pushTelemetryRecords.mock.calls;
    const allActions = actionsOf(calls);
    expect(allActions).toContain(TELEMETRY_ACTION.SWITCHED_AWAY_FROM_STREAM);
    const stopRecord = calls.flatMap((c) => c[0]).find((r) => r.actionId === TELEMETRY_ACTION.SWITCHED_AWAY_FROM_STREAM);
    const stopData = dataOf(stopRecord);
    expect(stopData.streamId).toBe(274);
    expect(stopData.streamName).toBe('Tooncast');
    expect(stopData.serviceId).toBe(274);
    expect(stopData.serviceName).toBe('Tooncast');
    const expectedSeconds = (MIN_TIME_STREAM_MS + extraWatchMs) / 1000;
    expect(stopData.duration).toBeGreaterThanOrEqual(expectedSeconds - 1);
    expect(stopData.duration).toBeLessThanOrEqual(expectedSeconds + 1);
  });

  it('VOD: confirma al llegar al umbral, sin `duration` inventado — solo timeIndex', async () => {
    const svc = new TelemetryService();
    svc.recordSwitch({ type: 'vod', item: { id: 42, name: 'Película' } });
    await vi.advanceTimersByTimeAsync(MIN_TIME_VOD_OR_CATCHUP_MS);

    let calls = panaccessService.pushTelemetryRecords.mock.calls;
    const startRecord = calls[0][0][0];
    expect(startRecord.actionId).toBe(TELEMETRY_ACTION.VOD_STARTED);
    expect(dataOf(startRecord)).toEqual({
      vodId: 42,
      vodName: 'Película',
      timeIndex: 0,
      serviceId: 42,
      serviceName: 'Película',
    });

    svc.stopCurrent({ finished: true, timeIndex: 5400 });
    await svc._flush({ force: true });

    calls = panaccessService.pushTelemetryRecords.mock.calls;
    const stopRecord = calls.flatMap((c) => c[0]).find((r) => r.actionId === TELEMETRY_ACTION.VOD_FINISHED);
    expect(dataOf(stopRecord)).toEqual({
      vodId: 42,
      vodName: 'Película',
      timeIndex: 5400,
      serviceId: 42,
      serviceName: 'Película',
    });
  });

  it('distingue VOD_FINISHED de VOD_STOPPED_PREMATURELY según `finished`', async () => {
    const svc = new TelemetryService();
    svc.recordSwitch({ type: 'vod', item: { id: 42, name: 'Película' } });
    await vi.advanceTimersByTimeAsync(MIN_TIME_VOD_OR_CATCHUP_MS);

    svc.stopCurrent({ finished: true, timeIndex: 5400 });
    await svc._flush({ force: true });

    const allActions = actionsOf(panaccessService.pushTelemetryRecords.mock.calls);
    expect(allActions).toContain(TELEMETRY_ACTION.VOD_STARTED);
    expect(allActions).toContain(TELEMETRY_ACTION.VOD_FINISHED);
    expect(allActions).not.toContain(TELEMETRY_ACTION.VOD_STOPPED_PREMATURELY);
  });

  it('catchup: el inicio lleva catchupGroupId/catchupGroupName, el fin NO (asimetría real de Android)', async () => {
    const svc = new TelemetryService();
    svc.recordSwitch({
      type: 'catchup',
      item: { id: 900, catchupGroupId: 10, catchupGroupName: 'Cine', name: 'Película catchup' },
    });
    await vi.advanceTimersByTimeAsync(MIN_TIME_VOD_OR_CATCHUP_MS);

    let calls = panaccessService.pushTelemetryRecords.mock.calls;
    const startRecord = calls[0][0][0];
    expect(startRecord.actionId).toBe(TELEMETRY_ACTION.CATCHUP_STARTED);
    expect(dataOf(startRecord)).toEqual({
      catchupGroupId: 10,
      catchupGroupName: 'Cine',
      catchupId: 900,
      catchupName: 'Película catchup',
      serviceId: 900,
      serviceName: 'Película catchup',
    });

    svc.stopCurrent({ finished: false, timeIndex: 300 });
    await svc._flush({ force: true });

    calls = panaccessService.pushTelemetryRecords.mock.calls;
    const stopRecord = calls
      .flatMap((c) => c[0])
      .find((r) => r.actionId === TELEMETRY_ACTION.CATCHUP_STOPPED_PREMATURELY);
    // Sin catchupGroupId/catchupGroupName ni duration — solo catchupId/catchupName/timeIndex + serviceId/serviceName.
    expect(dataOf(stopRecord)).toEqual({
      catchupId: 900,
      catchupName: 'Película catchup',
      timeIndex: 300,
      serviceId: 900,
      serviceName: 'Película catchup',
    });
  });

  it('cambiar de canal antes del umbral resuelve (descarta) lo anterior sin reportar nada', async () => {
    const svc = new TelemetryService();
    const partialWait = Math.max(1_000, Math.floor(MIN_TIME_STREAM_MS / 3));
    svc.recordSwitch({ type: 'service', item: { id: 1, name: 'Canal 1' } });
    await vi.advanceTimersByTimeAsync(partialWait); // todavía lejos del umbral

    // Zapping: cambia de canal antes de confirmar el primero.
    svc.recordSwitch({ type: 'service', item: { id: 2, name: 'Canal 2' } });
    await vi.advanceTimersByTimeAsync(MIN_TIME_STREAM_MS - 1_000); // casi al umbral, sobre canal 2

    await svc._flush({ force: true });
    expect(panaccessService.pushTelemetryRecords).not.toHaveBeenCalled();

    // Recién ahora canal 2 llega a su propio umbral.
    await vi.advanceTimersByTimeAsync(1_000);
    const allActions = actionsOf(panaccessService.pushTelemetryRecords.mock.calls);
    expect(allActions).toEqual([TELEMETRY_ACTION.SWITCHED_TO_STREAM]);
  });

  it('no encola nada si el item no trae un id identificable', async () => {
    const svc = new TelemetryService();
    svc.recordSwitch({ type: 'vod', item: {} });
    await vi.advanceTimersByTimeAsync(MIN_TIME_VOD_OR_CATCHUP_MS);
    await svc._flush({ force: true });
    expect(panaccessService.pushTelemetryRecords).not.toHaveBeenCalled();
  });

  it('respeta telemetryEnabled=false por marca: no encola ni envía', async () => {
    panaccessService.brandConfig = { player: { telemetryEnabled: false } };
    const svc = new TelemetryService();
    svc.recordSwitch({ type: 'service', item: { id: 1, name: 'Canal 1' } });
    await vi.advanceTimersByTimeAsync(MIN_TIME_STREAM_MS);
    svc.stopCurrent({ finished: false });
    await svc._flush({ force: true });
    expect(panaccessService.pushTelemetryRecords).not.toHaveBeenCalled();
  });

  it('persiste en localStorage lo que no se pudo enviar (offline) y lo restaura en una instancia nueva', async () => {
    panaccessService.pushTelemetryRecords.mockRejectedValue(new Error('offline'));
    const svc = new TelemetryService();
    svc.recordSwitch({ type: 'vod', item: { id: 42, name: 'Película' } });
    await vi.advanceTimersByTimeAsync(MIN_TIME_VOD_OR_CATCHUP_MS); // confirma -> intenta enviar -> falla (offline)
    // Debounce de guardado (500ms) del propio servicio.
    await vi.advanceTimersByTimeAsync(600);

    const svc2 = new TelemetryService();
    expect(svc2.debugStatus().queueLength).toBeGreaterThan(0);
  });

  it('reintenta tras un error de red respetando RETRY_AFTER_ERROR_MS', async () => {
    panaccessService.pushTelemetryRecords.mockRejectedValueOnce(new Error('network'));
    const svc = new TelemetryService();
    svc.recordSwitch({ type: 'vod', item: { id: 42, name: 'Película' } });
    await vi.advanceTimersByTimeAsync(MIN_TIME_VOD_OR_CATCHUP_MS); // confirma -> intenta enviar -> falla

    expect(panaccessService.pushTelemetryRecords).toHaveBeenCalledTimes(1);
    expect(svc.debugStatus().queueLength).toBe(1); // no se vació: el envío falló

    panaccessService.pushTelemetryRecords.mockResolvedValue({});
    await vi.advanceTimersByTimeAsync(RETRY_AFTER_ERROR_MS);

    expect(panaccessService.pushTelemetryRecords).toHaveBeenCalledTimes(2);
    expect(svc.debugStatus().queueLength).toBe(0);
  });
});
