import { describe, it, expect } from 'vitest';
import {
  DEVICE_WS_ERROR,
  MAX_CONSECUTIVE_FAILURES,
  classifyDeviceSocketClose,
  nextDeviceSocketReconnect,
  retryAfterSecondsFromReason,
  serviceUnavailableRetryDelayMs,
} from '../backendRetryPolicy';

/**
 * Mismas reglas que `WindDeviceSocketRulesTest.kt` / `WindServiceUnavailableTest.kt`
 * (PanaccessApp, módulo :shared): una caída de la base del backend (4503 / HTTP
 * 503) no cierra la sesión ni deja de reintentar; 4004 no se reintenta; el
 * límite de conexiones se respeta; y las esperas llevan una parte al azar.
 */
const noJitter = () => 0;
const fullJitter = () => 1;

describe('backendRetryPolicy -- /ws/device/', () => {
  it('traduce los códigos de cierre del backend', () => {
    expect(classifyDeviceSocketClose(4503)).toBe(DEVICE_WS_ERROR.SERVICE_UNAVAILABLE);
    expect(classifyDeviceSocketClose(4004)).toBe(DEVICE_WS_ERROR.NO_SUBSCRIBER);
    expect(classifyDeviceSocketClose(4001)).toBe(DEVICE_WS_ERROR.RATE_LIMITED);
    expect(classifyDeviceSocketClose(1006)).toBeNull();
  });

  it('lee el "Retry after Ns" del motivo del cierre', () => {
    expect(retryAfterSecondsFromReason('Too many connections for this token. Retry after 60s')).toBe(60);
    expect(retryAfterSecondsFromReason('')).toBeNull();
    expect(retryAfterSecondsFromReason(undefined)).toBeNull();
  });

  it('4503 sigue reintentando aunque se pase el límite de fallos', () => {
    const next = nextDeviceSocketReconnect(
      { error: DEVICE_WS_ERROR.SERVICE_UNAVAILABLE, failures: MAX_CONSECUTIVE_FAILURES + 3 },
      noJitter,
    );
    expect(next).toEqual({ reconnect: true, delayMs: 60000 });
  });

  it('4004 no reintenta', () => {
    expect(nextDeviceSocketReconnect({ error: DEVICE_WS_ERROR.NO_SUBSCRIBER, failures: 1 }).reconnect).toBe(false);
  });

  it('el límite de conexiones espera lo que pide el servidor', () => {
    const next = nextDeviceSocketReconnect(
      { error: DEVICE_WS_ERROR.RATE_LIMITED, failures: 1, retryAfterSeconds: 60 },
      noJitter,
    );
    expect(next.delayMs).toBe(60000);
  });

  it('un corte de red usa espera creciente y para tras demasiados fallos', () => {
    expect(nextDeviceSocketReconnect({ error: 'closed_before_ack', failures: 1 }, noJitter).delayMs).toBe(2000);
    expect(nextDeviceSocketReconnect({ error: 'closed_before_ack', failures: 3 }, noJitter).delayMs).toBe(8000);
    expect(nextDeviceSocketReconnect({ error: 'closed_before_ack', failures: MAX_CONSECUTIVE_FAILURES + 1 }).reconnect).toBe(
      false,
    );
  });

  it('la parte al azar agrega hasta un 30 %', () => {
    expect(nextDeviceSocketReconnect({ failures: 1 }, fullJitter).delayMs).toBe(2600);
  });
});

describe('backendRetryPolicy -- HTTP 503', () => {
  it('un GET se reintenta tras el Retry-After', () => {
    expect(serviceUnavailableRetryDelayMs('GET', '5', noJitter)).toBe(5000);
    expect(serviceUnavailableRetryDelayMs(undefined, null, noJitter)).toBe(2000);
  });

  it('un POST nunca se reintenta', () => {
    expect(serviceUnavailableRetryDelayMs('POST', '1', noJitter)).toBeNull();
  });

  it('una espera larga no se reintenta', () => {
    expect(serviceUnavailableRetryDelayMs('GET', '120', noJitter)).toBeNull();
  });
});
