# UDID `encrypted_credentials` – paso a paso (para Backend)

Este documento describe **exactamente** lo que hace el Frontend (React/Vite) para descifrar el payload `encrypted_credentials` recibido por WebSocket en el flujo de UDID.

La meta es que Backend y Frontend puedan comparar:
- formatos (base64/base64url)
- parámetros de RSA-OAEP (hash, MGF1, label)
- modo AES (AES-256-CBC, IV 16 bytes)
- contenido plaintext (JSON)

> Archivos frontend relevantes:
> - `src/services/udidCrypto.js`
> - `src/hooks/useUdidLoginFlow.js`
> - `src/config/brands.js` (marca `cableatlantico`: `udidLogin.privateKeyUrl`)

---

## 1) Payload esperado desde backend

En el WS llega un mensaje como:
- `type: "auth_with_udid:result"`
- `status: "ok"`
- `result: { encrypted_credentials: { encrypted_data, encrypted_key, iv, ... }, ... }`

Estructura mínima usada por Front:

```json
{
  "encrypted_credentials": {
    "encrypted_data": "base64...",
    "encrypted_key": "base64...",
    "iv": "base64...",
    "algorithm": "AES-256-CBC + RSA-OAEP",
    "app_type": "10foot"
  }
}
```

---

## 2) Configuración de llave privada (por marca)

El Front carga la llave privada desde una URL pública definida en configuración:

- `brands.js` → `cableatlantico.udidLogin.privateKeyUrl = "/cableatlantico/keys/private_key.pem"`
- El archivo vive en `public/cableatlantico/keys/private_key.pem`

Requisito:
- PEM **PKCS#8** (`-----BEGIN PRIVATE KEY-----`)

---

## 3) Librerías / APIs usadas en Front

### 3.1 WebCrypto (nativo del navegador)
El descifrado usa **WebCrypto**:
- `crypto.subtle.importKey(...)`
- `crypto.subtle.decrypt(...)`
- `TextDecoder("utf-8")`

No depende de `node-forge` para el decrypt en la versión actual.

### 3.2 Base64 decode
Se usa `atob(...)` para convertir base64 a bytes.

Además, se soporta base64url:
- `-` → `+`
- `_` → `/`
- se agrega padding `=` para múltiplo de 4

---

## 4) Paso a paso exacto del descifrado

### Paso 0 – Normalización base64/base64url
Antes de convertir a bytes:

- `normalizeBase64(b64)`:
  - trim
  - reemplaza `-/_` por `+/`
  - agrega `=` de padding si hace falta

Luego:
- `base64ToBytes(b64)`:
  - `atob(cleaned)`
  - genera `Uint8Array`

Se aplica a:
- `encrypted.encrypted_key`
- `encrypted.encrypted_data`
- `encrypted.iv`

### Paso 1 – Cargar PEM y convertir a DER (PKCS#8)
El front descarga el PEM desde `privateKeyUrl` (HTTP GET).

Luego:
- quita headers/footers `BEGIN/END ...`
- quita whitespace
- base64 decode

Resultado:
- `privateKeyDer: ArrayBuffer` (contenido pkcs8 DER)

### Paso 2 – Importar RSA Private Key (RSA-OAEP)
WebCrypto requiere importar la clave con el hash correcto.

El Front intenta en este orden (para diagnóstico/compatibilidad):
1. `RSA-OAEP` con hash **SHA-256**
2. `RSA-OAEP` con hash **SHA-1** (fallback si el backend realmente está usando SHA-1)

Código conceptual:

```js
const rsaPrivateKey = await crypto.subtle.importKey(
  "pkcs8",
  privateKeyDer,
  { name: "RSA-OAEP", hash: "SHA-256" },
  false,
  ["decrypt"]
);
```

### Paso 3 – RSA decrypt del `encrypted_key`
Con `encrypted_key_bytes` (256 bytes para RSA-2048):

```js
const aesKeyRaw = await crypto.subtle.decrypt(
  { name: "RSA-OAEP" },
  rsaPrivateKey,
  encryptedKeyBytes
);
```

El front valida:
- `aesKeyRaw.byteLength === 32` (AES-256)

Si falla aquí, en el front aparecerá:
- `RSA-OAEP decrypt failed: <name> <message>`

Y los logs mostrarán cuál hash falló (`SHA-256` o `SHA-1`).

> Nota: el backend indicó `label=None`, y WebCrypto por default usa label vacío.

### Paso 4 – Importar AES key (AES-CBC)

```js
const aesKey = await crypto.subtle.importKey(
  "raw",
  aesKeyRaw,
  { name: "AES-CBC" },
  false,
  ["decrypt"]
);
```

### Paso 5 – AES-CBC decrypt del `encrypted_data`
Con `ivBytes` (16 bytes):

```js
const plaintextBuf = await crypto.subtle.decrypt(
  { name: "AES-CBC", iv: ivBytes },
  aesKey,
  encryptedDataBytes
);
```

Si falla aquí, el front mostrará:
- `AES-CBC decrypt failed: <name> <message>`

### Paso 6 – TextDecoder + JSON.parse

```js
const plaintext = new TextDecoder("utf-8").decode(plaintextBuf);
const obj = JSON.parse(plaintext);
```

El objeto debe contener al menos:
- `login1`
- `password`
- opcional: `sn`, `pin`

---

## 5) Logs de diagnóstico en Front

El front solo loguea si:
- `localStorage.setItem("udid_debug","1")`
o está en modo DEV.

Logs clave (prefijo `[UDID]`):
- `UDID crypto: loading private key`
- `UDID crypto: private key der loaded`
- `UDID crypto: WebCrypto importKey { hash: ... }`
- `UDID crypto: WebCrypto RSA-OAEP decrypt failed { hash, name, message }`
- `UDID crypto: WebCrypto RSA-OAEP decrypt success { hash, aesKeyLen }`
- `UDID crypto: WebCrypto AES-CBC decrypt failed { name, message }`
- `UDID crypto: WebCrypto plaintext obtained { plaintextPrefix: ... }`

---

## 6) Errores típicos y qué significan (para Backend)

### A) Falla en RSA-OAEP
Síntoma:
- `RSA-OAEP decrypt failed ...`

Causas comunes:
- `encrypted_key` no corresponde a esa private key (mismatch)
- El backend cifró con OAEP distinto (SHA-1 vs SHA-256)
- El backend usó `label` no vacío
- El backend usó un encoding distinto (base64url vs base64) y el front no lo normaliza (ya se normaliza)

Qué necesita confirmar backend:
- OAEP hash real usado en `hybrid_encrypt_for_app()`
- MGF1 hash real (en WebCrypto suele ser el mismo que el hash del key)
- label usado (None/vacío vs string)

### B) Falla en AES-CBC
Síntoma:
- `AES-CBC decrypt failed ...`

Causas comunes:
- IV incorrecto (no 16 bytes)
- ciphertext mal decodificado (base64)
- la AES key descifrada no es la correcta

### C) Falla en JSON.parse
Síntoma:
- `SyntaxError` al parsear

Causas comunes:
- plaintext no es UTF-8 JSON (bytes corruptos)
- backend serializó algo distinto a `json.dumps(...)`

---

## 7) Archivos y dependencias actuales (frontend)

- `src/services/udidCrypto.js`: implementación WebCrypto
- `src/hooks/useUdidLoginFlow.js`: orquesta el WS y llama a `decryptEncryptedCredentials`
- `src/config/brands.js`: `privateKeyUrl` por marca

Dependencias:
- No requiere librerías para crypto (usa WebCrypto).

