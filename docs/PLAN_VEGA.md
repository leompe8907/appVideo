# Plan de acción — app Fire TV para Vega OS

Creado el 06-10-2026. Base: appVideo (servicios, stores, marcas) + el reproductor validado en `~/Desktop/VegaPruebaRN` (Shaka parcheado por Amazon con unwrap de keys Panaccess), React Native 0.83, SDK Vega 0.24.

Estimación: **~13–16 semanas** con una persona dedicada, **~9–10** con dos.

## Estado al 06-10-2026 (para retomar)

### Qué se decidió
- El proyecto Android (Kotlin/Compose + `.aar` DRM de Panaccess) **no sirve** para Vega: Vega no corre APKs.
- La base es **appVideo**: ya reproduce Panaccess en JS puro (HLS AES-128 con key `mekey` por segmento; unwrap de keys de 32 bytes en `src/player/engines/web/HlsPlaybackController.js`).
- Se descartó por ahora el **camino A** (appVideo dentro del WebView de Vega): el dispositivo virtual de Mac Intel no soporta WebView. Se sigue el **camino B** (React Native para Vega).

### Qué se probó (dispositivo virtual, Mac Intel)
| Prueba | Resultado |
|---|---|
| WebCrypto de `react-native-w3cmedia` (importKey + decrypt) | OK |
| Unwrap de key Panaccess 32→16 bytes con la key/IV de appVideo | OK |
| HLS sin cifrar y HLS AES-128 de prueba con Shaka 4.8.5 parcheado | OK |
| **Canal real INTV TV Jornal en vivo** (key distinta por segmento) | **OK: 90,5 s en 93 s reales, 17 keys, ABR a 720p, 13 `waiting` cortos** |
| INTV Globo Nordeste | No probado: el CDN da 404 en todos los segmentos (problema del servidor) |
| **Fire TV Stick 4K Select real** (Vega OS 1.2, `callie`, armv7l, IP 192.168.4.218) — TV Jornal en vivo | **OK: 90,1 s en 92 s reales, 17 keys, 12 `waiting` cortos** (06-10-2026) |

Para ver los logs de la prueba en el stick: `vda -s 192.168.4.218:5555 reverse tcp:8765 tcp:8765` y `PROBE_LOG_URL = 'http://127.0.0.1:8765/log'` en `src/App.tsx` (`vda` está en `~/vega/sdk/vega-sdk/main/0.24.9914/bin/tools/vda`).

Detalle técnico y cómo reproducir: `~/Desktop/VegaPruebaRN/PRUEBA_VEGA.md`.

### Entorno
- SDK Vega en `~/vega` (`source ~/vega/env`, CLI `vega`).
- Node 20 en `/usr/local/opt/node@20/bin` (el del sistema es 18; appVideo y Vega piden 20+). Para appVideo: `PATH="/usr/local/opt/node@20/bin:$PATH" corepack pnpm run dev`.
- Java para armar Shaka: el de Android Studio (`/Applications/Android Studio.app/Contents/jbr/Contents/Home`).
- `~/Desktop/VegaPruebaRN/src/probeStreams.local.ts` tiene un `sessionId` de INTV de prueba (en `.gitignore`; vence al cerrar sesión).
- Disco: ~7 GB libres al 06-10.

### Avance de la app Vega (07-10-2026)
Control parental probado en el Fire TV: PIN, bloqueo y desbloqueo de canal, PIN incorrecto. Su diseño de TV se replicó en la web ([VEGA_PARENTAL_A_WEB.md](VEGA_PARENTAL_A_WEB.md)). El reloj de Mi Cuenta y de los reproductores se actualiza solo.

### Pendientes pedidos (07-10-2026)
1. ~~**VOD por categorías.**~~ Hecho (07-10): si `getVodLibraries` llega sin grupos, el núcleo los pide con `getOttCategoryGroups`, como Android (`~/Desktop/Hospitality`, `VodService.kt` / `VodShelves.kt`). Usa los grupos curados (género, destacados, listas, recomendado), sin filas de menos de 2 títulos y sin repetir por nombre entre grupos. INTV pasa de 1 fila a 18 categorías más Recomendado. Corrige también la web.
2. ~~**Reproductor.**~~ Hecho (07-10): en vivo, Guía (si `EPG.enabled`), bloquear/desbloquear canal (si la marca tiene control parental), Canales, Info y Audio/Subtítulos. En VOD y catchup, Audio/Subtítulos. Probado en el stick. Falta: botones de reproducción en vivo (`player.showPlaybackButtonsOnLive`), «En vivo» con timeshift, calidad (Wind). HBO Hd de MultiplusTV no reproduce (Shaka 3014): revisar.
3. **Barra inferior del menú lateral.** Corregido (07-10): la línea bajo la opción elegida medía todo el panel; ahora mide lo que el texto, como la web. Confirmar con el usuario si se refería a eso.
4. **Scroll y foco con el control.** En curso (07-10): muro del home virtualizado (era lento con 11 bouquets); el foco ya no queda invisible al volver del reproductor ni al elegir la sección actual en el menú; en el Buscador y la contraseña del login ◀ ▶ salen del campo con texto. Seguir revisando las demás pantallas.
5. **Menú «Guía» (EPG):** no aparece en INTV porque su marca tiene `EPG.enabled: false` (`packages/core/src/config/brands/intv.js`). Confirmar si es lo esperado o si hay que encenderlo.
6. **Flags de marca:** revisar todo lo configurable en `packages/core/src/config/brands/*.js` y dejar en una tabla qué se aplica en el Fire TV y qué no.
7. **App de MultiplusTV:** crearla para probar catchup, EPG y VOD, porque esa cuenta tiene todos esos datos. La marca ya existe en el núcleo; el build sale con `VEGA_BRAND=multiplustv` como `com.bromteck.appvideo.multiplustv`. Imágenes: el splash y el fondo de 1920×1080 en JPG van en `apps/vega/assets/brand-source/multiplustv/`; si faltan, se convierten los de `public/multiplustv/`. Logos y placeholder salen de `public/multiplustv/`. Hacen falta credenciales de prueba de MultiplusTV.
8. **▶ al final de una fila salta a otra fila.** Estando en el último canal de cualquier bouquet, ▶ manda el foco a la fila anterior o a la siguiente, en vez de quedarse ahí. Causa probable: el motor de foco de la TV busca el elemento más cercano hacia la derecha y, como en esa fila no hay más, toma una tarjeta de la fila vecina que llega más a la derecha. Arreglo propuesto: que cada fila retenga el foco a los costados (`TVFocusGuideView` con `trapFocusRight`/`trapFocusLeft`, o `nextFocusRight` apuntando a sí misma en la última tarjeta). Revisar también qué hace la web en ese caso y copiarlo.

### Avance de la app Vega (06-10-2026, noche)
Con el diseño de appVideo y verificado en el Fire TV (Debug y Release): splash, login (teclado del sistema), smartcard con "licencia en uso", home (menú lateral, bouquets con EPG, banners), reproductor en vivo con HUD (zapping por LCN, listado de canales, info), Películas (VOD: filas, detalle, episodios, reproductor), Buscador y Mi Cuenta. Arreglos en el núcleo que también corrigen la web: VOD sin grupos de categorías (antes no se mostraba), fechas de EPG restauradas de caché. Pendiente: catchup/EPG, perfiles, OSMS, pistas de audio/subtítulos, publicación (Fase 6).

### Avance de la app Vega (06-10-2026, rama `vega/core`)
`apps/vega` corre en el Fire TV Stick 4K Select (192.168.4.218) con `@appvideo/core`: splash con validación de sesión, login manual, home con los bouquets y canales reales de INTV (logos incluidos) y vivo a pantalla completa con zapping. Probado: TV Jornal, TV Tribuna, RedeTV!, TV Guararapes, Gazeta; Globo Nordeste muestra el error (404 del CDN). Cómo compilar, instalar, ver logs, sacar capturas y simular el control: [apps/vega/README.md](../apps/vega/README.md).

Ya instalados: AsyncStorage de Amazon (la sesión persiste al reiniciar) y React Navigation de Amazon (stack).

## Fase 0 — Decisiones y requisitos previos (1 semana)
1. ~~**Comprar 1–2 Fire TV Stick 4K Select.**~~ Hecho: hay uno conectado y en modo desarrollador. El dispositivo virtual de la Mac Intel decodifica por software, no corre WebView y no sirve para medir rendimiento.
2. **Elegir la marca piloto** (Wind o INTV; INTV ya está probada con un canal real).
3. **Confirmar con Panaccess y cada operador** que la vía HTML5 (`os=HTML5`, `requestMode=m3u8` + `mekey`) se puede usar en Fire TV. Relevar por marca: key de 16 o 32 bytes, CDN, backend propio (Wind).
4. **Cuenta de Amazon Developer**: identificadores de paquete y si cada marca tendrá su propia ficha en la tienda.
5. **Liberar disco**: cada build de Vega + `node_modules` ocupa ~1 GB.

## Fase 1 — Código compartido (2 semanas)
Convertir appVideo en monorepo (ya usa pnpm) con `packages/core`:
- **Adentro:** `services/`, `store/` (Zustand), `config/` (marcas), `cv/`, `query/` y utilidades sin DOM (~12.000 líneas, casi sin dependencias del navegador).
- **Adaptadores por plataforma:**
  - **Almacenamiento:** appVideo usa `localStorage` síncrono en ~40 lugares (sobre todo `panaccessService`, `brandConfig`, `preloadStore`). En Vega: caché en memoria cargada de AsyncStorage al arrancar, con escritura por detrás.
  - **Red:** sólo `fetch`; el modo JSONP de `cv.js` queda para la web.
  - **Crypto:** CryptoJS funciona igual; `WebCrypto` de Amazon sólo para el unwrap de keys.
  - **`udid`** e información del dispositivo.
- **Criterio de salida:** la web funciona igual y pasan los tests de vitest.
- **Avance (rama `vega/core`, 06-10-2026):**
  - Hecho: `src/platform/storage.js` (`getStorage`/`setStorageBackend`, `createAsyncBackedStorage` para AsyncStorage) y `src/platform/runtime.js` (user agent, idioma, red, parámetro `brand`, paso a segundo plano). Servicios, stores, config, `cv/` e i18n ya no tocan `localStorage`, `navigator` ni `window.location` directamente. JSONP falla limpio fuera de la web. 121 tests OK, build de INTV OK, web verificada.
  - Hecho: `packages/core` (`@appvideo/core`) con `services/`, `store/`, `config/` (marcas), `cv/`, `query/`, `locales/`, `platform/`, 18 utils y el cliente del worker de EPG (84 archivos, movidos con `git mv`). La web importa `@appvideo/core/...` (alias en `vite.config.js` y `vitest.config.js`). Cortes para que el núcleo no dependa del DOM: `brandConfig` avisa con `onBrandCacheInvalidated` (la web registra la caché del fondo del home); el foco del gate parental se inyecta con `setParentalGateFocusAdapter` (web: `src/utils/parentalGateWebFocus.js`); `facebookSocialLogin` vuelve a la web. ESLint prohíbe globals de navegador en `packages/core` (sólo 5 archivos los declaran, y los usan tras comprobar `typeof`).
  - Pendiente: `import.meta.env` (~50 usos) → en Metro usar un plugin de Babel que lo reemplace (p. ej. `babel-plugin-transform-vite-meta-env`) en lugar de tocar el código; `udid`/información del dispositivo para Vega; reCAPTCHA (`recaptchaService`, usado por `deviceAuthService` y `accountSecurityService`) no existe en Vega: definir con el backend cómo validar esas llamadas desde la TV.
  - **Correr `pnpm install`** con red para actualizar `pnpm-lock.yaml` (nuevo paquete del workspace) antes de publicar; sin eso, un `install --frozen-lockfile` (Vercel) falla.

## Fase 2 — Esqueleto de la app Vega (1–2 semanas) — en curso, ver arriba
- Partir de `VegaPruebaRN`. ✔ (`apps/vega`)
- Navegación con los paquetes de React Navigation portados por Amazon; foco con `TVFocusGuideView`.
- Colores y assets por marca.
- Splash → login (manual y QR, `useUdidLoginFlow`) → precarga de datos.

## Fase 3 — Reproductor (2 semanas)
- `VegaShakaEngine` que cumpla el contrato de `src/player/engines/contracts.js`, para que `PlayerContext` no cambie.
- Reutilizar de la prueba: `keyUnwrap.ts`, inyección del `sessionId` (equivalente a `sessionHlsXhrSetup.js`), `play()` en `loadedmetadata`.
- Afinar el vivo: `bufferingGoal` y `presentationDelay` (13 cortes breves en 90 s con listas de 3 segmentos).
- Portar: zapping, selección de calidad de Wind (`windLevelSelect`), reintentos, "licencia en uso", pausa/reanudación en segundo plano.
- **Criterio de salida:** vivo, catchup y VOD en el stick con al menos dos marcas.

## Fase 4 — Pantallas (4–5 semanas)
Reescribir las 15 páginas de appVideo en React Native, en este orden:
1. Home, lista de canales y EPG.
2. Catchup y VOD (con series).
3. Búsqueda.
4. Mi cuenta, control parental, OSM y perfil.
5. Smartcard y publicidad.

## Fase 5 — Integraciones de Vega (opcional, 1–2 semanas)
Content Launcher (Alexa abre un canal), controles de media del sistema, Account Login, proveedor de EPG o canales en el home de Fire TV.

## Fase 6 — QA y publicación (2 semanas)
- Pruebas en el stick: memoria, arranque, horas de vivo, pérdida de red, reanudación.
- Script de build por marca (`.vpkg` con manifiesto y assets).
- Envío a la Amazon Appstore.

## Riesgos
| Riesgo | Mitigación |
|---|---|
| Algún operador o canal exige DRM por hardware (Widevine/PlayReady) en TV | Confirmar en la Fase 0; Vega los soporta vía EME |
| Diferencias entre marcas (keys envueltas, backend de Wind, CDN) | Probar cada marca contra su middleware real en la Fase 3 |
| Rendimiento de Shaka en JS en el stick | Medir temprano en el dispositivo real; probar `enableNativeParsing` de Amazon |
| Canales caídos del lado del servidor (Globo Nordeste: 404) | Mensaje de error claro en la app |
| Amazon deja de publicar parches de Shaka | Fijar 4.8.5; seguir el repo `AmazonAppDev/vega-video-sample` |

## Próximos pasos inmediatos
1. Pedir el Fire TV Stick 4K Select.
2. Definir la marca piloto y mandar a Panaccess las preguntas de la Fase 0.
3. Empezar la Fase 1: crear `packages/core` en appVideo y el adaptador de almacenamiento.
