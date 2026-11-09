/**
 * Login con código (UDID), sin React: pide el código por HTTP, espera la
 * aprobación desde el teléfono por WebSocket (con reconexión y heartbeat),
 * descifra las credenciales y se las pasa a `onCredentials`.
 *
 * Lo usan el hook de la web (`src/hooks/useUdidLoginFlow.js`) y Vega.
 * Las dependencias de red, reloj y cifrado se pueden reemplazar (`deps`):
 * para tests, o en Vega si su WebCrypto no soporta RSA-OAEP.
 */
import { getUdid } from '../cv/udid';
import {
  decryptEncryptedCredentials,
  generateEphemeralKeyPair,
  encodePublicKeyForHeader,
} from './udidCrypto';
import { setBrandItem } from '../utils/brandStorage';

const DEFAULT_RECONNECT_MS = [3000, 6000, 10000];

export const UDID_ACTIVE_STATUSES = Object.freeze([
  'requesting_code',
  'waiting_confirmation',
  'reconnecting',
  'logging_in',
]);

const INITIAL_STATE = Object.freeze({
  status: 'idle',
  error: '',
  code: '',
  tempToken: '',
  expiresAt: null,
  remainingSeconds: 0,
});

function toValidNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildApiUrl(baseUrl, path) {
  const base = String(baseUrl || '').trim().replace(/\/$/, '');
  const suffix = String(path || '').trim();
  if (!base || !suffix) return '';
  return suffix.startsWith('/') ? `${base}${suffix}` : `${base}/${suffix}`;
}

/** Credenciales en claro (directas o en `credentials`), o null. */
export function extractUdidCredentials(result) {
  if (!result || typeof result !== 'object') return null;
  const directUser = result.login1 ?? result.username ?? result.user;
  const directPass = result.password ?? result.pwd;
  if (directUser && directPass) {
    return {
      username: String(directUser).trim(),
      password: String(directPass),
      licenseKey: result.sn ? String(result.sn) : '',
      pin: result.pin ? String(result.pin) : '',
    };
  }
  const nested = result.credentials;
  if (nested && typeof nested === 'object' && nested.username && nested.password) {
    return {
      username: String(nested.username).trim(),
      password: String(nested.password),
      licenseKey: nested.sn ? String(nested.sn) : '',
      pin: nested.pin ? String(nested.pin) : '',
    };
  }
  return null;
}

const noop = () => {};

/**
 * @param {object} options
 * @param {object} options.config `login.udid` de la marca
 * @param {(creds: object) => Promise<void>} options.onCredentials
 * @param {(key: string, params?: object) => string} options.t
 * @param {{log?: Function, warn?: Function}} [options.logger] sin datos sensibles
 * @param {object} [options.deps]
 */
export function createUdidLoginFlow(options) {
  let opts = { ...options };
  const deps = {
    fetch: (...args) => fetch(...args),
    WebSocket: typeof WebSocket !== 'undefined' ? WebSocket : undefined,
    now: () => Date.now(),
    getUdid,
    setBrandItem,
    generateEphemeralKeyPair,
    encodePublicKeyForHeader,
    decryptEncryptedCredentials,
    ...(options?.deps || {}),
  };
  const log = opts.logger?.log || noop;
  const warn = opts.logger?.warn || noop;
  const t = (...args) => (opts.t ? opts.t(...args) : args[0]);

  let state = { ...INITIAL_STATE };
  const listeners = new Set();

  let ws = null;
  let reconnectTimer = null;
  let heartbeatTimer = null;
  let countdownTimer = null;
  let abortController = null;
  let attempts = 0;
  let done = false;
  // temp_token: secreto real del pareo; viaja junto al udid en el QR y por el WS.
  let tempToken = '';
  // Llave RSA efímera de este pareo: sólo en memoria, nunca se exporta ni se guarda.
  let ephemeralPrivateKey = null;

  function setState(patch) {
    state = { ...state, ...patch };
    for (const listener of listeners) listener(state);
  }

  function stopCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  function cleanup() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    stopCountdown();
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    // cleanup() nunca corre a mitad de una reconexión del mismo pareo, sólo al
    // empezar uno nuevo o al terminar: es seguro descartar la llave y el token.
    ephemeralPrivateKey = null;
    tempToken = '';
    if (ws) {
      try {
        ws.close();
      } catch {
        // noop
      }
      ws = null;
    }
  }

  function handleError(message) {
    warn('handleError()', { message });
    done = true;
    cleanup();
    setState({ status: 'error', error: message || t('login.udidErrorGeneric') });
  }

  function isExpired() {
    return !!state.expiresAt && deps.now() >= state.expiresAt;
  }

  function startCountdown() {
    stopCountdown();
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((state.expiresAt - deps.now()) / 1000));
      setState({ remainingSeconds: remaining });
      if (remaining <= 0) {
        done = true;
        cleanup();
        setState({ status: 'expired' });
      }
    };
    tick();
    if (!done) countdownTimer = setInterval(tick, 1000);
  }

  async function processAuthResultPayload(payload) {
    const credentials = extractUdidCredentials(payload);
    if (credentials) {
      cleanup();
      setState({ status: 'logging_in' });
      try {
        await opts.onCredentials(credentials);
        setState({ status: 'success' });
      } catch (e) {
        setState({ status: 'error', error: e?.message || t('login.errorGeneric') });
      }
      return;
    }

    const encryptedCredentials = payload?.encrypted_credentials || payload?.encryptedCredentials;
    if (!encryptedCredentials) {
      handleError(t('login.udidErrorEncrypted'));
      return;
    }
    // Sin llave efímera se usa el esquema viejo de llave estática (privateKeyUrl).
    const privateKeyUrl = opts.config?.privateKeyUrl;
    if (!ephemeralPrivateKey && !privateKeyUrl) {
      handleError(t('login.udidErrorDecryptKeyMissing'));
      return;
    }

    try {
      const decryptedData = await deps.decryptEncryptedCredentials(
        payload,
        ephemeralPrivateKey ? { privateKey: ephemeralPrivateKey } : privateKeyUrl,
      );
      const decryptedCredentials = extractUdidCredentials(decryptedData);
      if (!decryptedCredentials) {
        handleError(t('login.udidErrorDecrypt'));
        return;
      }
      cleanup();
      setState({ status: 'logging_in' });
      await opts.onCredentials(decryptedCredentials);
      setState({ status: 'success' });
    } catch (e) {
      setState({ status: 'error', error: e?.message || t('login.udidErrorDecrypt') });
    }
  }

  async function handleMessage(event) {
    if (done) return;
    let message = null;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    const messageType = String(message?.type ?? message?.event ?? '').toLowerCase();
    const messageStatus = String(message?.status ?? '').toLowerCase();
    log('WS: onmessage', { type: messageType, status: messageStatus });

    if (messageType === 'ping') {
      try {
        ws?.send(JSON.stringify({ type: 'pong' }));
      } catch {
        // noop
      }
      return;
    }
    if (messageType === 'pong') return;

    // Algunos backends marcan "pending" con un status que ya indica avance.
    if (messageType === 'pending') {
      const advanced = messageStatus === 'validated' || messageStatus === 'authorized' || messageStatus === 'used';
      setState({ status: advanced ? 'logging_in' : 'waiting_confirmation' });
      return;
    }

    if (messageType === 'timeout') {
      handleError(t('login.udidExpired'));
      return;
    }

    const isAuthResultType =
      messageType === 'auth_with_udid:result' ||
      messageType === 'auth_with_udid_result' ||
      messageType === 'auth_result';
    const hasAuthResultByShape = messageStatus && (message?.result != null || message?.data != null);
    const isValidatedEvent =
      messageType === 'udid.validated' ||
      messageType === 'udid_validated' ||
      messageStatus === 'validated' ||
      messageStatus === 'authorized' ||
      messageStatus === 'used';

    if (isValidatedEvent) {
      const validatedPayload =
        message?.result ?? message?.data?.result ?? message?.data ?? message?.payload ?? null;
      if (validatedPayload) {
        const hasEncryptedCreds =
          !!validatedPayload?.encrypted_credentials || !!validatedPayload?.encryptedCredentials;
        // Algunos backends sólo confirman la validación, sin credenciales.
        if (hasEncryptedCreds || extractUdidCredentials(validatedPayload)) {
          setState({ status: 'logging_in' });
          done = true;
          await processAuthResultPayload(validatedPayload);
        } else {
          setState({ status: 'waiting_confirmation' });
        }
      }
      return;
    }

    if (isAuthResultType || hasAuthResultByShape) {
      const resultPayload = message?.result ?? message?.data ?? null;
      const errorCode = String(message?.result?.code ?? message?.code ?? '').toLowerCase();
      if (messageStatus === 'pending' || messageStatus === 'not_validated' || messageStatus === 'waiting') {
        setState({ status: 'waiting_confirmation' });
        return;
      }
      if (messageStatus !== 'ok' || !resultPayload) {
        // "invalid_udid" puede llegar antes de que el usuario valide en el móvil: seguir esperando.
        if (errorCode === 'invalid_udid') {
          setState({ status: 'waiting_confirmation' });
          return;
        }
        handleError(t('login.udidErrorAuth'));
        return;
      }
      done = true;
      await processAuthResultPayload(resultPayload);
    }
  }

  function connectWs(udidCode) {
    const config = opts.config;
    const wsUrl = String(config?.wsUrl || '').trim();
    if (!wsUrl || !deps.WebSocket) {
      warn('WS: missing wsUrl');
      handleError(t('login.udidErrorConfig'));
      return;
    }

    const maxReconnectAttempts = toValidNumber(config?.maxReconnectAttempts, 3);
    const reconnectDelays =
      Array.isArray(config?.reconnectMs) && config.reconnectMs.length > 0
        ? config.reconnectMs.map((v, i) => toValidNumber(v, DEFAULT_RECONNECT_MS[i] ?? 10000))
        : DEFAULT_RECONNECT_MS;

    const scheduleReconnect = () => {
      if (done) return;
      if (isExpired()) {
        warn('WS: reconnect stopped due to expiry');
        handleError(t('login.udidExpired'));
        return;
      }
      attempts += 1;
      setState({ status: 'reconnecting' });
      // Pasado el máximo se sigue intentando con el último delay hasta que expire el código.
      const boundedAttempt = Math.min(attempts, maxReconnectAttempts);
      const delay = reconnectDelays[Math.min(boundedAttempt - 1, reconnectDelays.length - 1)];
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectWs(udidCode);
      }, delay);
    };

    try {
      log('WS: connecting', { udidTail: String(udidCode).slice(-6) });
      ws = new deps.WebSocket(wsUrl);
    } catch {
      warn('WS: failed to create WebSocket');
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      attempts = 0;
      setState({ status: 'waiting_confirmation' });
      const payload = {
        type: 'auth_with_udid',
        udid: String(udidCode || '').trim().toLowerCase(),
        app_type: config?.appType || 'web',
        app_version: config?.appVersion || '1.0',
      };
      // temp_token sólo para marcas que lo piden: otros backends (p. ej. intv)
      // pueden rechazar claves desconocidas.
      if (config?.tempTokenRequired) payload.temp_token = tempToken;
      try {
        ws?.send(JSON.stringify(payload));
      } catch {
        warn('WS: send payload failed');
        scheduleReconnect();
        return;
      }
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(() => {
        try {
          if (ws?.readyState === deps.WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
        } catch {
          // noop
        }
      }, toValidNumber(config?.heartbeatMs, 30000));
    };

    ws.onmessage = (event) => {
      handleMessage(event);
    };

    ws.onclose = () => {
      if (done) return;
      if (isExpired()) {
        handleError(t('login.udidExpired'));
        return;
      }
      scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose maneja la reconexión
    };
  }

  async function start() {
    const config = opts.config;
    const requestUrl = buildApiUrl(config?.baseUrl, config?.requestPath || '/udid/request-udid-manual/');
    if (!config?.enabled || !requestUrl) {
      setState({ status: 'error', error: t('login.udidErrorConfig') });
      return;
    }

    done = false;
    attempts = 0;
    setState({
      error: '',
      code: '',
      expiresAt: null,
      remainingSeconds: 0,
      status: 'requesting_code',
    });
    cleanup();

    const controller = new AbortController();
    abortController = controller;
    const deviceFingerprint = deps.getUdid();

    // Llave efímera por pareo, sólo si la marca la pide (`tempTokenRequired`):
    // otros backends no entienden X-Device-Public-Key. Si el motor no soporta
    // WebCrypto RSA, se sigue sin ella (el backend cae al esquema estático).
    let ephemeralPublicKeyPem = null;
    if (config?.tempTokenRequired) {
      try {
        const keyPair = await deps.generateEphemeralKeyPair();
        ephemeralPrivateKey = keyPair.privateKey;
        ephemeralPublicKeyPem = keyPair.publicKeyPem;
      } catch (e) {
        ephemeralPrivateKey = null;
        warn('ephemeral key generation failed, falling back to static key scheme', { name: e?.name });
      }
    }

    try {
      log('HTTP: request UDID manual', { hasEphemeralPublicKey: !!ephemeralPublicKeyPem });
      const headers = { 'X-Device-Fingerprint': deviceFingerprint };
      if (ephemeralPublicKeyPem) {
        headers['X-Device-Public-Key'] = deps.encodePublicKeyForHeader(ephemeralPublicKeyPem);
      }
      const response = await deps.fetch(requestUrl, { method: 'GET', headers, signal: controller.signal });
      if (!response.ok) {
        let body = null;
        try {
          body = await response.json();
        } catch {
          body = null;
        }
        const retryAfter = body?.retry_after ? toValidNumber(body.retry_after, 0) : 0;
        if (response.status === 429 && retryAfter > 0) {
          setState({ status: 'rate_limited', error: t('login.udidRateLimit', { seconds: retryAfter }) });
          return;
        }
        throw new Error(t('login.udidErrorRequest'));
      }

      const data = await response.json();
      const udidCode = String(data?.udid || '').trim().toUpperCase();
      const expiresInMinutes = toValidNumber(data?.expires_in_minutes, 5);
      if (!udidCode) throw new Error(t('login.udidErrorRequest'));

      // Un backend viejo puede no mandar temp_token: queda '' (no lo exige).
      tempToken = String(data?.temp_token || '').trim();
      deps.setBrandItem(null, 'external_login_udid', udidCode);
      setState({
        tempToken,
        code: udidCode,
        expiresAt: deps.now() + expiresInMinutes * 60 * 1000,
        status: 'waiting_confirmation',
      });
      startCountdown();
      if (!done) connectWs(udidCode);
    } catch (e) {
      if (e?.name === 'AbortError') return;
      setState({ status: 'error', error: e?.message || t('login.udidErrorRequest') });
    } finally {
      if (abortController === controller) abortController = null;
    }
  }

  function cancel() {
    done = true;
    cleanup();
    setState({ status: 'cancelled' });
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Actualiza config/onCredentials/t sin reiniciar el pareo en curso. */
    setOptions(next) {
      opts = { ...opts, ...next };
    },
    start,
    retry: () => start(),
    cancel,
    /** Al desmontar: corta el pareo y deja de notificar (se puede volver a suscribir y usar start). */
    destroy() {
      done = true;
      cleanup();
      listeners.clear();
    },
  };
}

export default createUdidLoginFlow;
