import forge from 'node-forge';

const UDID_DEBUG =
  import.meta.env.DEV ||
  (typeof localStorage !== 'undefined' && localStorage.getItem('udid_debug') === '1');

function udidLog(...args) {
  if (!UDID_DEBUG) return;
  console.log('[UDID]', ...args);
}

function pkcs7Unpad(dataStr) {
  if (!dataStr || dataStr.length === 0) {
    throw new Error('Empty plaintext');
  }

  const padLen = dataStr.charCodeAt(dataStr.length - 1);

  let isValidPkcs7 = true;
  let errorMsg = '';

  // padding length debe estar entre 1 y 16
  if (padLen < 1 || padLen > 16) {
    isValidPkcs7 = false;
    errorMsg = `Padding length fuera de rango: ${padLen}`;
  }

  // no puede ser mayor que el buffer
  if (isValidPkcs7 && padLen > dataStr.length) {
    isValidPkcs7 = false;
    errorMsg = `Padding length mayor que buffer: ${padLen} > ${dataStr.length}`;
  }

  // bytes del padding deben ser iguales al padLen
  if (isValidPkcs7) {
    for (let i = 1; i <= padLen; i++) {
      if (dataStr.charCodeAt(dataStr.length - i) !== padLen) {
        isValidPkcs7 = false;
        errorMsg = `Byte de padding inconsistente en posición ${dataStr.length - i}`;
        break;
      }
    }
  }

  if (isValidPkcs7) {
    return dataStr.substring(0, dataStr.length - padLen);
  }

  // Fallback (como legacy): si parece terminar como JSON completo, devolvemos tal cual.
  const lastChar = dataStr.charAt(dataStr.length - 1);
  if (lastChar === '}' || lastChar === ']' || lastChar === '"') {
    return dataStr;
  }

  throw new Error(`Padding PKCS#7 inválido: ${errorMsg}`);
}

let cachedPrivateKeyForge = null;
let cachedPrivateKeyUrl = null;

function loadPrivateKey(privateKeyUrl) {
  const url = String(privateKeyUrl || '').trim();
  if (!url) return Promise.reject(new Error('privateKeyUrl is required'));

  if (cachedPrivateKeyForge && cachedPrivateKeyUrl === url) {
    return Promise.resolve(cachedPrivateKeyForge);
  }

  udidLog('UDID crypto: loading private key', { privateKeyUrl: url });

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status !== 200) {
        reject(new Error(`Failed to load private key (${xhr.status})`));
        return;
      }

      const pemText = xhr.responseText;
      if (!/BEGIN PRIVATE KEY/.test(pemText)) {
        reject(new Error('Clave debe ser PKCS#8 (-----BEGIN PRIVATE KEY-----)'));
        return;
      }

      const privateKey = forge.pki.privateKeyFromPem(pemText);
      cachedPrivateKeyForge = privateKey;
      cachedPrivateKeyUrl = url;
      udidLog('UDID crypto: private key loaded');
      resolve(privateKey);
    };
    xhr.send();
  });
}

/**
 * Descifra el payload híbrido (RSA-OAEP + AES-CBC) como en legacy LoginUdid.js.
 * @param {object} encryptedCredentials encrypted_credentials
 * @param {string} privateKeyUrl URL pública donde está private_key.pem
 * @returns {Promise<object>} decryptedData (login1, password, sn, pin...)
 */
export async function decryptEncryptedCredentials(encryptedUdid, privateKeyUrl) {
  if (!encryptedUdid || typeof encryptedUdid !== 'object') {
    throw new Error('encryptedUdid is required');
  }

  const creds =
    encryptedUdid && encryptedUdid.encrypted_credentials ? encryptedUdid.encrypted_credentials : {};

  // Si alguien pasa directamente el payload "creds", lo soportamos como mejora.
  const normalizedCreds =
    creds && creds.encrypted_data && creds.encrypted_key && creds.iv ? creds : encryptedUdid;

  const encryptedDataB64 = normalizedCreds.encrypted_data;
  const encryptedAESKeyB64 = normalizedCreds.encrypted_key;
  const ivB64 = normalizedCreds.iv;

  udidLog('UDID crypto: decryptHybridCBC inputs', {
    hasEncryptedData: !!encryptedDataB64,
    hasEncryptedKey: !!encryptedAESKeyB64,
    hasIv: !!ivB64,
  });

  if (!encryptedDataB64 || !encryptedAESKeyB64 || !ivB64) {
    throw new Error('Payload incompleto');
  }

  const privateKey = await loadPrivateKey(privateKeyUrl);

  // Decodificar base64 usando forge
  const iv = forge.util.decode64(ivB64);
  const encryptedAESKey = forge.util.decode64(encryptedAESKeyB64);
  const encryptedData = forge.util.decode64(encryptedDataB64);

  if (iv.length !== 16) {
    throw new Error(`IV inválido - longitud: ${iv.length}`);
  }

  // 1) RSA-OAEP (SHA-256) → clave AES usando node-forge
  let aesKeyRaw;
  try {
    aesKeyRaw = privateKey.decrypt(encryptedAESKey, 'RSA-OAEP', {
      md: forge.md.sha256.create(),
    });
  } catch (e) {
    throw new Error('Error descifrando AES key (RSA-OAEP): ' + (e?.message || e));
  }

  if (aesKeyRaw.length !== 32) {
    throw new Error('Clave AES inválida - longitud: ' + aesKeyRaw.length);
  }

  // 2) AES-CBC → plaintext con padding usando node-forge
  let paddedPlain;
  try {
    const decipher = forge.cipher.createDecipher('AES-CBC', aesKeyRaw);
    decipher.start({ iv });
    decipher.update(forge.util.createBuffer(encryptedData));
    const success = decipher.finish();
    if (!success) {
      throw new Error('Error en descifrado AES-CBC');
    }
    paddedPlain = decipher.output.getBytes();
  } catch (e) {
    throw new Error(e?.message || e);
  }

  // 3) Unpad + JSON
  try {
    const unpadded = pkcs7Unpad(paddedPlain);
    const result = JSON.parse(unpadded);
    return result;
  } catch (e) {
    throw new Error(e?.message || e);
  }
}

