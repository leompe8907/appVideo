# Auditoría Técnica Independiente — appVideo (2026-07-20)

**Proyecto:** appVideo — OTT multi-marca (Smart TV Samsung Tizen / LG webOS, hardware objetivo 2019, y Web)
**Stack:** React 18 + Vite 7 + Zustand 5 + React Router 7 + React Query + hls.js + video.js 6.6.3
**Metodología:** verificación directa e independiente del código actual (no se asumió nada de los 4 informes previos en `docs/`). Se realizaron 5 revisiones especializadas en paralelo — seguridad/multi-marca, player/engines TV, capa de datos/rendimiento, navegación TV/foco, build/compatibilidad/calidad — cada una leyendo el código línea por línea, contrastando contra `AUDITORIA_CONSOLIDADA_PLAN_ACCION.md` y `PLAN_NAVEGACION_TV.md` solo para verificar si lo declarado "resuelto" sigue siéndolo hoy.
**Estado general:** el proyecto sigue activamente en desarrollo. De los ~63 hallazgos previos, una parte real está resuelta (transpilación ES5, bootstrap nativo TV, cifrado de sesión, activación de engines nativos, foco de Sidebar y muro de Inicio, sistema de scroll/foco en TV), pero aparecieron **hallazgos críticos nuevos no documentados antes** — el más grave, una clave privada RSA expuesta públicamente en el bundle — y varias regresiones (`azcopy.exe` vuelto a trackear en git; página VOD sin el mismo cache de layout que sí tiene Inicio).

---

## Cómo leer este documento

Cada hallazgo indica: archivo y línea, evidencia, por qué importa en el contexto específico de TVs 2019 (CPU/RAM limitados, sin mouse/touch, decodificación por hardware, motores Chromium 53–63) y una recomendación concreta. Al final de cada bloque de severidad se listan también los ítems que se **verificaron como ya resueltos**, para no dar la impresión de que nada avanzó.

---

## 1. CRÍTICOS

Riesgos que comprometen datos de usuario o dejan al usuario sin poder usar partes completas de la app con el control remoto. Deben resolverse antes de cualquier despliegue a producción o a hardware real.

### 1.1 Clave privada RSA real, servida públicamente en el bundle de producción
- **Archivos:** `public/cableatlantico/keys/private_key.pem` (commiteado en git y copiado a `dist/cableatlantico/` en cada build por `vite/brandPublicAssets.js`), referenciado desde `src/config/brands.js:283,1219` (`privateKeyUrl`), consumido en `src/services/udidCrypto.js` (`loadPrivateKeyDer` hace `fetch()` sin autenticación, luego RSA-OAEP + AES-CBC decrypt).
- **Problema:** el flujo de "login remoto por UDID/QR" descifra credenciales en el navegador del TV usando una clave privada que se descarga por una URL pública sin autenticación — y que además está commiteada en el repositorio. Cualquiera puede descargar el `.pem` y descifrar credenciales `encrypted_credentials` interceptadas. El cifrado, tal como está implementado, no aporta confidencialidad real.
- **Agravante:** el mismo bloque de configuración usa `baseUrl: "http://127.0.0.1:8001"` y `wsUrl: "ws://127.0.0.1:8001/ws/auth/"` — apunta a un endpoint de desarrollo local, lo que sugiere que esta rama de código no se probó/revisó como si fuera a producción.
- **Por qué es crítico:** compromete la confidencialidad de credenciales de cualquier usuario que use el flujo de pairing por QR, en cualquier marca que use este mecanismo, con una clave descargable por cualquier persona sin necesidad de acceso al repositorio siquiera.
- **Recomendación:** el descifrado debe ocurrir siempre en el backend; el TV nunca debe tener la clave privada. Eliminar el archivo de `public/` y del historial de git (purga con BFG/git-filter-repo dado que ya fue commiteado), rotar la clave inmediatamente, y agregar una regla de pre-commit/CI que bloquee cualquier `.pem`/`.key`/`private_key*` bajo `public/`.

### 1.2 Página VOD reconstruye el layout DOM completo en cada tecla (sin cache), a diferencia de Inicio
- **Archivo:** `src/hooks/useVodPageTvNav.js` (líneas 112-226) llama `buildVodBouquetRows()` (`src/utils/vodTvGrid.js:22-34`) en cada pulsación LEFT/RIGHT/UP/DOWN, sin ningún mecanismo de cache. Esa función hace `querySelectorAll` + `getComputedStyle`/`getBoundingClientRect` por cada tarjeta candidata para reconstruir filas visuales.
- **Contraste:** el muro de Inicio (`src/utils/inicioBouquetTvGrid.js`) sí implementa un `WeakMap` que cachea el resultado y solo invalida cuando cambia el layout real — exactamente el patrón que falta en VOD.
- **Por qué es crítico:** en una página con varias categorías y muchas tarjetas, cada pulsación de flecha recalcula todo el DOM de forma síncrona dentro del handler de teclado — el lag resultante es perceptible de inmediato en hardware 2019 y es precisamente el patrón de rendimiento que ya se corrigió en Inicio pero no se replicó aquí.
- **Recomendación:** portar el mismo patrón `WeakMap` de `inicioBouquetTvGrid.js` a `vodTvGrid.js`. Es una corrección barata y ya probada en el propio código.

### 1.3 `ConfirmModal` sin foco inicial ni navegación izquierda/derecha entre sus botones
- **Archivo:** `src/components/ConfirmModal.jsx` (líneas 14-72). El componente solo escucha BACK/Escape; no hace `focus()` al abrir, no tiene `autoFocus`, y los botones Confirmar/Cancelar no responden a LEFT/RIGHT.
- **Por qué es crítico:** se usa en flujos sensibles (logout, salir de la app, confirmaciones del gate parental). Con el control remoto, al abrirse el modal el foco del documento sigue en el elemento que quedó oculto detrás del overlay — si el usuario presiona ENTER pensando que confirma/cancela, en realidad reactiva el control oculto. Solo BACK funciona de forma confiable.
- **Recomendación:** agregar `useEffect` que enfoque el botón por defecto al montar, y un manejador LEFT/RIGHT simple entre los dos botones (patrón ya usado correctamente en `MessageModal.jsx`).

### 1.4 Pantallas completas sin ninguna navegación por D-pad: Catchup, Configuración parental, Perfil
- **Archivos:** `src/pages/CatchupPage.jsx`, `ParentalSettingsPage.jsx`, `ProfilePage.jsx` — solo usan `tabIndex` nativo del navegador, que no responde a las flechas del control remoto (solo a `Tab`, que no existe en un mando TV).
- **Por qué es crítico:** en estas tres pantallas el usuario con control remoto simplemente no puede mover el foco entre elementos. Son pantallas completas inutilizables sin teclado/mouse conectado.
- **Recomendación:** implementar un hook `useXTvNav` dedicado para cada una siguiendo el patrón ya maduro de `useEpgCardsTvNav.js` (grid lógico por fila/columna con `getElementById`, sin barrido de DOM).

### 1.5 Sin overlay de error visible en la ruta real de reproducción — pantalla negra congelada ante cualquier fallo
- **Archivos:** `src/components/player/PlayerHud.jsx` (nunca lee `state.error`), `src/components/player/PlayerContainer.jsx` (sí renderiza el error, pero no está importado por ningún otro archivo — código muerto), `src/pages/HomePage.jsx` (monta `PlayerHud`, no `PlayerContainer`).
- **Problema:** ante un error real de reproducción (red, DRM, códec no soportado), `handleError` en `PlayerContext.jsx` apaga el spinner de carga pero no hay ningún componente que muestre el error en el árbol que realmente se monta. El usuario ve pantalla negra sin mensaje, sin opción de reintentar, y sin ningún log visible fuera de las devtools.
- **Por qué es crítico:** contradice directamente lo que el informe previo daba por cerrado ("overlay de errores visibles"); en la práctica el trabajo existe pero quedó desconectado del flujo real.
- **Recomendación:** mover la lógica de error de `PlayerContainer.jsx` a `PlayerHud.jsx` (o resucitar y montar `PlayerContainer` en el lugar correcto), con acción de reintento.

---

## 2. ALTOS

### Seguridad / build
- **`azcopy.exe` (~60MB) sigue trackeado en git** — el informe previo lo daba por "removido del tracking", pero `git ls-files` lo confirma presente ahora mismo; nunca hubo un commit de borrado. `.gitignore` lo excluye para el futuro, pero no lo saca del working tree ni del historial actual. *(`scripts/*`, raíz del repo)*
- **`video.js` fijado en `6.6.3`** (2018, EOL) — sin parches de seguridad desde hace años; restricción real por compatibilidad con Chromium 53 de TVs 2019, pero el riesgo permanece abierto y debe planificarse su reemplazo. *(`package.json`)*
- **Plugin vendorizado `videojs-hlsjs-plugin.js` (242KB minificado) embebe su propia copia interna de hls.js**, independiente de la versión declarada en `package.json`. Subir `hls.js` en npm no garantiza que el bundle que realmente usan los TVs se actualice. *(`src/player/vendor/`)*
- **Vendor minificado no excluido del linter** — `eslint.config.js` solo ignora `dist`, no `src/player/vendor/**`, ensuciando cualquier corrida de lint con ruido de código de terceros minificado.
- **`scripts/buildAll.js` no ejecuta la retranspilación Babel legacy** — invoca `vite build` vía `execSync` directamente en vez de los scripts `pnpm run build:<marca>`, saltándose los hooks `postbuild:*` que sí aplican `babel-legacy-dist.js`. El build masivo (`build:all`) y el build individual por marca no dan la misma garantía de compatibilidad ES5.
- **Sin tests unitarios ni de integración** — cero archivos `*.test.js`/`*.spec.js`, sin Vitest/Jest configurado, sin script `test` en `package.json`.
- **Sin error reporting remoto** — `src/utils/logger.js` solo hace `console.error`; en producción, en un TV sin devtools accesibles, cualquier error queda invisible para soporte.

### Player / reproducción
- **Sin reintento/backoff a nivel de aplicación ante errores fatales de streaming** — existe un `HlsPlaybackController.js` con lógica de retry ya escrita, pero no está importado por ningún otro archivo (código muerto); el motor realmente en uso (`WebEngine.js`) no reintenta nada ante error fatal. Combinado con el punto 1.5, un corte de red transitorio deja la pantalla congelada sin recuperación.

### Navegación TV
- **`FocusManager`/`NavigationRouter` existen pero no están integrados** — `App.jsx` arranca el router, pero ningún componente de la app llama `navigationRouter.register(...)` ni `focusManager.push/pop`. En la práctica es un listener global adicional (16º) que procesa cada tecla sin producir ningún efecto — overhead sin beneficio, mientras los 15+ listeners independientes originales de cada pantalla siguen intactos y coexistiendo.
- **Hasta 3 listeners de `keydown` compitiendo simultáneamente durante reproducción** (`PlayerHud`, `usePlayerChannelZapping`, `usePlayerHudTvNavigation`), con `stopImmediatePropagation()` en uno de ellos que puede bloquear silenciosamente a los otros según orden de montaje.
- **`EpgCards.jsx` corre un `setInterval(1000ms)` en el componente raíz de la tabla completa**, re-renderizando todas las filas/canales cada segundo mientras el usuario navega la grilla.
- **`useChunkedList.js` es solo "chunking" de pintado, no virtualización real** — una vez pintados, todos los ítems permanecen montados en el DOM de forma permanente; en catálogos grandes de VOD/EPG el árbol completo queda vivo, penalizando memoria y layout en hardware 2019.

### Datos / rendimiento
- **`brandConfig.EPG.rowsOnInit` es configuración muerta** — existe en `brands.js` (pensada para limitar la carga inicial, p. ej. a 7 canales) pero el código de `preloadStore.js` siempre pasa `maxChannels: total` (todos los canales), ignorándola. El EPG completo se descarga secuencialmente sin importar lo que la marca configuró.
- **Carga de EPG 100% secuencial, canal por canal** (`epgService.js`) — sin pool de concurrencia; se agregó un `yieldToMain(8ms)` entre canales que mejora la respuesta de UI pero alarga aún más el tiempo total de carga.
- **`prepareRecorded()` de catchup con complejidad O(T×G×E) y un doble recorrido redundante** — por cada tarea de grabación recorre grupos×eventos dos veces (una para ubicar el grupo, otra idéntica para releer el evento), pudiendo resolverse con un único `Map` construido una vez.

---

## 3. MEDIOS

### Seguridad
- **`scripts/check-brand-secrets.js` tiene cobertura muy limitada** — solo analiza un archivo (`brands.js`) y un único patrón (`token: "..."`); no detecta `apiKey`, `secret`, contraseñas, ni archivos `.pem`/`.key` como el del hallazgo 1.1. Solo corre como hook local de build, no hay CI que lo garantice en cada push.
- **Control parental 100% cliente, persistido sin firma en `localStorage`** — el hash del PIN en sí está bien implementado (PBKDF2-SHA256 + salt + comparación de tiempo constante), pero el estado de desbloqueo (`unlockUntilMs`) puede editarse directamente desde devtools para saltarse el bloqueo, al no haber ninguna verificación de integridad del registro completo.
- **`getSecretKey()` no falla de forma segura en producción** — si falta `VITE_SECRET_KEY` en un build de producción, la función retorna cadena vacía en vez de abortar el arranque; `CryptoJS.AES.encrypt` no lanza excepción con passphrase vacía, así que la sesión terminaría "cifrada" con una clave prácticamente nula sin que nadie lo note.
- **Contraseña hasheada con MD5 + salt estático hacia el backend Panaccess** (protocolo fijo del proveedor externo, mitigado por TLS en tránsito — riesgo aceptado, no corregible solo desde el cliente).
- **Endpoints de backend de login social sobre HTTP sin cifrar** en algunos brand configs (`backendBaseUrl`) — a confirmar con el equipo si son placeholders de desarrollo o dominios reales de producción.

### Player
- **DRM (Samsung/LG) no está conectado a ningún flujo real de reproducción** — todo el trabajo de robustecimiento de licencias DRM existe en los engines pero ningún caller de la app (canales, VOD, catchup) pasa hoy un `drmConfig` poblado.
- **Contexto del player no memoizado** — el `value` del `PlayerContext` se reconstruye en cada render y las acciones no usan `useCallback`, provocando que `PlayerHud` (1200+ líneas) se re-renderice ~4 veces por segundo durante reproducción por el tick de tiempo, independiente de `React.memo`.
- **Interpolación XML sin escapar en licencias DRM de LG** — actualmente inactivo (ver punto anterior), pero debe corregirse antes de activar DRM real.

### Datos / arquitectura
- **Mutación directa de streams y VODs en los servicios** (`tvDataService.js`, `vodService.js`) — se sigue mutando el objeto original con `.forEach()`/`Object.assign()` en vez de retornar copias con `.map()`, violando la inmutabilidad esperada por Zustand.
- **4 flujos de precarga (EPG, VOD, Ads, Catchup) corren en paralelo al arrancar sesión sin escalonamiento**, compitiendo por CPU/red simultáneamente justo en el momento más sensible (arranque en TV).
- **Catchup se precarga de forma eager en el arranque** en vez de cargarse de forma perezosa al entrar a la sección, pese a que la recomendación de hacerlo perezoso ya estaba planteada.
- **Worker de EPG sin `terminate()`** — vive como singleton de módulo durante toda la vida de la app.
- **Inconsistencia de tipos entre el worker de EPG (números) y su fallback interno** (objetos `{valueOf}`) cuando el worker falla silenciosamente — el archivo huérfano `epgNormalize.worker.js` (con el mismo bug, agravado con `DataCloneError`) no se usa en producción pero sigue en el repo.
- **Infraestructura de React Query prácticamente sin uso real** — hooks `useVodQuery`/`useAdsQuery` existen y están bien configurados pero ningún componente los importa; toda la carga real pasa por Zustand. Es peso de bundle y un `Provider` extra sin beneficio actual.

### Build / calidad
- **`app_reloaded_from_error` (sessionStorage) nunca se limpia tras un arranque exitoso** — un segundo error de chunk más tarde en la misma sesión ya no dispara el auto-reload de recuperación.
- **`password.trim()` en el login trunca contraseñas legítimas con espacios** — debería aplicarse solo a `username`.
- **Patrón de `eslint-disable` para dependencias de hooks extendido en varios archivos** (`PlayerHud.jsx`, `Sidebar.jsx`, `HomePage.jsx`, `InactivityHost.jsx`, `PlayerContext.jsx`), no aislado a un único punto.
- **Bootstrap parcial en el bundle (~50KB)** — subconjunto curado pero no migrado a un sistema modular más liviano.
- **`packaging/tizen/config.xml` es una plantilla con placeholders sin completar**, y el `appinfo.json` de ejemplo de webOS carece del campo `resolution`, relevante para hardware 2019.

### Navegación TV
- **Magic numbers de timeout (80/120/280/300ms) repetidos en múltiples hooks** para restaurar foco, en vez de un mecanismo reactivo centralizado.
- **Polling con `requestAnimationFrame` (20-48 intentos) para foco inicial**, vivo en al menos 6 archivos distintos, en vez de reaccionar al estado real de carga de datos.
- **`shouldDeferHomeShellNavigation()` ejecuta hasta 13 `document.querySelector` secuenciales en cada tecla**, en casi todos los hooks de navegación, para simular lo que un lock de navegación centralizado resolvería con una simple lectura de estado.
- **Lógica de "visibilidad de elemento" triplicada** en tres archivos distintos (`homeShellNavigation.js`, `homeShellLastContentFocus.js`, `vodShellLastFocus.js`) con riesgo de criterios inconsistentes entre módulos.

---

## 4. BAJOS

- **`node-forge@1.0.0`** en `package.json` — versión anterior a fixes de seguridad conocidos, pero no se encontró ningún uso real en el código propio (posible dependencia huérfana a eliminar).
- **`epgNormalize.worker.js`** — código muerto confirmado (0 imports en todo el repo), con el bug de `DataCloneError` documentado; candidato directo a eliminación.
- **`src/cv/`** — nombre de directorio poco intuitivo (namespace interno de la API Panaccess); conviene un `README.md` explicativo o renombrar.
- **SVG inline extenso en `Sidebar.jsx`** (773 líneas, ~8 bloques `<svg>` inline) — candidato a extraer a componentes de íconos reutilizables.
- **`error.txt` en la raíz del repo** — log de build truncado commiteado por accidente, sin información sensible; limpiar y añadir `*.txt` de build al `.gitignore`.
- **`i18n.t` usado fuera de contexto reactivo en `ErrorBoundary.jsx`** — limitación razonable por ser un componente de clase, impacto bajo por ser una pantalla de fallback poco frecuente.
- **`@types/react`/`@types/react-dom` en versión 19 mientras el runtime usa React 18** — inconsistencia de dependencias de desarrollo sin impacto funcional (no hay TypeScript en el proyecto).
- **Client IDs de Google/Facebook "hardcodeados" en `brands.js`** — no es un problema real de seguridad (estos IDs están diseñados para ser públicos); se documenta para que no se reporte como falso positivo en el futuro.

---

## 5. Hallazgos previos verificados como YA RESUELTOS

Para que el equipo no re-trabaje lo que ya está bien:

- Tokens de API movidos fuera del código fuente, resueltos en runtime vía `VITE_BRAND_TOKEN_*` + `resolveBrandToken.js`.
- Cifrado AES de `sessionId`/`username`/`password` en `localStorage`, con migración automática de valores legacy en texto plano (con la salvedad del punto 3 de la sección MEDIOS sobre clave vacía).
- Targets de transpilación bajados a Chrome 53/63 con verificación post-build (`check-es-compat.js`) y doble retranspilación Babel para chunks legacy.
- Bootstrap condicional de SDKs nativos (`webapis.js`/`webOSTV.js`) y detección de plataforma por APIs nativas con prioridad sobre el UserAgent.
- Adaptadores nativos Samsung/LG: try-catch en llamadas AVPlay, cleanup de listeners, liberación de pipeline de video LG, serialización de cola DRM con timeout, timeout de 10s en inicialización de SDK nativo.
- Comparación de tracks del reproductor sin `JSON.stringify` (comparación estructural por IDs).
- Emojis reemplazados por íconos SVG en el login (renderizan de forma fiable en Tizen/webOS 2019).
- `dist/` correctamente excluido de git.
- Sidebar y muro de Inicio: cache de layout con `WeakMap`/refs, ya no recalculan DOM en cada tecla.
- Sistema de foco unificado (`TvFocusRing`) sin memory leaks, con `scroll-behavior` instantáneo forzado en modo TV y transición de sidebar en 0ms.
- `EpgCards` ya tiene navegación D-pad real por grid lógico (el plan previo lo daba por "roto"; está desactualizado en ese punto).
- `SearchPage` con hook de navegación TV dedicado y debounce correcto (sin recomputar en cada tecla).
- Mutación de `parameters` en `panaccessService.js` reevaluada: es reasignación local vía spread, no afecta al objeto del llamador (severidad corregida a la baja respecto al informe original).

---

## 6. Recomendaciones

### Generales / de proceso
Antes de seguir sumando funcionalidades, conviene establecer una base mínima de calidad que hoy no existe: un framework de pruebas (Vitest, dado que ya usan Vite) cubriendo al menos las funciones puras de mayor riesgo (preparación de catchup/VOD, normalización de EPG, resolución de engine de reproducción), y un pipeline de CI que corra lint, el chequeo de secretos y esas pruebas en cada pull request — hoy `check-brand-secrets.js` y `check-es-compat.js` solo protegen si el desarrollador construye localmente. También vale la pena instrumentar un servicio de reporte de errores remoto (Sentry u otro) antes de cualquier despliegue a hardware real, porque hoy un fallo en un TV de un usuario es completamente invisible para el equipo.

En cuanto a arquitectura, el proyecto tiene piezas bien diseñadas que están construidas pero no conectadas: `FocusManager`/`NavigationRouter`, el hook de retry de streaming (`HlsPlaybackController`), el overlay de error del player (`PlayerContainer`), y la infraestructura de React Query. Antes de escribir código nuevo en esas áreas, conviene decidir explícitamente para cada uno: se integra ahora, o se elimina para no confundir a quien lea el repo después. Dejar código "fantasma" a medio camino es, en la práctica, peor que no tenerlo, porque induce a pensar que un problema ya está resuelto cuando no lo está (como pasó con el overlay de errores).

Para la validación en hardware real, ningún hallazgo de esta auditoría relacionado con DRM, decodificación nativa o latencia percibida de D-pad puede confirmarse completamente desde un navegador de escritorio. Se recomienda conseguir al menos un Samsung Tizen 2019 (Tizen 4/5) y un LG webOS 2019 (webOS 4.5) reales, o sus emuladores oficiales, y definir un checklist de humo (arranque, zapping de 20 canales, reproducción con DRM real, 20 pulsaciones seguidas de D-pad sin frames largos) antes de cada release.

### Específicas por área

En seguridad, la prioridad inmediata es sacar la clave privada RSA del cliente y mover ese descifrado al backend; en paralelo, conviene ampliar el script de detección de secretos para que cubra todo `src/` y `public/` (no solo un archivo y un patrón) y agregarlo como gate de CI, no solo de build local. También vale la pena hacer que el cifrado de sesión falle de forma segura (abortar el arranque) si falta la clave secreta en producción, en vez de continuar con una clave vacía.

En el reproductor, conviene priorizar reconectar el overlay de error y el mecanismo de retry que ya existen en el código pero no están en la ruta real — es la corrección de mayor impacto por menor esfuerzo de toda esta auditoría, porque el código ya fue escrito, solo falta conectarlo. Migrar de video.js 6.x es una decisión de mayor plazo que debe ir acompañada de pruebas de compatibilidad en el hardware real de 2019 antes de tocarla.

En navegación TV, dado que ya existe un patrón que funciona bien (cache `WeakMap` en Inicio, grid lógico en EpgCards), la recomendación concreta es replicar exactamente esos dos patrones en VOD y en las tres pantallas sin cobertura (Catchup, Parental, Perfil) en vez de invertir primero en terminar de integrar `FocusManager`/`NavigationRouter` desde cero — es más barato y de menor riesgo de regresión completar lo que ya funciona que rediseñar la orquestación central ahora mismo. Una vez cerradas esas brechas, recién ahí conviene decidir si se invierte en integrar el router centralizado o se retira.

En rendimiento de datos, el cambio de mayor impacto por menor esfuerzo es usar `brandConfig.EPG.rowsOnInit` (ya existe en la configuración de cada marca, solo no se lee) para acotar la carga inicial de EPG, y escalonar los cuatro flujos de precarga (EPG/VOD/Ads/Catchup) en el arranque en vez de lanzarlos todos en paralelo — ambos cambios no requieren rediseñar el store, solo ajustar los puntos donde se invocan.

Por último, en limpieza de código, conviene decidir en un solo barrido qué hacer con los módulos huérfanos identificados (`epgNormalize.worker.js`, `PlayerContainer.jsx`, `HlsPlaybackController.js`, hooks de React Query sin uso, `node-forge`): o se integran o se eliminan, documentando la decisión, para que la próxima auditoría no tenga que volver a redescubrirlos.

---

*Documento generado mediante verificación directa del código fuente el 2026-07-20. No reemplaza una validación en hardware real (Samsung Tizen 2019 / LG webOS 2019), que sigue siendo necesaria para los hallazgos de reproducción nativa, DRM y latencia de D-pad.*
