# Plan de testeo: app `intv` en LG webOS

Borrador para ajustar. Basado en el grafo, `packages/core/src/config/brands/intv.js`, `src/App.jsx` y los tests existentes.

## 0. Contexto

- **Dispositivo:** LG 49UN7310PSC, webOS SDK 5.6.2, firmware 04.64.00, ares `lgtv` (192.168.6.200:9922). Corresponde a webOS 5 / Chromium ~68 (verificar con `navigator.userAgent`).
- **App:** `intv` ("inTV Play", v2.0.2). Web React + Vite, un único build por marca (`build:intv`), empaquetado webOS.
- **Config de intv que define el alcance:**
  - Activo: login usuario/contraseña, smartcard (licencias), EPG, Catchup (layout `rails`), VOD (layout `hero`), buscador, OSMS, control parental, Mi Cuenta, flechas de canal, controles de volumen, anuncios en Inicio, inactividad, telemetría de player.
  - Inactivo: perfiles (`features.profiles=false`), login UDID/QR, Google/Facebook, recuperar contraseña, `nativeAdaptersEnabled=false` (el player usa **WebEngine**, hls.js/video.js, no el LgEngine nativo).
- **Cambio sin commitear en `intv.js` (hay que testearlo primero):** `deviceSession.baseUrl/wsUrl` y `account.links.changePassword.url` están vacíos con `deviceSession.enabled=true`; EPG y OSMS pasaron a `true`.

## 1. Estrategia y herramientas

| Capa | Herramienta | Qué cubre |
|---|---|---|
| Automática en PC | `pnpm test` (vitest, 55 archivos), `pnpm lint`, `build:verify-tv` (es-check) | Lógica, compat ES del bundle |
| En el TV, automatizada | `ares-inspect -d lgtv intv` (CDP) + script que inyecta `KeyboardEvent` con keyCodes LG y lee DOM/consola/red | Navegación, flujos, errores JS, requests |
| En el TV, manual | Control remoto físico | Teclas reales (Back 461, CH± PageUp/Down, media, números), rendimiento percibido, imagen/audio |
| Observabilidad | `ares-log`/consola CDP, `errorReporting.js`, panel de estadísticas del player | Errores, buffer, latencia |

Pendiente de confirmar: credenciales de prueba de intv (usuario con y sin smartcard, con canal bloqueado por PIN, con catchup/VOD).

## 2. Fase A: puertas de calidad previas (PC, sin TV)

| ID | Prueba | Criterio |
|---|---|---|
| A1 | `pnpm test` completo | 0 fallos (en especial `LgEngine`, `WebEngine`, `tvRemote`, `NavigationRouter`, `loginFlow`, `deviceSessionService`) |
| A2 | `pnpm lint` | Sin errores nuevos |
| A3 | `pnpm build:verify-tv` para intv | es-check pasa, sin sintaxis > ES2017 en `dist/intv` |
| A4 | `scripts/check-brand-secrets.js` | Sin secretos en el bundle de intv |
| A5 | Revisión del diff de `intv.js` | Decidir si `baseUrl:""` es intencional (ver C3, C12) |

## 3. Fase B: instalación y arranque en el TV

| ID | Prueba | Criterio |
|---|---|---|
| B1 | Build `intv` + `ares-package` + `ares-install -d lgtv` + `ares-launch` | Instala sin error, versión visible = esperada |
| B2 | Arranque en frío (cerrar app, lanzar) | Splash ~3 s, sin pantalla negra; tiempo hasta Login/Home medido |
| B3 | `window.webOS` y `__tvPlatformReady` en consola | Existen antes de montar React |
| B4 | Consola al arrancar | 0 errores JS, 0 requests fallidos no esperados |
| B5 | Arranque con sesión guardada | Va a `/preload` y luego Home sin pedir login |
| B6 | Arranque sin red | Aviso de error, sin cuelgue; recupera al volver la red |
| B7 | Cierre y reapertura repetida (x10) | Sin degradación, sin fugas notorias de memoria |

## 4. Fase C: funcional por módulo

Rutas: `/` splash, `/login`, `/smartcard`, `/preload`, `/home/{inicio,buscador,servicios-tv-radio,epg,vod,catchup,osms,mi-cuenta}`.

**C1. Login (`LoginPage`, `loginFlow`)**
- Login válido, inválido, usuario vacío, contraseña vacía, texto con caracteres especiales.
- Teclado en pantalla (OSD) con D-pad; OK escribe, Back cierra, el foco vuelve al campo.
- Mostrar/ocultar contraseña (ojo).
- Errores de red / timeout / reintento (`classifyError`, `retryOperation`).
- Verificar que **no** aparecen botones UDID, Google, Facebook ni "olvidé contraseña".
- Licencia "en uso" (`isLicenseInUseError`).

**C2. Smartcard / licencias** (`SmartCardPage`)
- Cuenta con 1 y con varias licencias; selección con D-pad; activación; error de licencia; volver atrás.

**C3. Sesión de dispositivo** (`deviceSessionService`, `deviceSessionWatchdog`, `backendRetryPolicy`)
- Con `baseUrl` vacío: confirmar si la app intenta conectar a `""`, qué requests salen, que no entre en bucle de reintentos ni rompa Home.
- Si se define URL real: conexión WS, heartbeat, revocación del dispositivo (logout forzado), cierre inesperado, backoff con jitter.
- Persistencia de sesión tras refrescar token (riesgo conocido en Wind: refresh con rotación).

**C4. Preload** (`preloadStore`, `tvDataService`, `epgService`, `vodService`)
- Barra de progreso, tiempos por etapa, orden (bouquets, streams, EPG, VOD, catchup).
- Fallo parcial de EPG/VOD: la app sigue sin bloquearse.
- Volumen de datos reales: sin congelar la UI (hallazgos de `prepareRecorded O(T*G*E)`).

**C5. Home / Inicio** (`BouquetPage`, `BouquetLayouts`, `HomeShell`)
- Render de bouquets y canales según layout de intv; subcabecera con info de servicio y hora (cambio nuevo `subheader.enabled=true`).
- Anuncios en Inicio: render, foco, `actionUrl` (validar esquema; hallazgo conocido).
- Servicios TV/Radio.

**C6. Navegación y foco** (`NavigationRouter`, `spatialNavigation`, `TvFocusRing`, sidebar)
- LRUD en cada pantalla sin "foco perdido" ni foco atrapado; anillo de foco visible y con color de marca.
- Sidebar: entrar/salir, memoria del último foco (`homeShellLastContentFocus`), orden `navOrder`.
- Back: cierra modales → sale de sección → diálogo de salir de app; Back largo (`createBackLongPress`).
- Modales: ConfirmModal (foco inicial), EpgEventModal, MessageModal.
- Rutas inválidas redirigen a `/home/inicio`.

**C7. Reproductor en vivo** (`WebEngine`, `HlsPlaybackController`, `PlayerHud`, `PlayerContext`)
- Reproducir canal: tiempo hasta primera imagen (medir zapping).
- Zapping: flechas HUD, CH±, teclas numéricas con `channelNumberInput`, lista de zapping.
- HUD: autohide 6 s, volumen, panel de estadísticas, sidebar de canales (no se cierra al seleccionar).
- Audio/subtítulos: cambio de pista, preferencia guardada por canal, subtítulos apagados por defecto.
- Fullscreen / salir de player con Back.
- Estabilidad: 30–60 min en un canal (buffer, latencia live, `LiveLatencyGuard`, sin saltos, sin cierre de app).
- Errores: canal caído, manifest 404, key/DRM, pérdida de red a mitad de stream (overlay de error y recuperación).
- App a segundo plano y vuelta (`nativeOnAppHide/Resume`): libera y reanuda.
- Telemetría de player: eventos start/stop con los mínimos de tiempo.

**C8. EPG** (`EpgCardsPage`, `EpgCards`, `epgSlots`)
- Grilla con datos reales, scroll en D-pad, "ahora", barra de progreso, pasado/futuro (`epgPast`).
- Modal de programa, recordatorios (aviso a los 60 s, no mostrar durante reproducción), reproducir en vivo desde modal.
- Rendimiento: scroll fluido sin virtualizar (hallazgo conocido).
- `EpgGuardRoute` cuando EPG está deshabilitada.

**C9. Catchup** (`CatchupPage`, layout `rails`)
- Listado por canal, grupo, "ver más", reproducción de evento pasado, seek, volver.

**C10. VOD** (`VodPage`, layout `hero`)
- Categorías, rails, detalle (descripción ≤180), reproducción, seek, fin de contenido, series/temporadas si aplica.

**C11. Buscador** (`SearchPage`, `searchService`, `searchSessionStore`)
- Teclado OSD, debounce, resultados por tabs (canales/EPG/VOD/catchup), abrir resultado en cada tipo, sesión que se conserva (TTL), búsqueda sin resultados.

**C12. Mi Cuenta** (`MiCuentaPage`, `SecurityPanels`)
- Secciones habilitadas: control parental, acerca de, refrescar, cerrar sesión, salir de app.
- Enlaces con URL vacía (`changePassword`, `linkedDevices`, `subscription`, `deleteAccount`): qué pasa al abrirlos (no debe romper ni abrir "about:blank").
- Cerrar sesión limpia stores y storage de la marca y vuelve a login.

**C13. Control parental** (`parentalStore`, `parentalGateStore`, `pinHash`)
- Crear/cambiar/resetear PIN; bloquear canal; reproducir canal bloqueado (pide PIN, PIN correcto/incorrecto); TTL de desbloqueo.
- Clasificación y contenido adulto; límite de intentos de PIN (riesgo conocido: no hay).

**C14. OSMS** (`OsmsPage`, `osmsStore`, `useOsmsPolling`)
- Sondeo, aviso inline de mensaje nuevo (`osmsInline`), bandeja, leído/no leído, mensaje largo.

**C15. Inactividad / protector** (`InactivityHost`, `inactivityConfig`)
- Aviso a los 60 s de gracia, cancelación con tecla, comportamiento durante reproducción.

## 5. Fase D: control remoto en hardware real

| Tecla | Esperado |
|---|---|
| D-pad, OK | Navegación y selección |
| Back (461) | Ver C6 |
| CH± (PageUp/Down) | Zapping en player, scroll en listas, sin romper otros contextos |
| 0–9 | Número de canal en player; entrada en campos de texto |
| Play/Pause/Stop/FF/Rew (415/19/413/417/412) | En player; ignoradas fuera |
| Rojo/verde/amarillo/azul, Home, Menú | La app no se rompe ni queda con foco muerto |
| Magic Remote (puntero) | Hover/click no deja la UI en estado inconsistente |

## 6. Fase E: no funcionales

| ID | Prueba | Criterio sugerido |
|---|---|---|
| E1 | Rendimiento: arranque, cambio de sección, zapping | Registrar tiempos; umbrales a definir con el equipo |
| E2 | Memoria tras 1 h de uso mixto | Sin crecimiento sostenido, sin cierre de app |
| E3 | Resiliencia de red (cortar y devolver Wi-Fi/Ethernet) | Recupera sin relanzar la app |
| E4 | Seguridad básica: almacenamiento de tokens (hallazgo de texto plano), secretos en bundle, `actionUrl` de anuncios, PIN | Sin exposición nueva |
| E5 | Accesibilidad TV: contraste, tamaño de texto a 1080p y distancia, foco siempre visible | Legible desde 3 m |
| E6 | Visual: resolución 1080p, escalado, textos largos, imágenes que no cargan (fallback) | Sin recortes ni solapes |
| E7 | i18n: idioma del dispositivo y textos faltantes | Sin claves sin traducir |
| E8 | Regresión del diff de intv (EPG, subcabecera y OSMS recién activados) | Ver C5, C8, C14 |

## 7. Priorización

1. **P0 (smoke, cada build):** A1–A4, B1–B5, C1, C2, C4, C6, C7 (reproducir + zapping + Back), C12 (cerrar sesión).
2. **P1:** C3, C5, C8, C9, C10, C11, C13, C14, Fase D.
3. **P2:** C15, Fase E completa, estabilidad de larga duración.

## 8. Entregables

- Script CDP de smoke para el TV (navegación + captura de consola/red), guardado en `scripts/`.
- Tabla de resultados por ID (Pass/Fail/Bloqueado), con capturas y logs.
- Lista de defectos clasificados (bloqueante / mayor / menor) con pasos de reproducción.

## 9. Riesgos y supuestos

- Sin credenciales de prueba y datos reales no se pueden ejecutar C1–C14.
- `ares-inspect` y la inyección de teclas por JS no reemplazan al control físico: las teclas reales (CH±, media, números) se prueban a mano.
- Un solo modelo de TV (webOS 5); webOS 4.5 (objetivo de la auditoría) queda sin cubrir.
- El player nativo LG (`LgEngine`, DRM Luna) **no** se ejercita porque `nativeAdaptersEnabled=false` en intv; sólo cubren sus tests unitarios.
- Contenido de pago/DRM: no probado salvo que las credenciales lo incluyan.
