const UDID_DEBUG =
  import.meta.env.DEV ||
  (typeof localStorage !== 'undefined' && localStorage.getItem('udid_debug') === '1');

function udidLog(...args) {
  if (!UDID_DEBUG) return;
  console.log('[UDID]', ...args);
}

function normalizeBase64(b64) {
  let s = String(b64 ?? '').trim();
  // Soportar base64url: '-' -> '+', '_' -> '/'
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  // Asegurar padding '=' múltiplo de 4
  const padLen = (4 - (s.length % 4)) % 4;
  if (padLen > 0) s += '='.repeat(padLen);
  return s;
}

function base64ToBytes(b64) {
  const cleaned = normalizeBase64(b64).replace(/\s+/g, '');
  const bin = atob(cleaned);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function pemPkcs8ToDer(pem) {
  const b64 = String(pem)
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  return base64ToBytes(b64).buffer;
}

let cachedPrivateKeyDer = null;
let cachedPrivateKeyUrl = null;

async function loadPrivateKeyDer(privateKeyUrl) {
  const url = String(privateKeyUrl || '').trim();
  if (!url) throw new Error('privateKeyUrl is required');

  if (cachedPrivateKeyDer && cachedPrivateKeyUrl === url) return cachedPrivateKeyDer;

  udidLog('UDID crypto: loading private key', { privateKeyUrl: url });
  const resp = await fetch(url, { method: 'GET' });
  if (!resp.ok) throw new Error(`Failed to load private key: ${resp.status}`);

  const pemText = await resp.text();
  if (!/BEGIN PRIVATE KEY/.test(pemText)) {
    throw new Error('Clave debe ser PKCS#8 (-----BEGIN PRIVATE KEY-----)');
  }

  const der = pemPkcs8ToDer(pemText);
  cachedPrivateKeyDer = der;
  cachedPrivateKeyUrl = url;
  udidLog('UDID crypto: private key der loaded');
  return der;
}

/**
 * Descifra `encrypted_credentials` usando WebCrypto:
 * - RSA-OAEP SHA-256 (decrypt encrypted_key)
 * - AES-CBC (decrypt encrypted_data)
 * - plaintext es JSON (backend hizo json.dumps(...))
 */
export async function decryptEncryptedCredentials(encryptedUdid, privateKeyUrl) {
  if (!encryptedUdid || typeof encryptedUdid !== 'object') {
    throw new Error('encryptedUdid is required');
  }

  const creds =
    encryptedUdid && encryptedUdid.encrypted_credentials ? encryptedUdid.encrypted_credentials : {};

  // Soportar el caso donde te pasan directamente creds (en vez del wrapper)
  const normalizedCreds =
    creds && creds.encrypted_data && creds.encrypted_key && creds.iv ? creds : encryptedUdid;

  const encryptedDataB64 = normalizedCreds.encrypted_data;
  const encryptedAESKeyB64 = normalizedCreds.encrypted_key;
  const ivB64 = normalizedCreds.iv;

  udidLog('UDID crypto: decryptEncryptedCredentials inputs', {
    hasEncryptedData: !!encryptedDataB64,
    hasEncryptedKey: !!encryptedAESKeyB64,
    hasIv: !!ivB64,
  });

  if (!encryptedDataB64 || !encryptedAESKeyB64 || !ivB64) {
    throw new Error('Payload incompleto');
  }

  const privateKeyDer = await loadPrivateKeyDer(privateKeyUrl);

  // Decodifica inputs base64 (base64/base64url)
  const encryptedKeyBytes = base64ToBytes(encryptedAESKeyB64);
  const ivBytes = base64ToBytes(ivB64);
  const encryptedDataBytes = base64ToBytes(encryptedDataB64);

  if (ivBytes.length !== 16) {
    throw new Error(`IV inválido - longitud: ${ivBytes.length}`);
  }

  // 1) RSA-OAEP -> AES key raw 32 bytes
  udidLog('UDID crypto: WebCrypto RSA-OAEP decrypt start', {
    encryptedKeyBytesLen: encryptedKeyBytes.length,
  });
  let aesKeyRaw = null;
  const rsaAttempts = [
    { name: 'RSA-OAEP', hash: 'SHA-256', label: undefined },
    { name: 'RSA-OAEP', hash: 'SHA-1', label: undefined },
  ];

  let lastRsaErr = null;
  for (const attempt of rsaAttempts) {
    try {
      udidLog('UDID crypto: WebCrypto importKey', { hash: attempt.hash });
      const rsaPrivateKey = await crypto.subtle.importKey(
        'pkcs8',
        privateKeyDer,
        { name: 'RSA-OAEP', hash: attempt.hash },
        false,
        ['decrypt'],
      );

      // Nota: algunos navegadores soportan {name:'RSA-OAEP', label: Uint8Array}
      // pero el backend indica label=None (equivalente a vacío), y por defecto es vacío.
      aesKeyRaw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, rsaPrivateKey, encryptedKeyBytes);
      udidLog('UDID crypto: WebCrypto RSA-OAEP decrypt success', {
        hash: attempt.hash,
        aesKeyLen: aesKeyRaw?.byteLength,
      });
      break;
    } catch (e) {
      lastRsaErr = e;
      udidLog('UDID crypto: WebCrypto RSA-OAEP decrypt failed', {
        hash: attempt.hash,
        name: e?.name,
        message: e?.message,
      });
    }
  }

  if (!aesKeyRaw) {
    throw new Error(
      `RSA-OAEP decrypt failed: ${lastRsaErr?.name || ''} ${lastRsaErr?.message || ''}`.trim()
    );
  }

  if (aesKeyRaw.byteLength !== 32) {
    throw new Error(`Clave AES inválida - longitud: ${aesKeyRaw.byteLength}`);
  }

  const aesKey = await crypto.subtle.importKey('raw', aesKeyRaw, { name: 'AES-CBC' }, false, [
    'decrypt',
  ]);

  // 2) AES-CBC -> plaintext (WebCrypto quita padding)
  let plaintextBuf;
  try {
    plaintextBuf = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: ivBytes }, aesKey, encryptedDataBytes);
  } catch (e) {
    udidLog('UDID crypto: WebCrypto AES-CBC decrypt failed', { name: e?.name, message: e?.message });
    throw new Error(`AES-CBC decrypt failed: ${e?.name || ''} ${e?.message || ''}`.trim());
  }

  const plaintext = new TextDecoder('utf-8').decode(plaintextBuf);
  udidLog('UDID crypto: WebCrypto plaintext obtained', { plaintextPrefix: plaintext.slice(0, 80) });

  return JSON.parse(plaintext);
}

