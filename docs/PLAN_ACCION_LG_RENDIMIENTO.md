# Plan de acción: rendimiento y navegación en LG webOS (cableatlantico)

Borrador para ajustar. Basado en las pruebas del 29-30 de octubre de 2026 en un LG 49UN7310PSC (webOS 5, Chromium 68), marca `cableatlantico`, app servida por HTTP desde un PC de la LAN. Los IDs usan el prefijo `LG-` para no chocar con los `H-xx` de las auditorías.

## 1. Resumen

La app funciona (login, Inicio, Guía, Catchup, Buscador, Mi cuenta, reproducción en vivo), pero en un TV de 2020 tiene cuatro problemas que explican casi todo lo que se siente lento o roto:

1. **El hilo principal está saturado.** Con un canal reproduciéndose va al ~100 % (GC 27 %, descifrado por software 10 %, React el resto). Todo lo demás (teclas, cambio de canal) paga ese costo.
2. **Se monta todo de golpe**, sin virtualizar: 230 tarjetas en Inicio, 422 en Catchup, 816 en la Guía, entre 3 000 y 10 000 nodos DOM.
3. **Catchup se cuelga hasta 85 s** la primera vez que se entra en una sesión que pasó por el preload.
4. **Integración incompleta con webOS**: el Back lo maneja el sistema (cierra la app), falta `webOSTV.js`, y la app corre sobre HTTP (sin WebCrypto).

## 2. Línea base medida

| Métrica | Hoy | Objetivo |
|---|---|---|
| Arranque en frío hasta Home | 52–76 s (preload ~50 s) | ≤ 25 s; sin segundo preload al restaurar la ruta |
| Inicio: tecla → pantalla (mediana) | 73 ms | ≤ 100 ms (mantener) |
| Guía: tecla → pantalla | 300–360 ms | ≤ 120 ms |
| Guía: tiempo hasta listo | 5.1–5.4 s | ≤ 2 s |
| Catchup: primera entrada tras preload | 84 s hasta > 120 s | ≤ 3 s |
| Catchup: entrada en sesión tibia | 4–5.4 s (hilo ocupado 5–10 s) | ≤ 2 s |
| Evento de Catchup tras "Reproducir" | queda pausado en t=0 | arranca solo en ≤ 4 s |
| Player: hilo principal ocupado en reproducción estable | ~100 % | ≤ 40 % |
| Player: tecla → pantalla en el HUD | mediana 415 ms, máx. 1.5 s (arranque); 63 ms con picos de 490 ms (estable) | p90 ≤ 150 ms |
| Abrir un canal desde Inicio | 8–16 s (una vez no reprodujo en 40 s) | p90 ≤ 6 s |
| Cambiar de canal (CH±) | 5.3–7.9 s en buen momento; 8–36 s con el hilo saturado | p90 ≤ 5 s |
| Cortes en los primeros segundos | 0 (tras el ABR) | 0 |
| Back en el player | cierra la app; al volver sigue el player | cierra el player; en Inicio sale de la app |
| Errores JS al cargar | 1 (`webOSTV.js`) | 0 |

## 3. Hallazgos y soluciones

Leyenda: severidad **Crítica / Alta / Media / Baja**; esfuerzo **S** (< ½ día), **M** (1–2 días), **L** (3 o más). "Confirmado" = reproducido y medido; "Hipótesis" = indicios fuertes, falta confirmar.

### LG-01 · El player re-dibuja todo Inicio varias veces por segundo — Crítica, M
- **Evidencia:** en reproducción estable el hilo está ocupado casi el 100 %; el perfil de CPU de 10 s muestra GC 3.1 s (27 %), React 3.6–4 s y `ChannelCard` (render) 1.6 s, aunque nadie navega.
- **Causa (hipótesis fuerte):** `PlayerProvider` arma `value` como objeto nuevo en cada render ([PlayerContext.jsx:896](../src/contexts/PlayerContext.jsx)) y `handleTime` ([L260](../src/contexts/PlayerContext.jsx)) llama `setState` con cada `timeupdate` (~4 por segundo). Lo consumen `HomePage`, `BouquetPage`, `HomeShellContent`, `EpgCards`, `CatchupPage`, `SearchPage`, etc., que son padres de las tarjetas. Además cada `ChannelCard` hace 12 suscripciones de zustand con `useParental()` ([BouquetLayouts.jsx:192](../src/components/bouquet/BouquetLayouts.jsx)).
- **Solución:**
  1. Separar el contexto en dos: acciones estables (`play`, `close`, `pause`… con `useCallback`/`useMemo`) y estado que cambia (`currentTime`, `liveSecondsLate`). Los que solo necesitan `play` no se suscriben al estado.
  2. El tiempo de reproducción solo debe llegar a quien lo muestra (HUD, barra): `useSyncExternalStore` o un selector.
  3. `React.memo` en `ChannelCard` y reemplazar `useParental()` por un solo selector (`isChannelBlocked`).
  4. Mientras el player está maximizado, no renderizar Inicio debajo (o ocultarlo con `display:none` sin desmontar el estado).
- **Confirmar antes:** contar renders de `ChannelCard` por segundo (React Profiler o contador temporal).
- **Verificación:** hilo ocupado en reproducción estable ≤ 40 % (`Performance.getMetrics`); perfil sin `PH`/React dominante; TTFF de zapping mejora.

### LG-02 · Catchup se cuelga al entrar — Crítica, M
- **Evidencia (confirmado):** primera entrada tras el preload: 84 s y más de 120 s con el hilo al 100 %; perfil de 85 s con **51 s dentro de `Intl.DateTimeFormat`**. En sesión tibia: 4–5 s. Se montan 422 tarjetas y ~25–38 mil nodos transitorios.
- **Causa:** `fmtCatchupDate` llama `toLocaleDateString` por tarjeta, y eso construye un formateador nuevo cada vez ([catchupEvent.js:68](../packages/core/src/utils/catchupEvent.js)). El rail de Catchup monta todos los grupos a la vez ([ChannelsRailsCatchupLayout.jsx](../src/components/catchup/ChannelsRailsCatchupLayout.jsx)); `contentVisibility: 'auto'` no existe en Chromium 68. Además el filtro de visibilidad del foco (`requireOnScreen`) y `getBoundingClientRect` suman 0.3–0.9 s.
- **No se entiende del todo:** por qué el formateador es tan lento solo en esas sesiones (3 ms vs. > 100 ms por llamada).
- **Solución:**
  1. Un `Intl.DateTimeFormat` por idioma, creado una vez y reutilizado (también en `SearchPage.jsx:57` y `osmsFormat.js`).
  2. Renderizar los rieles de forma progresiva: primeros 4–6 grupos y el resto por tandas (hay `useChunkedList` en [src/hooks](../src/hooks/useChunkedList.js)); el foco inicial en la primera tarjeta.
  3. Revisar si la página dispara más de una carga o re-renders por cada actualización de `progress` del store.
- **Verificación:** primera entrada tras preload ≤ 3 s, hilo ocupado ≤ 2 s; repetir el recorrido Inicio → Guía → Catchup con límite de 120 s.

### LG-03 · Back del control cierra la app — Alta, S
- **Evidencia (confirmado con una app de prueba):** por defecto webOS maneja el Back con el historial; en la primera página lanza el Home del TV (en webOS 5 el app queda suspendido, por eso al volver sigue el player). Con `"disableBackHistoryAPI": true` el keydown 461 llega a la página: el player se cierra y la app sigue abierta.
- **Solución:**
  1. Agregar `"disableBackHistoryAPI": true` al `appinfo.json` de cada IPK (el de `webos-nbstreaming/Cable Atlantico`, los demás y el ejemplo de `packaging/webos/README.md`).
  2. Implementar la salida en Inicio: hoy [HomeInputDispatcher.jsx:88](../src/components/home/HomeInputDispatcher.jsx) no consume el Back, y con el flag el usuario ya no podría salir. Usar `webOS.platformBack()` si existe y `window.close()` si no (ver LG-08).
  3. Mantener la pulsación larga de Back para salir.
- **Nota:** la documentación de LG habla de versiones recientes para el flag, pero funcionó en este webOS 5; probar también en otros modelos.
- **Verificación:** Back en player → cierra el player; Back en Inicio → sale; Back en modales y teclado OSD → los cierra.

### LG-04 · Un evento de Catchup arranca pausado — Alta, S–M
- **Evidencia (confirmado dos veces):** tras "Reproducir" el video carga metadatos (768x432) pero queda en `t=0`, `readyState 1`, más de 30 s. El buffer va de 2.0 s a 60 s y la posición actual (0) queda fuera del rango. Con la tecla Play arranca.
- **Causa (hipótesis):** el primer rango de buffer empieza después de 0 y hls.js no salta ese hueco inicial.
- **Solución:** en VOD y catchup, al primer `FRAG_BUFFERED`, si `currentTime < buffered.start(0)`, mover `currentTime` al inicio del buffer y llamar `play()`; o fijar `startPosition` según el primer fragmento. Con test unitario.
- **Verificación:** el evento arranca solo en ≤ 4 s, sin pulsar Play.

### LG-05 · Sin WebCrypto y descifrado en el hilo principal — Alta, M
- **Evidencia (confirmado):** en HTTP `crypto.subtle` no existe; sin el fallback ningún canal reproducía. Con el fallback (ya commiteado) el descifrado de segmentos corre por software en el hilo principal (~10–14 % de CPU).
- **Solución:** servir por **HTTPS** con certificado que el TV acepte, o **empaquetar el IPK con la app dentro** (`file://`, tarea 6 del plan). Esto devuelve el descifrado al hardware y quita la descarga de ~1.8 MB en cada arranque. Antes de adoptar `file://` hay que probar si el BrowserRouter y las rutas `/assets` funcionan, y si webOS 5 lo trata como contexto seguro.
- **Prueba de apoyo:** repetir el benchmark de TTFF en HTTPS (ya hecho: ~5.3 s al cambiar de canal) y en `file://`.
- **Verificación:** `isSecureContext === true`, `crypto.subtle` definido, hilo ≤ 40 %.

### LG-06 · Preload de ~50 s y doble preload al restaurar la ruta — Alta, M
- **Evidencia (confirmado):** arranque en frío 52–76 s hasta Inicio. Si la app abre directo en `/home/catchup` (última ruta guardada) salta el preload (listo a los 10 s) y al ir luego a Inicio, `PreloadGate required="epg"` redirige a `/preload` y vuelve a esperar ~50 s.
- **Solución:**
  1. Al restaurar la última ruta ([navigation.js:53](../packages/core/src/utils/navigation.js), `useAppLifecycle.js`), exigir el mismo preload que exigiría esa ruta, o precargar la EPG en segundo plano.
  2. Reducir el preload: usar la caché persistente de EPG (ya existe) cuando es reciente, normalizar en el worker, no bloquear el Home por datos que no se ven (VOD, anuncios).
  3. Revisar `prepareRecorded` (O(T·G·E) según la auditoría).
- **Verificación:** Home en ≤ 25 s en frío; ningún `/preload` por navegar entre secciones.

### LG-07 · La Guía de canales es lenta — Alta, M
- **Evidencia (confirmado):** 300–360 ms por tecla en todas las pulsaciones; 816 tarjetas, 9 349 nodos; 5.1–5.4 s hasta estar lista; el hilo trabaja 6–8 s al entrar.
- **Solución:** virtualizar filas y columnas (ventana alrededor del foco con `useChunkedList`/`computeVisibleWindow`), reducir nodos por tarjeta y un solo ticker de reloj.
- **Verificación:** ≤ 120 ms por tecla y ≤ 2 s para abrir.

### LG-08 · Falta `webOSTV.js` — Media, S
- **Evidencia (confirmado):** `GET /webOSTV.js` devuelve el `index.html` (200, `text/html`): `SyntaxError: Unexpected token <` en cada carga y `window.webOS` indefinido.
- **Solución:** copiar `webOSTV.js` del SDK de LG junto al `index.html` del paquete (sin commitearlo, por licencia) y proteger `public/tv-platform-bootstrap.js` para ignorar respuestas que no sean JavaScript. Es requisito de LG-03 (`webOS.platformBack()`).
- **Verificación:** 0 errores JS al arrancar; `window.webOS` definido.

### LG-09 · Textos pegados: "Ahora13:50", "112:40 - 14:35115 min" — Media, S
- **Evidencia (confirmado):** se ve en el subheader de Inicio y en el modal de Catchup.
- **Causa (hipótesis):** `gap` en flexbox no existe en Chromium 68 (llegó en 84); hay 62 usos de `gap:` en los estilos.
- **Solución:** sustituir `gap` por márgenes en los contenedores flex afectados, o un fallback con `@supports`.
- **Verificación:** captura de pantalla de Inicio, Catchup y HUD sin textos pegados.

### LG-10 · El HUD no siempre se autooculta — Baja, S
- **Evidencia:** con el foco en el cuerpo (no en un botón) el HUD se quedó visible más de 10 s (autoocultado en 6 s). Causa sin investigar.
- **Solución:** reiniciar el temporizador solo con interacción real; revisar `wakeHud` y `hudAutoHideMs`.

### LG-11 · Cambio de canal y apertura lentos (5–36 s) — Alta, L
- **Evidencia (confirmado):** desglose de un cambio de canal: 0.7 s hasta la primera petición, 0.9 s de master y nivel, 1.6 s bajando un segmento de 10 s y 2.7 MB, ~3.5 s de descifrado, demux y buffer, +0.8 s hasta `playing`. Con el hilo saturado los tiempos se multiplican (hasta 36 s).
- **Solución, por orden de efecto:**
  1. LG-01 y LG-05: liberan el hilo y el descifrado.
  2. **Operador:** segmentos de 4–6 s en lugar de 10 s (mayor efecto, sin tocar la app).
  3. Descargar el primer segmento por streaming (`fetch` + `progressive` de hls.js) para solapar descarga y demux.
  4. Reutilizar la instancia de hls.js y el `<video>` al cambiar de canal en lugar de `player.reset()`.
  5. Ocultar o desmontar Inicio al abrir el player.
- **Ya hecho:** ABR de arranque (sin cortes), caché y precarga del master (ganancia no demostrada).
- **Verificación:** `bench.mjs` con 3 aperturas y 4 cambios de canal; p90 ≤ 6 s.

### LG-12 · Seguridad y datos sensibles — Media, M
- Usuario y contraseña en `localStorage` cifrados con una clave que viaja en el bundle (protege poco), y tokens en la URL de la EPG (visto en la sesión).
- PIN parental sin límite de intentos y `actionUrl` de anuncios sin validar esquema (de las auditorías previas, `AUDITORIA_2026-07-28.md`).
- **Solución:** guardar solo el token de sesión (no la contraseña) y cifrado con la clave del dispositivo; límite de intentos con espera creciente; validar `https:`/`http:` en `actionUrl`.
- Pasar `security-and-hardening` antes de producción.

### LG-13 · Configuración de marca por revisar — Media, S
- Los commits de `intv.js` vacían `deviceSession.baseUrl/wsUrl` y la URL de cambio de contraseña, con `deviceSession.enabled: true`; `cableatlantico.js` vacía `udid`, y activa `qrRegister`/`forgotPassword` sin URL.
- **Acción:** confirmar si es intencional; si no, restaurar los valores o desactivar las funciones.

### LG-14 · Imágenes 404 del CDN — Baja, S
- Varias portadas de Catchup (`cdn1.cabledelancer.com/Imagenes/…`) devuelven 404 y la app las cubre con el logo. Avisar al operador; en la app, dejar de reintentarlas.

### LG-15 · Timers por tarjeta — Baja, S
- 224 `setInterval` de 1 s activos en Inicio. Son baratos (24 ms por 10 s) pero suman trabajo; un solo ticker compartido y pausa mientras el player está maximizado. La carga en reposo de Inicio es 10–13 %.

### LG-16 · QA repetible y rama — Media, M
- Los scripts de medición (CDP, benchmark, barrido de secciones, perfil de CPU) viven en el scratchpad de la sesión: moverlos a `scripts/tv-qa/` con un README.
- Los 4 tests de Vega (`keyUnwrap.test.js`) fallan por la falta de `@react-native/typescript-config`: arreglar el entorno o excluirlos explícitamente.
- La rama `vega/perfiles-reservas` lleva 302 commits sobre `main` (que no se ha movido desde junio): decidir si el PR va entero o se parte. `gh` no está instalado en esta máquina.

## 4. Orden de ejecución

| Fase | Contenido | Por qué en este orden |
|---|---|---|
| **0. Preparación** (S) | LG-16 (scripts a `scripts/tv-qa/`, tests de Vega), confirmar LG-01 con un contador de renders, repetir la línea base | Sin medición repetible no se puede demostrar ninguna mejora |
| **1. Bloqueantes** (P0) | LG-01, LG-02, LG-03 (+ LG-08), LG-04 | Son lo que más duele: congelamientos, cierre de la app y video que no arranca |
| **2. Base de rendimiento** (P1) | LG-05, LG-06, LG-07 | Dependen de decidir el empaquetado y reducen arranque y Guía |
| **3. Pulido** (P2) | LG-09, LG-10, LG-11 (pasos 3–5), LG-15, LG-14 | Mejoras menores o de mayor riesgo |
| **4. Seguridad y cierre** | LG-12, LG-13, PR, pruebas en otros TVs y marcas | Antes de publicar |

Dependencias: LG-03 necesita LG-08; medir LG-11 después de LG-01 y LG-05; LG-07 y LG-02 reutilizan `useChunkedList`.

## 5. Cómo se verifica cada fase

1. Tests unitarios nuevos por hallazgo (TDD) y `pnpm test` + `eslint` sin errores nuevos.
2. Reconstruir `dist/cableatlantico`, instalar y repetir en el TV: arranque en frío, barrido de secciones, latencia de teclas por pantalla, 3 aperturas y 4 cambios de canal, Back, Catchup con "Reproducir".
3. Comparar contra la tabla de la sección 2 y registrar el resultado antes y después en este documento.

## 6. Riesgos y lo que no está probado

- Un solo TV (webOS 5) y una marca (cableatlantico); falta Samsung Tizen, webOS 4.5 y las demás marcas (el plan de `PLAN_TESTEO_LG_INTV.md` sigue vigente).
- Los tiempos varían mucho entre pasadas (cambio de canal de 8 a 36 s según la carga del hilo): comparar medianas de varias pruebas.
- Son hipótesis aún: LG-01 (re-render por contexto), la lentitud puntual de `Intl.DateTimeFormat`, LG-04 y LG-09.
- `file://` en webOS 5 y el flag `disableBackHistoryAPI` en otros modelos no están probados.
- Cambiar el contexto del player (LG-01) toca muchos consumidores: hacerlo por pasos con tests de regresión del HUD y del zapping.


## 7. Estado de ejecución (30-oct-2026)

Todo se validó en el LG 49UN7310PSC con la marca cableatlantico, servida por HTTP. Tests: 405 de 405 (los 4 de Vega ahora pasan); lint limpio.

| ID | Estado | Resultado medido (antes → después) |
|---|---|---|
| LG-01 | Hecho | Hilo ocupado en reproducción: ~99 % → ~53 % (perfil: libre 1 % → 47 %; GC 3.1 s → 0.5 s por 10 s). Tecla en el HUD: mediana 63 ms con picos de 490 ms y 415 ms al arrancar → 17 ms (p90 75 ms). Contextos nuevos `usePlayerActions` (estable) y `usePlayerSession` (sin tiempo) |
| LG-02 | Hecho | Primera entrada a Catchup tras preload: 84 s (o más de 120 s) → 1.2–2.7 s. Un formateador de fechas por idioma (`intlFormat.js`) y rieles montados por ventana (acotada si la lista se achica); 422 → 60 tarjetas, ~25 000 → ~600 nodos |
| LG-03 | Hecho | Back en el player cierra el player; en una sección sin historial va a Inicio; en Inicio sale (`webOS.platformBack()`/`window.close()`). `disableBackHistoryAPI` en el `appinfo.json` del IPK (v1.0.2, instalado) y en `packaging/webos/README.md` |
| LG-04 | Hecho | Evento de Catchup pausado en t=0 → arranca solo (salta al inicio del buffer) y reproduce a los ~12 s |
| LG-05 | Parcial | El fallback de AES (ya commiteado) funciona en HTTP; el descifrado sigue en el hilo principal (~14 %). El worker de hls.js se probó dos veces sin efecto y se retiró. La solución es HTTPS en producción (o `file://`, que exige HashRouter y rutas relativas: no se hizo). En HTTPS el cambio de canal midió ~5.3 s |
| LG-06 | Parcial | Pool deslizante de 6 pedidos en la EPG (antes tandas de 5 que esperaban al más lento) y EPG en segundo plano si la app abre en una ruta sin preload. El preload sigue siendo de 44 a 128 s según la red del momento: el hilo está ~63 % ocupado y el pool rinde ~6 pedidos/s |
| LG-07 | Hecho | Guía: 300–360 ms por tecla → 75 ms; 5.1–5.4 s → 1.3–4.0 s hasta estar lista; 816 → 44 tarjetas |
| LG-08 | Hecho | 0 errores JS al cargar. El bootstrap no carga `webOSTV.js` si el servidor devuelve HTML y reconoce el UA real de LG (`Web0S`). Falta copiar `webOSTV.js` del SDK al paquete para tener `webOS.platformBack()` |
| LG-09 | Hecho | Confirmado: `gap` en flexbox no existe en Chromium 68. 28 reglas pasaron a los mixins `flex-gap-*` y un test impide volver a usar `gap` con `display:flex` |
| LG-10 | No era un defecto | El HUD se autooculta ~6 s después de empezar a reproducir (se queda mientras carga, a propósito). Sí había otro fallo, corregido: con el HUD oculto el foco quedaba en "Volver" y **OK cerraba el player a ciegas**; ahora OK muestra el HUD |
| LG-11 | Parcial | Home oculto bajo el player (primero `display:none`, luego `visibility:hidden`; ver sección 8), precarga del master, ABR de arranque. Abrir un canal 8–11 s (antes 8–16 s) y cambiar de canal 6–7 s (antes 5–8 s, con picos de 34 s cuando el hilo está ocupado por cargas en segundo plano). Pendiente: segmentos más cortos del operador, descargar el primer segmento por streaming y reutilizar la instancia de hls.js |
| LG-12 | Parcial | Bloqueo del PIN tras 5 fallos (60 s, el doble por racha, tope 15 min; en memoria) con aviso "Demasiados intentos. Espera N s" en los modales de web y Vega, y `actionUrl` de anuncios solo http(s). Pendiente: guardar la sesión sin la contraseña y límite persistente |
| LG-13 | Sin cambios | No es un fallo: con `deviceSession.baseUrl` vacío `isDeviceSessionEnabled` da falso y la función queda desactivada sin errores. Confirmar si es lo que se quiere |
| LG-14 | Sin cambios | Las imágenes 404 son del CDN del operador; la app muestra el logo. Avisar al operador |
| LG-15 | Descartado | Los 224 timers por tarjeta consumen 13–24 ms por cada 10 s (miden poco); la carga en reposo de Inicio bajó a ~10 % |
| LG-16 | Hecho | Scripts de medición en `scripts/tv-qa/` con README; tests de Vega arreglados (alias del SDK y `tsconfigRaw`). La rama sigue con 302 commits sobre `main` y `gh` sigue sin estar instalado |


## 8. Segunda revisión en el TV (30-oct-2026)

| Tema | Causa | Cambio | Resultado en el TV |
|---|---|---|---|
| Home lento tras cerrar el player | Con `display:none` el Home (~3 500 nodos) recalculaba estilo y layout al volver; además video.js mantenía vivo el bucle del SeekBar (`getBoundingClientRect` por frame) y `EpgReminderHost` re-renderizaba 4 veces por segundo sin recordatorios | `visibility:hidden` en `.home-shell-ui--hidden`; `controlBar:false` (y sin botón grande, spinner ni póster) en video.js; el host de recordatorios solo corre con recordatorios, cada 1 s | Control bloqueado tras cerrar: ~3.8 s → ~2 s; las teclas siguientes responden en 6–25 ms. Queda ~1 s del cierre del player (teardown de hls.js) |
| Menú lateral del player sin formato | `display:grid` sobre un `<button>` no existe en Chromium < 83: logo, número y nombre se apilaban y las filas se solapaban (flex-shrink). Además el canal "activo" se resolvía por LCN y por id a la vez (el LCN 239 de un canal coincidía con el id 239 de otro) | Grid en un `<span>` interno, `flex:none`, fondo y bordes con alfa blanca, fuente heredada; activo por id (LCN solo sin id) | Captura: filas alineadas, canal activo correcto |
| "Ver más" distinto en Catchup | `aspect-ratio` no existe en Chromium 68: el póster de "Ver más", sin imagen, colapsaba a una franja y los demás tomaban la proporción de cada imagen | Póster 16:9 con `padding-bottom` en todas las tarjetas de Catchup | Todos 240×139 px. VOD usa alturas fijas en TV y no se tocó (el usuario no tiene VOD contratado: sin verificar) |
| Sombreado de Catchup | Capa `.catchup-overlay` (negro 60 %) y sombras al enfocar | Capa eliminada; se quita la sombra, queda el borde del foco | Captura sin velo |
| Elementos pequeños | Tarjeta 11.5em, títulos 0.85rem | Tarjeta 15em, título 1.2rem, hora 1.05rem, filas 1.45rem, título 28–36 px | Captura a 1080p |
| Back entre áreas | En cualquier área BACK volvía atrás o salía | En TV, con el foco fuera del menú lateral, BACK lo lleva al menú (enlace activo); con el foco ya en el menú: atrás / Inicio / salir como antes (`homeBackAction.js`, con tests) | Catchup: contenido → BACK → enlace Catchup del menú |
| Guía abría en el primer canal | El botón EPG del player navegaba a `/home/epg` sin dato del canal | `navigate('/home/epg', { state: { focusChannelId } })`; la Guía mueve la ventana a esa fila y enfoca "Ahora" (salta tarjetas deshabilitadas) | Canal 239 (CTV Toronto): la Guía abre en su fila, no en la 1 |

Notas: las trazas con `Tracing`/`Profiler` inflan los tiempos en este TV (una llamada de 233 ms aparecía como 2.7 s); las cifras de esta sección salen de una sonda ligera dentro de la página (`scripts/tv-qa`-style: latencia tecla→pintado y huecos del hilo). El tiempo de abrir un canal (9–30 s en esta pasada) está dominado por la latencia al middleware (170–570 ms de RTT) y no cambió entre variantes.

