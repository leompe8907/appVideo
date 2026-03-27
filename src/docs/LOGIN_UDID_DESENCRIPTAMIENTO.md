# Desencriptamiento UDID (React)

## Objetivo
El backend del flujo UDID puede devolver credenciales en el WS con el formato:
- `encrypted_credentials` (contiene `encrypted_data`, `encrypted_key`, `iv`)

La app React debe descifrar ese payload para obtener:
- `username`
- `password`
- `licenseKey` (si aplica, típicamente `sn`)
- `pin` (si aplica)

Esto replica la lógica del legacy `LoginUdid.js` (Heroku/EPG), que usaba un desencriptamiento híbrido:
- RSA-OAEP (para descifrar la clave AES)
- AES-CBC (para descifrar el payload)
- PKCS#7 unpad + `JSON.parse`

## Cambios implementados

### 1) Crypto: servicio dedicado
Se agregó el módulo:
- `src/services/udidCrypto.js`

Incluye:
1. **Carga de clave privada (PKCS#8)** desde URL pública (por brand):
   - Se usa `XMLHttpRequest` (en vez de `fetch`) para mantener compatibilidad tipo legacy.
2. **Descifrado híbrido**:
   - Decodifica `iv`, `encrypted_key`, `encrypted_data` con `forge.util.decode64`
   - Descifra `encrypted_key` con `privateKey.decrypt(..., 'RSA-OAEP', ...)`
   - Descifra `encrypted_data` con `AES-CBC` y IV
   - Hace `PKCS#7 unpad` y parsea JSON
3. **Soporte base64url**:
   - Normaliza `-/_` a `+/` y asegura padding `=`

4. **Fallback RSA OAEP**:
   - Primer intento: `RSA-OAEP` con `md: sha256`
   - Segundo intento (si falla): `RSA-OAEP` con `md: sha256` + `mgf1: { md: sha1 }`

### 2) Hook UDID: integración con decrypt
Se actualizó:
- `src/hooks/useUdidLoginFlow.js`

Se cambió el procesamiento del payload cuando llega por WS:
- `auth_with_udid:result` con `status: ok` y `result.encrypted_credentials`

Ahora el hook:
1. Detecta si el payload trae credenciales en claro (si aplica).
2. Si no están en claro, intenta descifrar `encrypted_credentials`.
3. Usa la `privateKeyUrl` definida por marca para descifrar.
4. Convierte el resultado descifrado al formato que `handleUdidCredentials` espera:
   - `username`, `password`, `licenseKey` (`sn`), `pin`

Además se ajustó la lógica de `udid.validated` para no cortar el flujo si el evento llega sin credenciales.

### 3) Configuración por marca (cableatlantico)
Se actualizó:
- `src/config/brands.js`

Para `brand: "cableatlantico"` se agregó:
- `udidLogin.privateKeyUrl: "/cableatlantico/keys/private_key.pem"`

La ruta apunta al PEM que vive en:
- `public/cableatlantico/keys/private_key.pem`

### 4) Compatibilidad de activación de licencia
Se ajustó:
- `src/pages/LoginPage.jsx`

Durante el login UDID, se setea:
- `failIfInUse: false`

Esto replica el comportamiento observado en el legacy (evitar que “en uso” detenga el flujo).

### 5) i18n: mensajes de error de decrypt
Se agregaron claves nuevas en:
- `src/locales/es.json`
- `src/locales/en.json`
- `src/locales/pt.json`

Claves:
- `login.udidErrorDecryptKeyMissing`
- `login.udidErrorDecrypt`

### 6) node-forge
Se fijó la versión para replicar mejor el legacy:
- `node-forge@1.0.0`

Esto reduce incompatibilidades relacionadas con RSA-OAEP entre versiones.

## Cómo depurar (recomendado)
1. Abre consola del navegador.
2. Ejecuta:
   - `localStorage.setItem('udid_debug','1')`
3. Reintenta el login UDID.
4. Busca logs con prefijo:
   - `[UDID]`

Puntos clave a observar:
- **WS**: si el payload trae `encrypted_credentials`
- **Carga de llave**: si GET de `privateKeyUrl` responde 200/304
- **RSA decrypt**:
  - si falla con `Invalid RSAES-OAEP padding`, suele ser por encoding de `encrypted_key`/`encrypted_data` o mismatch de esquema (mitigado con fallback `mgf1 sha1` y normalización base64url).
- **AES unwrap**:
  - si pasa RSA y falla AES/JSON, normalmente es un problema de base64/IV/cipher o PKCS#7.

## Resultado esperado
Cuando el WS llegue con `encrypted_credentials`:
- debe descifrarse el RSA-OAEP correctamente
- debe descifrarse AES-CBC
- debe parsearse el JSON
- y el hook debe continuar con `loginAndActivateLicense(...)`

## Notas de seguridad
- Se usa una **llave privada en el cliente** (por el requisito de compatibilidad del flujo).
- Esto es menos seguro que descargar/desencriptar en backend.
- Si el backend pudiera devolver credenciales en claro (o hacerlo server-side), sería el enfoque ideal.

## Archivos relevantes (resumen)
- `src/services/udidCrypto.js`
- `src/hooks/useUdidLoginFlow.js`
- `src/pages/LoginPage.jsx`
- `src/config/brands.js`
- `src/locales/es.json`, `src/locales/en.json`, `src/locales/pt.json`

