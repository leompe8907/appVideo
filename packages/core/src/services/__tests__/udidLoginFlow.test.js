import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createUdidLoginFlow } from '../udidLoginFlow';

class FakeWebSocket {
  static OPEN = 1;
  static instances = [];
  constructor(url) {
    this.url = url;
    this.sent = [];
    this.readyState = 0;
    this.closed = false;
    FakeWebSocket.instances.push(this);
  }
  send(data) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.closed = true;
  }
  // helpers del test
  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }
  receive(message) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  drop() {
    this.readyState = 3;
    this.onclose?.();
  }
}

const lastSocket = () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1];

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const BASE_CONFIG = {
  enabled: true,
  baseUrl: 'https://api.example.test',
  wsUrl: 'wss://api.example.test/ws/udid/',
  appType: 'tv',
};

function setup({ config = {}, fetchResponse, onCredentials, deps = {} } = {}) {
  const fetchFn = vi.fn(async () => fetchResponse ?? jsonResponse({ udid: 'ab12cd34', expires_in_minutes: 5, temp_token: 'tt-1' }));
  const creds = onCredentials ?? vi.fn(async () => {});
  const flow = createUdidLoginFlow({
    config: { ...BASE_CONFIG, ...config },
    onCredentials: creds,
    t: (key) => key,
    deps: {
      fetch: fetchFn,
      WebSocket: FakeWebSocket,
      now: () => Date.now(),
      getUdid: () => 'DEVICE-FP',
      setBrandItem: vi.fn(),
      ...deps,
    },
  });
  return { flow, fetchFn, onCredentials: creds };
}

describe('createUdidLoginFlow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('pide el código, lo muestra en mayúsculas y abre el WebSocket', async () => {
    const { flow, fetchFn } = setup();

    await flow.start();

    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.example.test/udid/request-udid-manual/',
      expect.objectContaining({ method: 'GET', headers: { 'X-Device-Fingerprint': 'DEVICE-FP' } }),
    );
    expect(flow.getState()).toMatchObject({ status: 'waiting_confirmation', code: 'AB12CD34', remainingSeconds: 300 });
    expect(lastSocket().url).toBe('wss://api.example.test/ws/udid/');
  });

  it('al abrir el WebSocket manda auth_with_udid con el código en minúsculas y sin temp_token si la marca no lo pide', async () => {
    const { flow } = setup();
    await flow.start();

    lastSocket().open();

    expect(lastSocket().sent[0]).toEqual({ type: 'auth_with_udid', udid: 'ab12cd34', app_type: 'tv', app_version: '1.0' });
  });

  it('con credenciales en claro llama a onCredentials, termina en success y cierra el WebSocket', async () => {
    const { flow, onCredentials } = setup();
    await flow.start();
    const ws = lastSocket();
    ws.open();

    ws.receive({ type: 'auth_with_udid:result', status: 'ok', result: { username: ' ana ', password: 'secreta', sn: '123' } });
    await vi.advanceTimersByTimeAsync(0);

    expect(onCredentials).toHaveBeenCalledWith({ username: 'ana', password: 'secreta', licenseKey: '123', pin: '' });
    expect(flow.getState().status).toBe('success');
    expect(ws.closed).toBe(true);
  });

  it('con tempTokenRequired manda la llave pública y el temp_token, y descifra con la llave efímera', async () => {
    const decrypt = vi.fn(async () => ({ username: 'ana', password: 'secreta' }));
    const { flow, fetchFn, onCredentials } = setup({
      config: { tempTokenRequired: true },
      deps: {
        generateEphemeralKeyPair: async () => ({ privateKey: 'PRIVATE', publicKeyPem: 'PEM' }),
        encodePublicKeyForHeader: (pem) => `b64(${pem})`,
        decryptEncryptedCredentials: decrypt,
      },
    });
    await flow.start();
    const ws = lastSocket();
    ws.open();

    expect(fetchFn.mock.calls[0][1].headers['X-Device-Public-Key']).toBe('b64(PEM)');
    expect(ws.sent[0].temp_token).toBe('tt-1');

    const payload = { encrypted_credentials: 'xxx' };
    ws.receive({ type: 'udid.validated', result: payload });
    await vi.advanceTimersByTimeAsync(0);

    expect(decrypt).toHaveBeenCalledWith(payload, { privateKey: 'PRIVATE' });
    expect(onCredentials).toHaveBeenCalledWith(expect.objectContaining({ username: 'ana', password: 'secreta' }));
    expect(flow.getState().status).toBe('success');
  });

  it('credenciales cifradas sin llave efímera ni privateKeyUrl → error de llave faltante', async () => {
    const { flow } = setup();
    await flow.start();
    lastSocket().open();

    lastSocket().receive({ type: 'auth_result', status: 'ok', result: { encrypted_credentials: 'xxx' } });
    await vi.advanceTimersByTimeAsync(0);

    expect(flow.getState()).toMatchObject({ status: 'error', error: 'login.udidErrorDecryptKeyMissing' });
  });

  it('429 con retry_after → rate_limited y no abre el WebSocket', async () => {
    const { flow } = setup({ fetchResponse: jsonResponse({ retry_after: 30 }, 429) });

    await flow.start();

    expect(flow.getState()).toMatchObject({ status: 'rate_limited', error: 'login.udidRateLimit' });
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it('invalid_udid antes de que el usuario valide sigue esperando', async () => {
    const { flow } = setup();
    await flow.start();
    lastSocket().open();

    lastSocket().receive({ type: 'auth_with_udid:result', status: 'error', result: { code: 'invalid_udid' } });

    expect(flow.getState().status).toBe('waiting_confirmation');
  });

  it('un error final del backend corta el flujo', async () => {
    const { flow } = setup();
    await flow.start();
    lastSocket().open();

    lastSocket().receive({ type: 'auth_with_udid:result', status: 'error', result: { code: 'forbidden' } });

    expect(flow.getState()).toMatchObject({ status: 'error', error: 'login.udidErrorAuth' });
    expect(lastSocket().closed).toBe(true);
  });

  it('si el WebSocket se corta, reconecta tras la espera configurada', async () => {
    const { flow } = setup();
    await flow.start();
    lastSocket().open();

    lastSocket().drop();
    expect(flow.getState().status).toBe('reconnecting');
    expect(FakeWebSocket.instances).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(3000);

    expect(FakeWebSocket.instances).toHaveLength(2);
    lastSocket().open();
    expect(flow.getState().status).toBe('waiting_confirmation');
  });

  it('cuando vence el código pasa a expired y cierra el WebSocket', async () => {
    const { flow } = setup();
    await flow.start();
    lastSocket().open();

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(flow.getState()).toMatchObject({ status: 'expired', remainingSeconds: 0 });
    expect(lastSocket().closed).toBe(true);
  });

  it('cancel cierra el WebSocket y los mensajes posteriores no cambian el estado', async () => {
    const { flow, onCredentials } = setup();
    await flow.start();
    const ws = lastSocket();
    ws.open();

    flow.cancel();
    ws.receive({ type: 'auth_with_udid:result', status: 'ok', result: { username: 'a', password: 'b' } });
    await vi.advanceTimersByTimeAsync(0);

    expect(flow.getState().status).toBe('cancelled');
    expect(ws.closed).toBe(true);
    expect(onCredentials).not.toHaveBeenCalled();
  });

  it('si onCredentials falla, termina en error con su mensaje', async () => {
    const { flow } = setup({ onCredentials: vi.fn(async () => { throw new Error('licencia en uso'); }) });
    await flow.start();
    lastSocket().open();

    lastSocket().receive({ type: 'auth_result', status: 'ok', result: { username: 'a', password: 'b' } });
    await vi.advanceTimersByTimeAsync(0);

    expect(flow.getState()).toMatchObject({ status: 'error', error: 'licencia en uso' });
  });

  it('sin la marca habilitada no pide nada y avisa de configuración', async () => {
    const { flow, fetchFn } = setup({ config: { enabled: false } });

    await flow.start();

    expect(fetchFn).not.toHaveBeenCalled();
    expect(flow.getState()).toMatchObject({ status: 'error', error: 'login.udidErrorConfig' });
  });

  it('notifica a los suscriptores y deja de hacerlo tras destroy', async () => {
    const { flow } = setup();
    const seen = [];
    flow.subscribe((s) => seen.push(s.status));

    await flow.start();
    flow.destroy();
    lastSocket().open();

    expect(seen).toEqual(['requesting_code', 'waiting_confirmation', 'waiting_confirmation']);
    expect(lastSocket().closed).toBe(true);
  });
});
