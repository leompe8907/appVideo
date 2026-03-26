# Optimizacion de Login por UDID (Legacy -> React)

## Objetivo

Definir una implementacion de login por UDID mas robusta, mantenible y segura para la app React, tomando como base la logica legacy (`scene/login.js`, `module/LoginUdid.js`, `app.js`).

---

## Estado actual observado (legacy)

El flujo funciona, pero mezcla en un solo modulo:

- UI del modal.
- WebSocket + reconexion + heartbeat.
- Decrypt criptografico.
- Login final y navegacion.
- Manejo de errores/rate-limit.

Esto dificulta testear, mantener y migrar.

---

## Principios de optimizacion

1. Separar responsabilidades (UI, red, cripto, orquestacion).
2. Evitar logica duplicada entre Splash/Login.
3. Reducir estados inconsistentes con una maquina de estados simple.
4. Hacer el flujo observable (logs/metricas) sin ruido.
5. Mantener compatibilidad con backend actual.

---

## Arquitectura recomendada en React

## 1) Capa de configuracion de marca

En `brands.js`, agregar un objeto dedicado para UDID:

```js
udidLogin: {
  enabled: true,
  requestUrl: "/udid/request-udid-manual/",
  validateUrl: "/udid/validate/",
  wsUrl: "wss://...",
  appType: "10foot",
  appVersion: "1.0",
  showQrInTvOnly: true
}
```

Beneficio: evitar hardcode y permitir activar/desactivar por marca.

---

## 2) Capa de servicios (sin UI)

### `src/services/udidLoginService.js`

Responsable de:

- pedir UDID manual (`requestUdidManual`)
- abrir WS (`openUdidSocket`)
- heartbeat
- reconexion con backoff
- cierre limpio (`dispose`)

### `src/services/udidCryptoService.js`

Responsable de:

- cargar clave privada
- decrypt payload (RSA-OAEP + AES-CBC + PKCS7)
- validar estructura final de credenciales

### `src/services/udidSessionService.js`

Responsable de:

- persistir `external_login_udid`
- limpiar estado al cancelar/fallar/revocar
- exponer helpers para Splash

Beneficio: codigo testeable por unidad y reusable.

---

## 3) Capa de orquestacion

### `src/hooks/useUdidLoginFlow.js`

Un hook que maneje estados y eventos:

- `idle`
- `requesting_code`
- `code_ready`
- `waiting_confirmation`
- `decrypting`
- `logging_in`
- `success`
- `expired`
- `error`
- `cancelled`

Acciones expuestas:

- `start()`
- `retry()`
- `cancel()`

Datos expuestos:

- `udidCode`
- `expiresAt`
- `remainingSeconds`
- `errorType`
- `errorMessage`

Beneficio: UI simple, sin mezclar logica compleja.

---

## 4) Capa UI

### `LoginPage.jsx` + `UdidLoginModal.jsx`

- `LoginPage` solo dispara apertura/cierre.
- `UdidLoginModal` renderiza estado actual del hook.
- QR se genera desde `appName:udid`.
- En PC puede mostrarse codigo + instrucciones; en TV se prioriza QR.

---

## Flujo optimizado propuesto

1. Usuario pulsa "Login por UDID".
2. `start()` pide UDID al backend.
3. Se muestra codigo + countdown.
4. Se abre WS y queda escuchando `auth_with_udid:result`.
5. Si llega `ok`:
   - decrypt payload
   - ejecutar `loginAndActivateLicense()`
   - navegar segun licencia activa/perfiles.
6. Si expira:
   - estado `expired`
   - mostrar retry.
7. Si usuario cancela:
   - cerrar WS/timers/request
   - limpiar estado.

---

## Optimizaciones tecnicas concretas

## A) Reconexion WS controlada

- Usar backoff exponencial con jitter (ejemplo: 3s, 6s, 10s + random).
- Limite maximo de intentos configurable por marca.
- No reintentar si countdown ya expiro.
- Reportar razon de cierre (code/reason) en logs de debug.

## B) Countdown confiable

- Basarlo en `expiresAt` (timestamp), no solo decremento local.
- Recalcular en cada tick con `Date.now()` para evitar drift.
- Al volver del background/tab suspendido, recalcular inmediatamente.

## C) Cancelacion segura

- Implementar `AbortController` para request inicial.
- Metodo unico `dispose()` que limpie:
  - xhr/fetch
  - ws
  - heartbeat
  - intervals/timeouts

## D) Decrypt robusto

- Validar estructura antes de decrypt.
- Manejar errores por tipo:
  - `key_load_error`
  - `decrypt_error`
  - `invalid_payload`
- Evitar logs sensibles (no imprimir credenciales).

## E) Integracion con flujo de login existente

- Reusar `loginAndActivateLicense()` (ya implementado).
- Si payload trae licencia (`sn`/`pin`), intentar activacion dirigida.
- Fallback automatico a auto-activate si falla licencia puntual.

## F) Splash sincronizado

- Mantener validacion `udid/validate` en splash.
- Extraer decision de estados (`used/revoked/pending`) a helper comun para no duplicar reglas.

---

## Manejo de errores recomendado (matriz)

- `request_udid_timeout` -> mostrar retry inmediato.
- `request_udid_rate_limit` -> countdown de retry basado en `retry_after`.
- `ws_connection_failed` -> reintentar hasta limite; luego error recuperable.
- `ws_timeout` -> volver a `code_ready` si sigue vigente.
- `decrypt_error` -> error no recuperable de sesion (retry completo).
- `login_error_auth` -> mostrar credenciales invalidas (segun backend).
- `license_in_use` -> fallback a seleccion/licencia alternativa.

---

## Seguridad

- No persistir credenciales descifradas en texto plano.
- Limitar lifetime de datos sensibles en memoria.
- Limpiar estado sensible en `cancel`, `error`, `unmount`.
- Preferir clave privada fuera de assets publicos si backend permite cambio de protocolo.

Nota: si la clave privada vive en frontend, la seguridad real es limitada; conviene evolucionar a intercambio de token de un solo uso validado en backend.

---

## Observabilidad minima

Agregar eventos de tracking (sin datos sensibles):

- `udid_login_start`
- `udid_code_received`
- `udid_ws_connected`
- `udid_ws_reconnect_attempt`
- `udid_payload_decrypted`
- `udid_login_success`
- `udid_login_error_{tipo}`
- `udid_login_cancelled`

---

## Plan de implementacion por fases

## Fase 1 (base funcional)

- Crear `udidLogin` en config de marca.
- Implementar `udidLoginService` (request + ws + countdown).
- Implementar `UdidLoginModal` y boton en `LoginPage`.

## Fase 2 (integracion completa)

- Implementar decrypt en `udidCryptoService`.
- Conectar con `loginAndActivateLicense`.
- Manejar resultados de licencia y navegacion.

## Fase 3 (hardening)

- Reconexion con jitter.
- Matriz de errores completa.
- Tracking y logs de debug controlados por entorno.
- Tests unitarios de servicios y hook.

---

## Criterios de aceptacion

- En marca con `udidLogin.enabled=true`, se puede iniciar login UDID.
- Se muestra codigo/QR y countdown correcto.
- Confirmacion remota completa login y redirige correctamente.
- Cancelar limpia recursos sin leaks.
- Timeout/reintentos muestran estados claros al usuario.
- Splash respeta estados `used/revoked/pending` sin regresiones.

---

## Estado

Documento de optimizacion creado.
Pendiente implementacion por fases en codigo React.
