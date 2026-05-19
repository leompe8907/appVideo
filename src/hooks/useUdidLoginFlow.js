import { useCallback, useEffect, useRef, useState } from 'react';
import { getUdid } from '../cv/udid';
import { decryptEncryptedCredentials } from '../services/udidCrypto';
import { setBrandItem } from '../utils/brandStorage';

const DEFAULT_RECONNECT_MS = [3000, 6000, 10000];
const UDID_DEBUG =
  import.meta.env.DEV ||
  (typeof localStorage !== 'undefined' && localStorage.getItem('udid_debug') === '1');

function udidLog(...args) {
  if (!UDID_DEBUG) return;
  console.log('[UDID]', ...args);
}

function udidWarn(...args) {
  if (!UDID_DEBUG) return;
  console.warn('[UDID]', ...args);
}

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

function extractCredentials(result) {
  if (!result || typeof result !== 'object') return null;
  const directUser = result.login1 ?? result.username ?? result.user;
  const directPass = result.password ?? result.pwd;
  if (UDID_DEBUG) {
    udidLog('extractCredentials input', {
      keys: Object.keys(result),
      directUserPresent: !!directUser,
      directPassPresent: !!directPass,
      hasCredentials: !!result.credentials,
      hasEncryptedCredentials: !!result.encrypted_credentials,
      hasEncryptedCredentials2: !!result.encryptedCredentials,
    });
  }
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

  if (UDID_DEBUG) {
    udidWarn('extractCredentials() could not map credentials');
  }
  return null;
}

async function processAuthResultPayload(
  payload,
  {
    extractCredentialsFn,
    handleErrorFn,
    cleanupFn,
    onCredentialsFn,
    setStatusFn,
    setErrorFn,
    t,
    privateKeyUrl,
  }
) {
  if (UDID_DEBUG) {
    udidLog('processAuthResultPayload()', {
      payloadKeys: payload && typeof payload === 'object' ? Object.keys(payload) : null,
    });
  }

  // 1) Caso 1: ya vienen las credenciales en claro.
  const credentials = extractCredentialsFn(payload);
  if (credentials) {
    cleanupFn();
    setStatusFn('logging_in');
    try {
      await onCredentialsFn(credentials);
      setStatusFn('success');
    } catch (e) {
      setStatusFn('error');
      setErrorFn(e?.message || t('login.errorGeneric'));
    }
    return;
  }

  // 2) Caso 2: vienen cifradas con encrypted_credentials.
  const encryptedCredentials = payload?.encrypted_credentials || payload?.encryptedCredentials;
  if (!encryptedCredentials) {
    handleErrorFn(t('login.udidErrorEncrypted'));
    return;
  }

  if (!privateKeyUrl) {
    handleErrorFn(t('login.udidErrorDecryptKeyMissing'));
    return;
  }

  try {
    // Legacy decryptHybridCBC espera un "encryptedUdid" con `encrypted_credentials`.
    const encryptedUdid =
      payload?.encrypted_credentials || payload?.encryptedCredentials
        ? payload
        : { encrypted_credentials: encryptedCredentials };

    const decryptedData = await decryptEncryptedCredentials(encryptedUdid, privateKeyUrl);
    const decryptedCredentials = extractCredentialsFn(decryptedData);
    if (!decryptedCredentials) {
      handleErrorFn(t('login.udidErrorDecrypt'));
      return;
    }

    cleanupFn();
    setStatusFn('logging_in');
    await onCredentialsFn(decryptedCredentials);
    setStatusFn('success');
  } catch (e) {
    setStatusFn('error');
    setErrorFn(e?.message || t('login.udidErrorDecrypt'));
  }
}

export function useUdidLoginFlow({ config, appName, onCredentials, t }) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [expiresAt, setExpiresAt] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const heartbeatRef = useRef(null);
  const countdownRef = useRef(null);
  const abortRef = useRef(null);
  const attemptsRef = useRef(0);
  const doneRef = useRef(false);
  const activeCodeRef = useRef('');
  const expiresAtRef = useRef(null);

  const cleanup = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // noop
      }
      wsRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    doneRef.current = true;
    cleanup();
    setStatus('cancelled');
  }, [cleanup]);

  const handleError = useCallback(
    (message) => {
      udidWarn('handleError()', { message });
      doneRef.current = true;
      cleanup();
      setStatus('error');
      setError(message || t('login.udidErrorGeneric'));
    },
    [cleanup, t]
  );

  const connectWs = useCallback(
    (udidCode) => {
      const wsUrl = String(config?.wsUrl || '').trim();
      if (!wsUrl) {
        udidWarn('WS: missing wsUrl');
        handleError(t('login.udidErrorConfig'));
        return;
      }

      const maxReconnectAttempts = toValidNumber(config?.maxReconnectAttempts, 3);
      const reconnectDelays = Array.isArray(config?.reconnectMs) && config.reconnectMs.length > 0
        ? config.reconnectMs.map((v, i) => toValidNumber(v, DEFAULT_RECONNECT_MS[i] ?? 10000))
        : DEFAULT_RECONNECT_MS;

      const scheduleReconnect = () => {
        if (doneRef.current) return;
        // Si el código ya expiró, no seguimos reintentando.
        if (expiresAtRef.current && Date.now() >= expiresAtRef.current) {
          udidWarn('WS: reconnect stopped due to expiry');
          handleError(t('login.udidExpired'));
          return;
        }
        attemptsRef.current += 1;
        setStatus('reconnecting');
        // No cortar el flujo antes de que expire el código:
        // cuando supera el máximo, seguimos intentando con el último delay.
        const boundedAttempt = Math.min(attemptsRef.current, maxReconnectAttempts);
        const delay = reconnectDelays[Math.min(boundedAttempt - 1, reconnectDelays.length - 1)];
        reconnectRef.current = setTimeout(() => {
          reconnectRef.current = null;
          connectWs(udidCode);
        }, delay);
      };

      try {
        udidLog('WS: connecting', { wsUrl, udidTail: String(udidCode).slice(-6) });
        wsRef.current = new WebSocket(wsUrl);
      } catch {
        udidWarn('WS: failed to create WebSocket');
        scheduleReconnect();
        return;
      }

      wsRef.current.onopen = () => {
        attemptsRef.current = 0;
        setStatus('waiting_confirmation');
        const normalizedUdidForWs = String(udidCode || '').trim().toLowerCase();
        udidLog('WS: onopen, send auth_with_udid', { udidTail: normalizedUdidForWs.slice(-6) });
        const payload = {
          type: 'auth_with_udid',
          udid: normalizedUdidForWs,
          app_type: config?.appType || '10foot',
          app_version: config?.appVersion || '1.0',
        };
        try {
          wsRef.current?.send(JSON.stringify(payload));
        } catch {
          udidWarn('WS: send payload failed');
          scheduleReconnect();
          return;
        }
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(() => {
          try {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'ping' }));
            }
          } catch {
            // noop
          }
        }, toValidNumber(config?.heartbeatMs, 30000));
      };

      wsRef.current.onmessage = async (event) => {
        if (doneRef.current) return;
        let message = null;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (UDID_DEBUG) {
          udidLog('WS: onmessage', {
            rawType: message?.type ?? message?.event,
            status: message?.status,
            hasResult: message?.result != null,
            resultKeys: message?.result && typeof message.result === 'object' ? Object.keys(message.result) : [],
            hasEncryptedCredentials: !!message?.result?.encrypted_credentials,
            code: message?.result?.code ?? message?.code,
          });
        }
        const messageType = String(message?.type ?? message?.event ?? '').toLowerCase();
        const messageStatus = String(message?.status ?? '').toLowerCase();

        if (messageType === 'ping') {
          try {
            wsRef.current?.send(JSON.stringify({ type: 'pong' }));
          } catch {
            // noop
          }
          return;
        }

        if (messageType === 'pong') {
          return;
        }

        // Backends pueden marcar "pending" pero con status que indica avance.
        if (messageType === 'pending') {
          if (messageStatus === 'validated' || messageStatus === 'authorized' || messageStatus === 'used') {
            setStatus('logging_in');
          } else {
            setStatus('waiting_confirmation');
          }
          return;
        }

        if (messageType === 'timeout') {
          handleError(t('login.udidExpired'));
          return;
        }

        // Soportar variantes de tipo usadas por distintos backends.
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
          // El servidor ya confirmó validación remota del UDID.
          const validatedPayload = message?.result ?? message?.data?.result ?? message?.data ?? message?.payload ?? null;
          udidLog('WS: udid.validated event', {
            hasValidatedPayload: !!validatedPayload,
            validatedKeys: validatedPayload && typeof validatedPayload === 'object' ? Object.keys(validatedPayload) : [],
          });

          if (validatedPayload) {
            const hasEncryptedCreds =
              !!validatedPayload?.encrypted_credentials || !!validatedPayload?.encryptedCredentials;
            const hasPlainCreds = !!extractCredentials(validatedPayload);

            // Algunos backends solo confirman la validación del UDID sin incluir credenciales.
            if (hasEncryptedCreds || hasPlainCreds) {
              setStatus('logging_in');
              doneRef.current = true;
              await processAuthResultPayload(validatedPayload, {
                extractCredentialsFn: extractCredentials,
                handleErrorFn: handleError,
                cleanupFn: cleanup,
                onCredentialsFn: onCredentials,
                setStatusFn: setStatus,
                setErrorFn: setError,
                t,
                privateKeyUrl: config?.privateKeyUrl,
              });
            } else {
              setStatus('waiting_confirmation');
            }
          }

          return;
        }

        if (isAuthResultType || hasAuthResultByShape) {
          const status = messageStatus;
          const resultPayload = message?.result ?? message?.data ?? null;
          const errorCode = String(message?.result?.code ?? message?.code ?? '').toLowerCase();
          udidLog('WS: auth result handler', { status, errorCode, hasResultPayload: !!resultPayload });
          // Algunos backends envían estados intermedios en el mismo tipo.
          if (status === 'pending' || status === 'not_validated' || status === 'waiting') {
            setStatus('waiting_confirmation');
            return;
          }
          if (status !== 'ok' || !resultPayload) {
            // Caso observado: "invalid_udid" puede ocurrir antes de que el usuario valide en móvil.
            // No cortar el flujo; seguir esperando hasta expiración o evento udid.validated.
            if (errorCode === 'invalid_udid') {
              setStatus('waiting_confirmation');
              return;
            }
            // Error final del backend; recién aquí cortamos flujo.
            handleError(t('login.udidErrorAuth'));
            return;
          }
          doneRef.current = true;
          await processAuthResultPayload(resultPayload, {
            extractCredentialsFn: extractCredentials,
            handleErrorFn: handleError,
            cleanupFn: cleanup,
            onCredentialsFn: onCredentials,
            setStatusFn: setStatus,
            setErrorFn: setError,
            t,
            privateKeyUrl: config?.privateKeyUrl,
          });
        }
      };

      wsRef.current.onclose = () => {
        if (doneRef.current) return;
        const isCodeExpired = expiresAtRef.current && Date.now() >= expiresAtRef.current;
        udidWarn('WS: onclose', { isCodeExpired, attempts: attemptsRef.current });
        if (isCodeExpired) {
          handleError(t('login.udidExpired'));
          return;
        }
        scheduleReconnect();
      };

      wsRef.current.onerror = () => {
        // noop: onclose manejará reconexión
      };
    },
    [cleanup, config, handleError, onCredentials, t]
  );

  const start = useCallback(async () => {
    const enabled = !!config?.enabled;
    const requestUrl = buildApiUrl(config?.baseUrl, config?.requestPath || '/udid/request-udid-manual/');
    if (!enabled || !requestUrl) {
      setStatus('error');
      setError(t('login.udidErrorConfig'));
      return;
    }

    doneRef.current = false;
    attemptsRef.current = 0;
    setError('');
    setCode('');
    setExpiresAt(null);
    expiresAtRef.current = null;
    setRemainingSeconds(0);
    setStatus('requesting_code');
    cleanup();

    const controller = new AbortController();
    abortRef.current = controller;
    const deviceFingerprint = getUdid();

    try {
      udidLog('HTTP: request UDID manual', {
        requestUrl,
        udidFingerprintTail: String(deviceFingerprint || '').slice(-6),
      });
      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: { 'X-Device-Fingerprint': deviceFingerprint },
        signal: controller.signal,
      });
      if (!response.ok) {
        let retryAfter = 0;
        let body = null;
        try {
          body = await response.json();
        } catch {
          body = null;
        }
        if (body?.retry_after) {
          retryAfter = toValidNumber(body.retry_after, 0);
        }
        if (response.status === 429 && retryAfter > 0) {
          setStatus('rate_limited');
          setError(t('login.udidRateLimit', { seconds: retryAfter }));
          return;
        }
        throw new Error(t('login.udidErrorRequest'));
      }

      const data = await response.json();
      udidLog('HTTP: UDID response', {
        responseKeys: data && typeof data === 'object' ? Object.keys(data) : [],
        udid: data?.udid,
        expires_in_minutes: data?.expires_in_minutes,
      });
      const udidCode = String(data?.udid || '').trim().toUpperCase();
      const expiresInMinutes = toValidNumber(data?.expires_in_minutes, 5);
      if (!udidCode) {
        throw new Error(t('login.udidErrorRequest'));
      }

      activeCodeRef.current = udidCode;
      setBrandItem(null, 'external_login_udid', udidCode);
      setCode(udidCode);
      const finalExpiresAt = Date.now() + expiresInMinutes * 60 * 1000;
      expiresAtRef.current = finalExpiresAt;
      setExpiresAt(finalExpiresAt);
      setStatus('waiting_confirmation');
      connectWs(udidCode);
    } catch (e) {
      if (e?.name === 'AbortError') return;
      setStatus('error');
      setError(e?.message || t('login.udidErrorRequest'));
    } finally {
      abortRef.current = null;
    }
  }, [cleanup, config, connectWs, t]);

  const retry = useCallback(() => {
    start();
  }, [start]);

  useEffect(() => {
    if (!expiresAt) return;
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining <= 0) {
        doneRef.current = true;
        cleanup();
        setStatus('expired');
      }
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [cleanup, expiresAt]);

  useEffect(() => {
    return () => {
      doneRef.current = true;
      expiresAtRef.current = null;
      cleanup();
    };
  }, [cleanup]);

  return {
    status,
    error,
    code,
    remainingSeconds,
    appName: appName || 'App',
    isActive: ['requesting_code', 'waiting_confirmation', 'reconnecting', 'logging_in'].includes(status),
    start,
    retry,
    cancel,
  };
}

export default useUdidLoginFlow;
