# Auditoría Técnica — appVideo (2026-07-28), segunda pasada

**Proyecto:** appVideo — OTT multi-marca (Smart TV Samsung Tizen / LG webOS, hardware objetivo 2019, y Web)
**Contexto:** siguiente pasada sobre `docs/AUDITORIA_2026-07-20.md`. Desde esa fecha se implementaron y verificaron con tests 9 correcciones: retry/backoff de red en streaming, integración real de `FocusManager`/`NavigationRouter`, consolidación de los 3 listeners de `keydown` en reproducción, fix del `setInterval(1000ms)` de `EpgCards.jsx`, eliminación de `brandConfig.EPG.rowsOnInit` (config muerta), optimización de `prepareRecorded()` de catchup, endurecimiento de `enableWorker` en hls.js, y el bug de "buffer de carga infinito" en middleware Panaccess (confirmado resuelto en vivo por el usuario).
**Metodología:** 4 revisiones especializadas en paralelo (player/engines, navegación+UI, store/services/sesión, build/config/multi-marca), cada una con instrucción explícita de **no repetir** los hallazgos ya corregidos arriba, para maximizar cobertura de terreno nuevo. Esta es solo la fase de **diagnóstico** — nada de lo listado abajo fue corregido todavía, a la espera de priorizar en conjunto.
**Nota importante:** esta pasada no volvió a verificar el estado de los hallazgos de `AUDITORIA_2026-07-20.md` que quedaron abiertos (RSA key pública, `ConfirmModal` sin foco, Catchup/Parental/Perfil sin nav D-pad, overlay de error desconectado, `azcopy.exe` trackeado, etc.) **excepto uno**: la auditoría de build de hoy re-encontró de forma independiente la clave privada RSA pública (ver 1.3 abajo) — sigue sin resolverse 8 días después.

---

## 1. CRÍTICOS

### 1.1 `LgEngine`: `setDimensions()` / `show()` / `hide()` entran en recursión infinita y cuelgan la pestaña
- **Archivo:** `src/player/engines/lg/LgEngine.js:184, 198, 212` (`nativeSetDimensions`, `nativeShow`, `nativeHide`), llamadas desde `src/player/engines/tv/BaseTvEngine.js:147-187`.
- **Problema:** en el adaptador real `'webos-luna'`, `nativeSetDimensions(rect)` termina llamando `super.setDimensions(rect)`. Como `this` sigue siendo la instancia de `LgEngine` con `isNativeActive = true`, `BaseTvEngine.setDimensions()` vuelve a invocar `this.nativeSetDimensions(rect)` — recursión sin fin hasta `RangeError: Maximum call stack size exceeded`. Idéntico patrón en `show()`/`hide()`.
- **Por qué importa:** hoy no hay ningún `.jsx` que llame a estos tres métodos (por eso está dormido), pero forman parte del contrato público del engine (espejado 1:1 en `WebEngine`/`SamsungEngine`) — el día que se conecte resize/PiP/visibilidad en LG, la app se cuelga al instante en hardware real.
- **Severidad:** crítica pero latente — priorizar antes de tocar cualquier feature de resize/PiP en LG.

### 1.2 El bundle de producción de cada marca filtra los tokens DRM de **todas** las demás marcas y la clave AES de sesión
- **Archivos:** `src/store/preloadStore.js:12-15`, `src/config/resolveBrandToken.js:20`, y ~20 sitios más que acceden a `import.meta.env` de forma dinámica u opcional (`import.meta.env?.DEV`, `import.meta.env[key]`) en vez de la forma estática `import.meta.env.CLAVE_EXACTA` que Vite necesita para reemplazar variable por variable.
- **Evidencia directa:** `dist/wind/assets/index-legacy-*.js` (ya commiteado en el repo) contiene en texto plano `VITE_BRAND_TOKEN_BROMTECK`, `VITE_BRAND_TOKEN_CABLEATLANTICO`, etc. — los tokens DRM de **todas** las marcas, no solo Wind — y también el valor real de `VITE_SECRET_KEY` (la clave AES que "cifra" usuario/contraseña en `localStorage`, ver `src/utils/userSession.js`).
- **Por qué importa:** cualquier usuario de cualquier marca puede abrir devtools y recuperar los tokens DRM de las otras 6 marcas y la clave que protege las credenciales guardadas de todos los usuarios.
- **Recomendación:** eliminar todo acceso dinámico/opcional a `import.meta.env` (usar siempre la forma estática exacta por variable) y regenerar los builds; auditar qué ya se filtró en despliegues anteriores y rotar esos tokens/clave.

### 1.3 Clave privada RSA seguía pública en el bundle (hallazgo re-confirmado, no nuevo)
- **Archivo:** `public/cableatlantico/keys/private_key.pem`, referenciado desde `src/config/brands.js:1321`, copiado a `dist/cableatlantico/` en cada build.
- **Estado:** ya reportado como 1.1 CRÍTICO en `AUDITORIA_2026-07-20.md` (8 días atrás) — la auditoría de hoy lo volvió a encontrar de forma independiente, sin buscarlo a propósito. Sigue sin resolverse.
- **Recomendación:** sin cambios respecto al informe anterior — el descifrado debe moverse al backend; purgar el archivo del historial de git y rotar la clave.

---

## 2. ALTOS

### Player / engines
- **`LgEngine`: race condition entre `destroy()`/`load()` y un handshake DRM en curso** (`LgEngine.js:86-89, 216-244, 250-277`) — la cola de tareas nativas serializa pero no cancela; un `destroy()` síncrono puede completarse antes de que un `_webosLoadSource` anterior termine, y este re-adjunta `<source>`/`play()` sobre un elemento que la app ya considera destruido. `HlsPlaybackController` ya resuelve esta misma clase de problema con un token de generación; `LgEngine` no tiene equivalente.
- **`LgEngine` nunca difiere `LOADED`/`PLAYING` como sí hace `SamsungEngine`** — no implementa `shouldDeferNativePlayback()`/`shouldSkipNativePlayingEvent()`, así que la UI muestra "reproduciendo" mientras el handshake DRM de LG sigue en curso (pantalla congelada con indicador de "play" encendido).
- **`HlsPlaybackController.load()` no es async y puede tirar una excepción síncrona que nunca llega al `.catch()` del caller** (`HlsPlaybackController.js:205-221`, `windHlsManifest.js:18`, caller en `videojsHlsSourceHandler.js:62`) — una URL malformada revienta silenciosamente sin disparar `onError`, reproduciendo el síntoma de "pantalla congelada sin error visible".
- **Los engines nativos (Samsung/LG) no tienen forma de interceptar sub-requests** (renovación de sesión, `mekey` rotativo) como sí hace el motor web vía `xhrSetup`/loader custom — si algún día se habilita el adaptador nativo para un operador Panaccess/Wind, el streaming con rotación de key se rompe en hardware real aunque funcione en el fallback web.

### Seguridad (store/services/sesión)
- **`actionUrl` de anuncios se navega sin validar el esquema** (`src/utils/adActivate.js:44-59`, dato crudo de `adsData.js:68`) — a diferencia del campo `file` (que sí exige `^https?://`), `actionUrl` solo rechaza vacío/`#`/`null`/`undefined`. Un `actionUrl: "javascript:..."` desde un anuncio comprometido se ejecuta en el origen de la app.
- **Tokens de sesión de dispositivo guardados en texto plano, a diferencia de usuario/contraseña** (`src/services/deviceAuthService.js:37-41,168-233`, vía `brandStorage.js` sin cifrar) — estos tokens habilitan acciones irreversibles (`changePassword`, `closeAccount`); cualquier lectura de `localStorage` (XSS, TV compartida) los expone sin necesitar la clave AES que sí protege usuario/contraseña.

### Build / multi-marca
- **`build:telecable` construye una marca que no existe** (`package.json`, `src/config/brands.js` no define `telecable`) — el plugin de single-brand-config retorna `null` sin fallar el build, así que el `dist/telecable` resultante queda con la configuración de las 6 marcas completa sin filtrar (agrava el punto 1.2).
- **Copy-paste: `bromteck` apunta a la clave privada de `cableatlantico`** (`src/config/brands.js:296`) — en un build real de Bromteck ese archivo no existe, el fallback de UDID pairing da 404 en producción.
- **Bromteck y Cableatlantico comparten el mismo token DRM**, con evidencia de mezcla de tokens entre marcas en los comentarios de `.env.local` — riesgo de colisión de entitlements/facturación entre dos tenants distintos.
- **`check-brand-secrets.js` solo escanea un archivo y un patrón** — no detecta el secreto real hardcodeado en `src/config/brandConfig.js:11-12` (`epgApiKey`/`epgApiToken`), que sí se embebe en las 7 marcas mientras el gate de prebuild reporta éxito.

---

## 3. MEDIOS

### Rendimiento (navegación/UI)
- **`ChannelCard` (BouquetLayouts.jsx:217-226) reintroduce el mismo anti-patrón ya corregido en EpgCards** — un `setInterval(1000ms)` **por tarjeta** en vez de uno solo por pantalla; con 100+ tarjetas visibles en el muro de Inicio, son 100+ timers independientes corriendo por siempre mientras la fila esté montada (en web, sin ningún guard).
- **La grilla de EPG no está virtualizada y recorre cientos de candidatos con `getComputedStyle` en cada tecla** (`EpgCards.jsx:216` + `spatialNavigation.js:60-71`) — a diferencia de `BouquetHorizontalGrid`/`BouquetGridVertical`, que sí usan `useChunkedList`. `getComputedStyle` fuerza layout síncrono sobre cientos de nodos en la interacción más sensible a latencia de toda la app.
- **La memoización de `Card` en EpgCards queda anulada por closures inline** (`EpgCards.jsx:57` + líneas 308-349) — `onEnter` se recrea en cada render, así que `React.memo` nunca evita el re-render, negando en la práctica el ahorro que se buscó con el fix del intervalo.

### Datos / arquitectura
- **PIN parental sin límite de intentos** (`src/store/parentalGateStore.js:293-332`) — verificación 100% local (PBKDF2), sin contador ni backoff; se pueden probar los 10.000 PIN de 4 dígitos en menos de un minuto desde la consola del navegador.
- **`BrandContext.changeBrand()` no resetea el estado de precarga al cambiar de marca sin reload** (`src/contexts/BrandContext.jsx:118-131`) — una carga en vuelo de la marca anterior puede escribir EPG/VOD/catchup de la marca vieja sobre el store que la UI nueva está leyendo. Hoy nadie llama a esta función con `reload=false`, así que es latente.
- **`osmsStore.pollOsms` pierde su guard de reentrancia una vez que hay caché** (`src/store/osmsStore.js:90-150`) — el `setInterval` y el listener de `visibilitychange` (`useOsmsPolling.js:32-42`) pueden disparar dos fetches concurrentes; gana el que responda último, no el más reciente.
- **80 líneas de lógica duplicadas entre `VodDetailModal` y `VodDetailModalClassic`** (parsing de cast/directores, fetch de info de series, `handlePlay`) — ya empezaron a divergir (fallbacks de poster distintos); cualquier fix futuro hay que aplicarlo dos veces.

### Player
- **Duplicación de la selección de nivel Wind**: `pickWindCompatibleLevel(hls)` se llama desde dos suscriptores independientes a `MANIFEST_PARSED` sobre la misma instancia de hls.js (`HlsPlaybackController.js:258-272` y vía `WebEngine.js:300`) — hoy inofensivo (idempotente), pero un futuro cambio en uno de los dos no se reflejaría en el otro.
- **Worker de EPG huérfano ya divergió del que realmente corre** (`src/workers/epgNormalize.worker.js`, 0 imports, vs. la copia inline en `epgWorkerClient.js`) — enmascarado hoy porque todo consumidor hace duck-typing con `.valueOf()`, pero es una trampa para quien "arregle" el archivo equivocado.
- **`unwrapPanaccessKey` asume `crypto.subtle` siempre disponible** (`HlsPlaybackController.js:35-42`) — si falta en algún WebView 2019, el catch actual deja pasar la key todavía envuelta, reproduciendo el mismo síntoma de descifrado silencioso que costó tanto diagnosticar en la key rotativa de Panaccess.

### Build
- **Verificación ES-compat cubre solo 2 de los patrones incompatibles con Chrome 53/63** (`scripts/check-es-compat.js`) — no detecta campos privados de clase, `??=`/`||=`/`&&=`, `Array.prototype.at`, `Object.hasOwn`, etc. Un ✅ verde no garantiza que el bundle sea TV-safe.
- **`multiplustv` tiene configuración de marca completa pero sin scripts `build:`/`preview:`/`prebuild:`/`postbuild:` en `package.json`** (y a la inversa, `telecable` tiene scripts pero no configuración — ver 2.3 en Altos) — los dos inventarios de marcas están mantenidos a mano y desincronizados.
- **Producción solo emite el chunk "legacy" (ES5 + polyfills) para todas las plataformas**, incluyendo navegadores modernos de escritorio (`vite.config.js:78-86`, `renderModernChunks: isDev`) — todo usuario web descarga el bundle más pesado pensado para TVs 2019.

---

## 4. BAJOS

- **Timeout de éxito sin cancelar en modales de Perfil** (`CreateProfileModal.jsx:96`, `DeleteProfileModal.jsx:63`) — si el modal se cierra por otra vía dentro de 1.2-1.5s, `onSuccess` igual dispara después contra un closure obsoleto.
- **Paneles de cuenta sin guard de desmontaje en `setState` async** (`LinkedDevicesPanel.jsx`, `ChangePasswordPanel.jsx`) — mismo patrón que otros componentes ya resuelven con una bandera `cancelled`.
- **`Bouquet.jsx` es código muerto (0 imports) con un focus-trap latente** (`tabIndex={-1}` en TV excluye sus filas de `FOCUSABLE_SELECTOR`) — recomendable borrarlo o corregirlo antes de cualquier reuso futuro.
- **`ParentalSettingsPage.jsx` mapea la lista completa de canales sin memoización** (`ParentalChannelCard` sin `React.memo`, closures inline) — impacto bajo por ser pantalla de configuración, no ruta caliente.
- **`OsdKeyboardContext.showKeyboard` puede dejar colgada la promesa de un llamador anterior** si se invoca dos veces antes de resolver la primera — sin timeout ni rechazo.
- **Query key de ads no está scoped por marca** (`src/query/keys.js:66`) — si esa infraestructura (hoy sin uso real) se activa, serviría anuncios de la marca anterior tras un cambio de marca.
- **Tres pasadas de Babel redundantes para las mismas dos features de sintaxis**, todas emparejadas por un heurístico de nombre de archivo frágil (`vite.config.js`, `vite/ensureLegacyEs5Plugin.js`, `scripts/babel-legacy-dist.js`).
- **`packaging/tizen/config.xml` sigue siendo una plantilla sin completar** (`YOUR_APP_ID`, `YOUR_PACKAGE_ID`), y es un único template compartido por 6 marcas que necesitan IDs/certificados distintos para publicarse.
- **`pnpm-workspace.yaml` no es realmente un archivo de workspace** — solo contiene el allowlist de `allowBuilds`; puede confundir a quien espere un monorepo.

---

## 5. Cómo seguir

Todo lo de arriba es diagnóstico — nada se tocó todavía. Para priorizar juntos, los tres bloques con mayor relación impacto/esfuerzo son:

1. **1.2 (filtración de `import.meta.env`)** — el fix es mecánico (reemplazar accesos dinámicos/opcionales por la forma estática exacta) y cierra una fuga de credenciales de las 7 marcas a la vez.
2. **1.1 (recursión infinita en `LgEngine`)** — el fix es acotado (cambiar el patrón `super.x()` que reentra en el propio dispatcher) y evita un crash garantizado el día que se use resize/PiP en LG.
3. **1.3 / RSA key** — ya lleva 8 días abierto desde la auditoría anterior; si no se va a resolver ahora, vale la pena decidirlo explícitamente para no seguir redescubriéndolo.

Quedo atento a qué querés atacar primero.
