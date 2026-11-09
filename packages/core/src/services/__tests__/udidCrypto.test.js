import { describe, it, expect } from 'vitest';
import { decryptEncryptedCredentials } from '../udidCrypto';

const toB64 = (bytes) => Buffer.from(bytes).toString('base64');

async function rsaKeyPair() {
  return crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt'],
  );
}

// Igual que wind/utils/crypto_tv.py: clave AES de 32 bytes cifrada con RSA-OAEP y
// el JSON cifrado con AES; en GCM el tag de 16 bytes viaja aparte.
async function encryptLikeBackend(publicKey, data, mode) {
  const aesRaw = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(mode === 'gcm' ? 12 : 16));
  const name = mode === 'gcm' ? 'AES-GCM' : 'AES-CBC';
  const aesKey = await crypto.subtle.importKey('raw', aesRaw, { name }, false, ['encrypt']);
  const out = new Uint8Array(
    await crypto.subtle.encrypt({ name, iv }, aesKey, new TextEncoder().encode(JSON.stringify(data))),
  );
  const encryptedKey = new Uint8Array(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, aesRaw));
  const creds = { encrypted_key: toB64(encryptedKey), iv: toB64(iv) };
  if (mode === 'gcm') {
    creds.encrypted_data = toB64(out.slice(0, -16));
    creds.tag = toB64(out.slice(-16));
  } else {
    creds.encrypted_data = toB64(out);
  }
  return { encrypted_credentials: creds };
}

describe('decryptEncryptedCredentials', () => {
  const data = { login1: 123, password: 'x', sn: 'SN1' };

  it('descifra AES-256-GCM con tag (lo que manda el backend con llave efímera)', async () => {
    const keys = await rsaKeyPair();
    const payload = await encryptLikeBackend(keys.publicKey, data, 'gcm');
    await expect(decryptEncryptedCredentials(payload, { privateKey: keys.privateKey })).resolves.toEqual(data);
  });

  it('sigue descifrando AES-CBC sin tag (esquema viejo)', async () => {
    const keys = await rsaKeyPair();
    const payload = await encryptLikeBackend(keys.publicKey, data, 'cbc');
    await expect(decryptEncryptedCredentials(payload, { privateKey: keys.privateKey })).resolves.toEqual(data);
  });

  it('rechaza un GCM con el tag alterado', async () => {
    const keys = await rsaKeyPair();
    const payload = await encryptLikeBackend(keys.publicKey, data, 'gcm');
    const tag = Buffer.from(payload.encrypted_credentials.tag, 'base64');
    tag[0] ^= 1;
    payload.encrypted_credentials.tag = toB64(tag);
    await expect(decryptEncryptedCredentials(payload, { privateKey: keys.privateKey })).rejects.toThrow(
      /AES-GCM decrypt failed/,
    );
  });
});
