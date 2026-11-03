function toHex(buffer) {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

function randomSaltHex(byteLen = 16) {
  const arr = new Uint8Array(byteLen);
  // crypto.getRandomValues existe en navegadores modernos; en TVs antiguas puede faltar.
  // Si falta, se degradará a un salt "débil" (pero el PIN nunca se guarda plano).
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function pbkdf2Hex(pin, saltHex, iterations = 120000) {
  if (
    typeof crypto === 'undefined' ||
    !crypto.subtle ||
    typeof TextEncoder === 'undefined'
  ) {
    throw new Error('WebCrypto no disponible');
  }
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(String(pin)),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const saltBytes = new Uint8Array(
    (saltHex.match(/.{1,2}/g) || []).map((h) => parseInt(h, 16))
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return toHex(bits);
}

/**
 * Deriva un hash de PIN con salt.
 * - Preferencia: PBKDF2 (WebCrypto)
 * - Fallback: CryptoJS SHA256(pin + ':' + salt) si WebCrypto no existe
 */
export async function derivePinHash({ pin, saltHex, iterations = 120000 }) {
  const normalizedPin = String(pin ?? '').trim();
  if (!normalizedPin) throw new Error('PIN vacío');
  const salt = String(saltHex || '').trim() || randomSaltHex(16);

  try {
    const hashHex = await pbkdf2Hex(normalizedPin, salt, iterations);
    return { saltHex: salt, hashHex, method: 'pbkdf2-sha256', iterations };
  } catch {
    // Fallback: CryptoJS (ya está en dependencias del repo)
    const mod = await import('crypto-js');
    const CryptoJS = mod.default || mod;
    const hashHex = CryptoJS.SHA256(`${normalizedPin}:${salt}`).toString();
    return { saltHex: salt, hashHex, method: 'sha256', iterations: 0 };
  }
}

export function timingSafeEqual(a, b) {
  const aa = String(a ?? '');
  const bb = String(b ?? '');
  if (aa.length !== bb.length) return false;
  let out = 0;
  for (let i = 0; i < aa.length; i++) out |= aa.charCodeAt(i) ^ bb.charCodeAt(i);
  return out === 0;
}

