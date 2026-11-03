import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Códigos de cierre de `/ws/device/`: antes `onclose` ignoraba el código y una
 * caída de la base del backend (4503) se trataba como un JWT vencido
 * (refrescar y reintentar al instante). Ahora el motivo llega al llamador para
 * que decida cuánto esperar (ver backendRetryPolicy.js).
 */

vi.mock('../deviceAuthService', () => ({
  resolveDeviceAuthBaseUrl: () => 'https://backend.example',
  refreshDeviceSessionAccessToken: vi.fn(async () => 'access-new'),
}));

import { refreshDeviceSessionAccessToken } from '../deviceAuthService';
import { registerDeviceSession, setOnDeviceSessionUnexpectedClose } from '../deviceSessionService';

const BRAND_CONFIG = { brand: 'wind', login: { deviceSession: { enabled: true } } };

/** WebSocket falso: el test decide cuándo abre, qué llega y cómo cierra. */
class FakeWebSocket {
  static OPEN = 1;
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    FakeWebSocket.instances.push(this);
  }

  send(data) {
    this.sent.push(JSON.parse(data));
  }

  close() {
    this.readyState = 3;
  }

  serverOpen() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  serverMessage(message) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  serverClose(code, reason = '') {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('registerDeviceSession -- códigos de cierre', () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeWebSocket);
    refreshDeviceSessionAccessToken.mockClear();
  });

  afterEach(() => {
    setOnDeviceSessionUnexpectedClose(null);
    vi.unstubAllGlobals();
  });

  it('4503 se informa como service_unavailable, sin refrescar el token', async () => {
    const pending = registerDeviceSession(BRAND_CONFIG, 'access');
    const ws = FakeWebSocket.instances[0];
    ws.serverOpen();
    ws.serverClose(4503);

    await expect(pending).resolves.toMatchObject({ ok: false, error: 'service_unavailable', closeCode: 4503 });
    expect(refreshDeviceSessionAccessToken).not.toHaveBeenCalled();
  });

  it('4001 con "Retry after Ns" se informa como rate_limited con los segundos', async () => {
    const pending = registerDeviceSession(BRAND_CONFIG, 'access');
    const ws = FakeWebSocket.instances[0];
    ws.serverOpen();
    ws.serverClose(4001, 'Too many connections for this token. Retry after 60s');

    await expect(pending).resolves.toMatchObject({ ok: false, error: 'rate_limited', retryAfterSeconds: 60 });
  });

  it('un rechazo antes de abrir (JWT vencido) refresca el token y reintenta una vez', async () => {
    const pending = registerDeviceSession(BRAND_CONFIG, 'access');
    FakeWebSocket.instances[0].serverClose(1006);
    await tick();

    const retry = FakeWebSocket.instances[1];
    expect(retry.url).toContain('token=access-new');
    retry.serverOpen();
    retry.serverMessage({ type: 'device_registered', device_token: 'dt', id: 7 });

    await expect(pending).resolves.toMatchObject({ ok: true, deviceId: 7 });
  });

  it('si una conexión registrada se cae con 4503, avisa al watchdog con el motivo', async () => {
    const onClose = vi.fn();
    setOnDeviceSessionUnexpectedClose(onClose);

    const pending = registerDeviceSession(BRAND_CONFIG, 'access');
    const ws = FakeWebSocket.instances[0];
    ws.serverOpen();
    ws.serverMessage({ type: 'device_registered', device_token: 'dt', id: 7 });
    await pending;

    ws.serverClose(4503);
    expect(onClose).toHaveBeenCalledWith(expect.objectContaining({ error: 'service_unavailable', closeCode: 4503 }));
  });
});
