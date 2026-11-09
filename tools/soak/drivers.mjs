/**
 * Drivers de teclas para la prueba de resistencia. Todos exponen
 * `{ press(key), launch?(), close() }` con nombres de tecla comunes:
 * UP DOWN LEFT RIGHT ENTER BACK CH_UP CH_DOWN PLAY_PAUSE.
 *
 * - cdp:     protocolo de DevTools (Input.dispatchKeyEvent) contra el
 *            inspector remoto (webOS `ares-inspect`, Tizen `sdb ... debug`).
 *            Inyecta en la página: no pasa por el sistema del TV.
 * - samsung: canal de control remoto en red (puertos 8001/8002). Pasa por el
 *            mismo camino que el control físico (incluye registerKey).
 *            La primera vez el TV muestra "¿Permitir?" y hay que aceptar.
 * - lg:      SSAP (puerto 3000/3001) + socket de puntero para botones.
 *            La primera vez el TV pide aceptar el emparejamiento.
 *
 * Requiere Node ≥ 22 (WebSocket global).
 */
import fs from 'node:fs';
import path from 'node:path';

const VK = {
  UP: 38, DOWN: 40, LEFT: 37, RIGHT: 39, ENTER: 13,
  BACK: { tizen: 10009, webos: 461 }, CH_UP: 427, CH_DOWN: 428, PLAY_PAUSE: 10252,
};
const SAMSUNG = {
  UP: 'KEY_UP', DOWN: 'KEY_DOWN', LEFT: 'KEY_LEFT', RIGHT: 'KEY_RIGHT', ENTER: 'KEY_ENTER',
  BACK: 'KEY_RETURN', CH_UP: 'KEY_CHUP', CH_DOWN: 'KEY_CHDOWN', PLAY_PAUSE: 'KEY_PLAY_BACK',
};
const LG = {
  UP: 'UP', DOWN: 'DOWN', LEFT: 'LEFT', RIGHT: 'RIGHT', ENTER: 'ENTER',
  BACK: 'BACK', CH_UP: 'CHANNELUP', CH_DOWN: 'CHANNELDOWN', PLAY_PAUSE: 'PLAY',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function openWs(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const t = setTimeout(() => reject(new Error(`timeout abriendo ${url}`)), timeoutMs);
    ws.onopen = () => { clearTimeout(t); resolve(ws); };
    ws.onerror = (e) => { clearTimeout(t); reject(new Error(e.message || 'error de WebSocket')); };
  });
}

function waitMessage(ws, match, timeoutMs) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout esperando respuesta (¿se aceptó el aviso en el TV?)')), timeoutMs);
    const prev = ws.onmessage;
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (match(d)) { clearTimeout(t); ws.onmessage = prev; resolve(d); }
    };
  });
}

/** CDP: host:port del inspector remoto. platform = 'tizen' | 'webos'. */
export async function cdpDriver({ host, port, platform }) {
  const targets = await (await fetch(`http://${host}:${port}/json`)).json();
  // Saltea páginas internas (chrome://, devtools://) que también son 'page'.
  const page = targets.find((t) => t.type === 'page' && /^(https?|file|app):/.test(t.url)) || targets[0];
  const ws = await openWs(page.webSocketDebuggerUrl);
  let id = 0;
  // En el TV, Page.captureScreenshot tarda bastante más que 5 s.
  const send = (method, params, timeoutMs = 5000) => {
    const msgId = ++id;
    ws.send(JSON.stringify({ id: msgId, method, params }));
    return waitMessage(ws, (d) => d.id === msgId, timeoutMs);
  };
  return {
    async press(key) {
      const code = typeof VK[key] === 'object' ? VK[key][platform] : VK[key];
      const base = { windowsVirtualKeyCode: code, nativeVirtualKeyCode: code };
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
    },
    async evaluate(expression) {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true });
      return r.result && r.result.result ? r.result.result.value : undefined;
    },
    send,
    close: () => ws.close(),
  };
}

const KEY_NAMES = {
  UP: 'ArrowUp', DOWN: 'ArrowDown', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight', ENTER: 'Enter',
  BACK: { tizen: 'XF86Back', webos: 'GoBack' }, CH_UP: 'ChannelUp', CH_DOWN: 'ChannelDown', PLAY_PAUSE: 'MediaPlayPause',
};

/** Página: encola teclas en el recolector para page-driver.js (sin modo debug). */
export async function pageDriver({ collector, label, platform }) {
  return {
    async press(key) {
      const code = typeof VK[key] === 'object' ? VK[key][platform] : VK[key];
      const name = typeof KEY_NAMES[key] === 'object' ? KEY_NAMES[key][platform] : KEY_NAMES[key];
      await fetch(`${collector}/cmd?label=${encodeURIComponent(label)}`, {
        method: 'POST',
        body: JSON.stringify([{ code, key: name }]),
      });
    },
    close() {},
  };
}

/** Samsung: guarda el token en tools/soak/out/samsung-<ip>.token. appId opcional para relanzar. */
export async function samsungDriver({ host, appId, tokenDir }) {
  const name = Buffer.from('appVideo-soak').toString('base64');
  const tokenFile = path.join(tokenDir, `samsung-${host}.token`);
  const token = fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, 'utf8').trim() : '';
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // 8002 usa certificado propio del TV
  const ws = await openWs(`wss://${host}:8002/api/v2/channels/samsung.remote.control?name=${name}${token ? `&token=${token}` : ''}`);
  const hello = await waitMessage(ws, (d) => /^ms\.channel\.(connect|unauthorized|timeOut)$/.test(d.event), 60000);
  if (hello.event !== 'ms.channel.connect') throw new Error(`Samsung rechazó la conexión: ${hello.event}`);
  if (hello.data && hello.data.token) {
    fs.mkdirSync(tokenDir, { recursive: true });
    fs.writeFileSync(tokenFile, hello.data.token);
  }
  return {
    async press(key) {
      ws.send(JSON.stringify({
        method: 'ms.remote.control',
        params: { Cmd: 'Click', DataOfCmd: SAMSUNG[key], Option: 'false', TypeOfRemote: 'SendRemoteKey' },
      }));
    },
    async launch() {
      if (!appId) throw new Error('falta appId para relanzar');
      await fetch(`http://${host}:8001/api/v2/applications/${appId}`, { method: 'POST' });
    },
    close: () => ws.close(),
  };
}

/** LG webOS: guarda la client-key en tools/soak/out/lg-<ip>.key. */
export async function lgDriver({ host, appId, tokenDir }) {
  const keyFile = path.join(tokenDir, `lg-${host}.key`);
  const clientKey = fs.existsSync(keyFile) ? fs.readFileSync(keyFile, 'utf8').trim() : undefined;
  const ws = await openWs(`ws://${host}:3000`);
  let n = 0;
  const request = (uri, payload) => {
    const id = `r${++n}`;
    ws.send(JSON.stringify({ id, type: 'request', uri, payload }));
    return waitMessage(ws, (d) => d.id === id, 10000);
  };
  const manifest = {
    manifestVersion: 1,
    appId: 'com.appvideo.soak',
    vendorId: 'com.appvideo',
    localizedAppNames: { '': 'appVideo soak' },
    permissions: ['CONTROL_INPUT_JOYSTICK', 'LAUNCH', 'READ_INSTALLED_APPS'],
  };
  ws.send(JSON.stringify({ id: 'reg', type: 'register', payload: { forcePairing: false, pairingType: 'PROMPT', 'client-key': clientKey, manifest } }));
  const reg = await waitMessage(ws, (d) => d.id === 'reg' && d.type === 'registered', 60000);
  fs.mkdirSync(tokenDir, { recursive: true });
  fs.writeFileSync(keyFile, reg.payload['client-key']);
  const sock = await request('ssap://com.webos.service.networkinput/getPointerInputSocket');
  const input = await openWs(sock.payload.socketPath);
  return {
    async press(key) {
      input.send(`type:button\nname:${LG[key]}\n\n`);
    },
    async launch() {
      if (!appId) throw new Error('falta appId para relanzar');
      await request('ssap://system.launcher/launch', { id: appId });
    },
    close: () => { input.close(); ws.close(); },
  };
}

export { sleep };
