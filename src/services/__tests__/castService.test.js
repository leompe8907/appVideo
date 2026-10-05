import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Cliente del protocolo `cast.*` (ver `castService.js`). El socket real
 * (`deviceSessionService`) se simula: acá se prueba solo el armado de
 * mensajes, la correlación pedido/respuesta y el reparto de eventos.
 */

const sendDeviceMessage = vi.fn(() => true);
const setCastRegistrationProvider = vi.fn();
const setOnCastMessage = vi.fn();

vi.mock('../deviceSessionService', () => ({
  DEVICE_TYPE: { WEB: 'web', LG: 'lg', SAMSUNG: 'samsung' },
  resolveDeviceType: vi.fn(() => 'samsung'),
  sendDeviceMessage: (...a) => sendDeviceMessage(...a),
  setCastRegistrationProvider: (...a) => setCastRegistrationProvider(...a),
  setOnCastMessage: (...a) => setOnCastMessage(...a),
}));

import {
  __resetCastForTests,
  buildRegistrationFields,
  CAST_REQUEST_TIMEOUT_MS,
  handleCastMessage,
  initCast,
  isCastEnabled,
  listDevices,
  msToSeconds,
  reportState,
  secondsToMs,
  sendCommand,
  sendContent,
  subscribeCast,
} from '../castService';

const lastSent = () => sendDeviceMessage.mock.calls.at(-1)[0];

beforeEach(() => {
  __resetCastForTests();
  sendDeviceMessage.mockClear();
  sendDeviceMessage.mockImplementation(() => true);
  setCastRegistrationProvider.mockClear();
  setOnCastMessage.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('flag y registro', () => {
  it('está apagado salvo que la marca lo active explícitamente', () => {
    expect(isCastEnabled(undefined)).toBe(false);
    expect(isCastEnabled({ features: {} })).toBe(false);
    expect(isCastEnabled({ features: { castEnabled: 'true' } })).toBe(false);
    expect(isCastEnabled({ features: { castEnabled: true } })).toBe(true);
  });

  it('declara el dispositivo como receptor con sus capacidades', () => {
    const fields = buildRegistrationFields({ name: 'Wind', features: {} });
    expect(fields.device_name).toBe('Wind TV');
    expect(fields.can_receive).toBe(true);
    expect(fields.capabilities.kinds).toEqual(['service', 'vod', 'catchup']);
    expect(fields.capabilities.audio_select).toBe(true);
    expect(fields.capabilities.volume).toBe(false);
  });

  it('el volumen remoto solo se declara si la marca tiene controles de volumen', () => {
    const fields = buildRegistrationFields({ name: 'Wind', features: { playerVolumeControls: true } });
    expect(fields.capabilities.volume).toBe(true);
  });

  it('initCast no conecta nada si la marca no lo activó', () => {
    const stop = initCast({ features: {} });
    expect(setCastRegistrationProvider).not.toHaveBeenCalled();
    expect(setOnCastMessage).not.toHaveBeenCalled();
    expect(typeof stop).toBe('function');
  });

  it('initCast conecta el proveedor y el canal, y la limpieza los suelta', async () => {
    const brand = { name: 'Wind', features: { castEnabled: true } };
    const stop = initCast(brand);
    expect(setCastRegistrationProvider).toHaveBeenCalledTimes(1);
    expect(setCastRegistrationProvider.mock.calls[0][0]().can_receive).toBe(true);
    expect(setOnCastMessage).toHaveBeenCalledWith(handleCastMessage);

    const pendingCall = listDevices();
    stop();
    expect(setCastRegistrationProvider).toHaveBeenLastCalledWith(null);
    expect(setOnCastMessage).toHaveBeenLastCalledWith(null);
    await expect(pendingCall).rejects.toThrow('cast_stopped');
  });
});

describe('pedido / respuesta', () => {
  it('listDevices arma el mensaje v1 con request_id y resuelve con la respuesta', async () => {
    const promise = listDevices();
    const sent = lastSent();
    expect(sent).toMatchObject({ v: 1, type: 'cast.list_devices' });
    expect(typeof sent.request_id).toBe('string');

    handleCastMessage({ type: 'cast.devices', request_id: sent.request_id, devices: [{ id: 3, name: 'TV Sala' }] });
    await expect(promise).resolves.toEqual([{ id: 3, name: 'TV Sala' }]);
  });

  it('ignora una respuesta de otro tipo para ese request_id', async () => {
    vi.useFakeTimers();
    const promise = listDevices();
    const rejection = expect(promise).rejects.toThrow('cast_timeout');
    handleCastMessage({ type: 'cast.sent', request_id: lastSent().request_id });
    await vi.advanceTimersByTimeAsync(CAST_REQUEST_TIMEOUT_MS + 1);
    await rejection;
  });

  it('cast.error rechaza con el código del servidor', async () => {
    const promise = sendContent({ targetDeviceId: 1, content: { kind: 'vod', id: 5 } });
    handleCastMessage({ type: 'cast.error', request_id: lastSent().request_id, code: 'target_offline', detail: 'x' });
    await expect(promise).rejects.toMatchObject({ code: 'target_offline' });
  });

  it('rechaza con cast_timeout si el servidor no responde', async () => {
    vi.useFakeTimers();
    const promise = sendCommand({ sessionId: 's1', command: 'pause' });
    const rejection = expect(promise).rejects.toMatchObject({ code: 'cast_timeout' });
    await vi.advanceTimersByTimeAsync(CAST_REQUEST_TIMEOUT_MS + 1);
    await rejection;
  });

  it('sin socket abierto rechaza de inmediato y no deja pedidos colgados', async () => {
    sendDeviceMessage.mockImplementation(() => false);
    await expect(listDevices()).rejects.toMatchObject({ code: 'cast_not_connected' });
    // Una respuesta tardía con ese id no debe explotar ni resolver nada.
    expect(() => handleCastMessage({ type: 'cast.devices', request_id: lastSent().request_id, devices: [] })).not.toThrow();
  });

  it('sendContent convierte segundos a ms, fuerza modo transfer y nunca manda una URL', async () => {
    const promise = sendContent({
      targetDeviceId: 42,
      content: { kind: 'vod', id: 88, title: 'Peli', startPositionSeconds: 90.4, url: 'http://x?sessionId=SECRETO' },
    });
    const sent = lastSent();
    expect(sent).toMatchObject({
      v: 1,
      type: 'cast.send',
      target_device_id: 42,
      mode: 'transfer',
      content: { kind: 'vod', id: 88, title: 'Peli', start_position_ms: 90400 },
    });
    expect(JSON.stringify(sent)).not.toContain('SECRETO');
    expect(sent.content).not.toHaveProperty('url');
    handleCastMessage({ type: 'cast.sent', request_id: sent.request_id, session_id: 'abc' });
    await expect(promise).resolves.toMatchObject({ session_id: 'abc' });
  });

  it('sendCommand manda comando y args', async () => {
    const promise = sendCommand({ sessionId: 's1', command: 'seek', args: { position_ms: 5000 } });
    const sent = lastSent();
    expect(sent).toMatchObject({ type: 'cast.command', session_id: 's1', command: 'seek', args: { position_ms: 5000 } });
    handleCastMessage({ type: 'cast.ack', request_id: sent.request_id, session_id: 's1' });
    await expect(promise).resolves.toMatchObject({ type: 'cast.ack' });
  });

  it('reportState manda cast.state sin request_id', () => {
    reportState('s1', { state: 'playing', position_ms: 1000 });
    expect(lastSent()).toEqual({ v: 1, type: 'cast.state', session_id: 's1', state: 'playing', position_ms: 1000 });
  });
});

describe('eventos', () => {
  it('reparte los eventos a los suscriptores y permite desuscribirse', () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribeCast(a);
    subscribeCast(b);

    handleCastMessage({ type: 'cast.incoming', session_id: 's', content: { kind: 'service', id: 1 } });
    offA();
    handleCastMessage({ type: 'cast.displaced', session_id: 's' });

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it('un suscriptor que falla no afecta a los demás', () => {
    const bad = vi.fn(() => {
      throw new Error('boom');
    });
    const good = vi.fn();
    subscribeCast(bad);
    subscribeCast(good);
    handleCastMessage({ type: 'cast.command', session_id: 's', command: 'pause' });
    expect(good).toHaveBeenCalled();
  });

  it('ignora mensajes que no son eventos conocidos', () => {
    const fn = vi.fn();
    subscribeCast(fn);
    handleCastMessage({ type: 'cast.algo_raro' });
    handleCastMessage(null);
    handleCastMessage('texto');
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('conversión de tiempos', () => {
  it('segundos <-> ms, sin valores inválidos', () => {
    expect(secondsToMs(1.5)).toBe(1500);
    expect(secondsToMs(-3)).toBe(0);
    expect(secondsToMs(NaN)).toBe(0);
    expect(secondsToMs(undefined)).toBe(0);
    expect(msToSeconds(2500)).toBe(2.5);
    expect(msToSeconds(-1)).toBe(0);
    expect(msToSeconds('x')).toBe(0);
  });
});
