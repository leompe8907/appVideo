# Player: Migracion Legacy, Paridad Tecnica y Optimizacion TV

## Objetivo
Migrar el comportamiento del player del proyecto legacy (SmartTv SDK + implementaciones por dispositivo) al proyecto React actual, manteniendo paridad funcional y UX, optimizando uso de recursos en TVs (LG, Samsung y futuras plataformas).

---

## 1) Checklist de temas a revisar

### 1.1 Contrato de API del Player (UI <-> Engine)
- [x] Definir comandos minimos: `play`, `pause`, `stop`, `seek`, `forward`, `backward`, `playbackSpeed`, `show`, `hide`, `setVideoDimensions`, `mute`, `unmute`.
- [x] Definir eventos minimos: `statechange`, `timeupdate`, `durationchange`, `error`, `end`.
- [x] Definir soporte seek UX: `seek-start`, `seek-end` (o `isSeeking`) para feedback de usuario.

### 1.2 Estados de reproduccion
- [ ] Mapear estados legacy: `IDLE`, `BUFFERING`, `PLAYING`, `PAUSED`.
- [ ] Alinear con estado React: `isLoading`, `isPlaying`, `currentTime`, `duration`, `error`.

### 1.3 Dimensiones y area de video
- [ ] Verificar control de rectangulo de video (`width`, `height`, `top`, `left`) equivalente a legacy.
- [ ] Definir estrategia `show/hide/fullscreen` consistente entre plataformas.

### 1.4 Controles y seekbar
- [ ] Revisar paridad de `forward/backward`, `seekbar`, `goToStart`, `goToEnd`.
- [ ] Revisar diferencias VOD vs live vs catchup.

### 1.5 DRM y media options
- [x] Definir modelo para `drmConfig` y `mediaOption` (tipo de DRM, 4K, timeshifted live, etc.).
- [ ] Definir capa para pasar datos DRM del dominio app al engine nativo.

### 1.6 Manejo de errores
- [ ] Unificar taxonomia de errores (`network`, `drm`, `render`, `stream not found`, etc.).
- [ ] Definir fallback de UI (mensaje + accion de recuperacion).

### 1.7 Ciclo de vida en TV
- [ ] Manejar `app hide/resume` (especialmente Samsung/Tizen).
- [ ] Confirmar politica de `suspend/restore/stop` para no romper sesiones DRM.

### 1.8 Rendimiento y consumo de recursos
- [ ] Reducir frecuencia de updates de tiempo (`timeupdate`) para evitar renders excesivos.
- [ ] Evitar recalculos innecesarios de layout en overlays.
- [ ] Minimizar listeners/intervals permanentes.

---

## 2) Hallazgos del analisis (legacy)

## 2.1 Core del player legacy
Archivo analizado: `EPG/public/js/core/module/player.js`

Hallazgos:
- El core define una interfaz comun de alto nivel (API del player) y eventos para la UI.
- Estados estandar: `STATE_IDLE`, `STATE_BUFFERING`, `STATE_PLAYING`, `STATE_PAUSED`.
- Config base de area de video: `1280x720`, `top=0`, `left=0`.
- Soporta `play`, `pause`, `stop`, `seek`, `forward`, `backward`, `playbackSpeed`, `show`, `hide`, `setVideoDimensions`, `audioTrack`, `mute`.
- Incluye mecanica de `seek-start`/`seek-end` con timeout de hasta ~20s (`startSeek`), pensada para mostrar throbber/feedback de seek.

## 2.2 LG
Archivo: `EPG/public/js/core/device/lg/player.js`

Hallazgos:
- Usa un `<object>` nativo LG para video.
- Controla visibilidad y posicion por CSS (`visibility`, `width`, `height`, `top`, `left`).
- Implementa DRM Widevine y PlayReady con plugin DRM.
- Usa un ticker (`setInterval`) para refrescar progreso/tiempo.

## 2.3 Samsung
Archivo: `EPG/public/js/core/device/samsung/player.js`

Hallazgos:
- Usa `SEFPLAYER`.
- Mapea eventos nativos (`OnEvent`) a callbacks estandar del core (`buffering`, `time`, `duration`, `error`).
- Controla area con `SetDisplayArea`.
- Tiene logica adicional para timeshifted live (`isTimeshiftedLiveStream`) y correccion de tiempo.

## 2.4 Tizen/WebOS (referencia de futuro)
Archivos:
- `EPG/public/js/core/device/tizen/player.js`
- `EPG/public/js/core/device/webos/player.js`

Hallazgos:
- Implementan gestion de app hide/resume y casos DRM (suspend/restore/reopen).
- Tienen especial cuidado para no romper reproduccion en multitarea.

## 2.5 Capa de UI alrededor del player
Archivos:
- `EPG/public/js/scene/home.js`
- `EPG/public/js/module/nbplayer.js`
- `EPG/public/js/module/PlayerFallback.js`

Hallazgos:
- Existe `PlayerFallback` cuando no hay contenido/reproduccion valida.
- Existe control avanzado de seekbar y acciones de control remoto (`forwardXAction`, `backXAction`, `playPause`, etc.).
- Uso de `throbber` para operaciones y transiciones.

---

## 3) Plan de migracion recomendado (paso a paso)

### Fase 1: Contrato unificado del engine (sin tocar plataforma)
1. Definir un contrato unico en React para todos los engines:
   - Comandos + eventos base.
   - Estado comun compatible con UI actual y futura.
2. Introducir estado de seeking (`isSeeking`) o eventos `seek-start/seek-end`.
3. Alinear nombres de estados para facilitar parity (`idle/buffering/playing/paused/error`).

### Fase 2: Paridad UX en Web (engine actual)
1. Mejorar feedback de seek:
   - Activar loader en seek y finalizar en `playing` o timeout.
2. Implementar throttling de `timeupdate`:
   - Reducir setState para no castigar CPU en TV.
3. Asegurar consistencia de overlays entre bouquets, vod, epg y catchup.

### Fase 3: Adapters nativos LG y Samsung
1. Crear engines dedicados:
   - `LgEngine`
   - `SamsungEngine`
2. Mantener interfaz identica al contrato unificado.
3. Implementar puente de eventos nativos -> eventos comunes de app.
4. Implementar `show/hide/setDimensions` por cada plataforma con su API real.

### Fase 4: DRM/mediaOption y robustez de ciclo de vida
1. Definir `drmConfig` y `mediaOption` estandares en React.
2. Soportar reanudacion segura en hide/resume (si aplica por plataforma).
3. Unificar estrategia de errores DRM y fallback.

### Fase 5: Afinacion final TV performance
1. Reducir repaints/reflows de overlays y controles.
2. Evitar intervalos intensivos en UI.
3. Modo debug desacoplado (apagado por defecto en produccion).

---

## 4) Paridad tecnica requerida (legacy vs React)

### 4.1 Minimo para considerar paridad funcional
- `play/pause/stop/seek` correcto en:
  - live
  - vod
  - catchup
- Eventos `timeupdate` y `durationchange` estables.
- `statechange` coherente para loader (buffering/loading).
- Manejo de `error` que no deje UI bloqueada.

### 4.2 Paridad de controles
- Forward/backward configurable por step.
- Seekbar visible segun tipo de contenido y metadata disponible.
- Play/pause y retorno/back consistentes con control remoto.

### 4.3 Paridad de layout y area de video
- Capacidad de fullscreen y mini-window sin artefactos.
- Ajuste de aspect ratio sin deformar video.
- Overlay de carga/fallback sin romper foco o navegacion.

### 4.4 Paridad DRM/plataforma
- Estructura para PlayReady/Widevine.
- Pipeline para pasar credenciales/licencias al engine nativo.
- Estrategia de recuperacion ante errores DRM.

---

## 5) Mejoras recomendadas (bajo consumo para TVs)

1. **Throttling de `timeupdate` en PlayerContext**
   - Emitir actualizaciones visuales con menor frecuencia (ej. cada 250-500ms para UI), conservando precision interna.

2. **Reducir renders derivados**
   - Usar memoizacion para metadata/formatos de tiempo.
   - Evitar recalcular estilos en cada tick.

3. **Estado de seek explicito**
   - `isSeeking` evita falsos loaders y mejora UX sin loops agresivos.

4. **Capas de overlay ligeras**
   - Mantener un solo overlay de carga reutilizable por modulo.

5. **Fallback simple y robusto**
   - Mensaje claro + accion de reintento sin recargar toda la app.

6. **Abstraccion por engine**
   - Aislar diferencias de plataforma dentro del engine.
   - La UI nunca debe conocer detalles nativos (SEFPLAYER, object LG, etc.).

7. **Toggles de optimizacion por marca/plataforma**
   - Flags para activar/desactivar animaciones pesadas en TVs mas limitadas.

---

## 6) Priorizacion sugerida de ejecucion
1. Contrato unificado + estado de seek/loading.
2. Optimizar WebEngine (throttling + UX seek).
3. Paridad de controles/seekbar.
4. Adapters LG/Samsung.
5. DRM/ciclo de vida.
6. Afinacion final de performance y QA en dispositivos reales.

---

## 7) Riesgos y mitigaciones
- Riesgo: diferencias fuertes por plataforma (API nativa heterogenea).
  - Mitigacion: adapter por engine + contrato comun estricto.
- Riesgo: alto uso de CPU por updates de tiempo.
  - Mitigacion: throttling + memoizacion.
- Riesgo: regresiones en UX de controles.
  - Mitigacion: suite de escenarios por tipo de contenido (live/vod/catchup).

---

## 8) Resultado esperado
Un player multiplataforma con:
- paridad funcional respecto al legacy,
- estructura escalable para futuras plataformas,
- y rendimiento estable en TVs con recursos limitados.

---

## 9) Estado de avance (implementado en esta iteracion)

### 9.1 Seek UX parity (parcial)
- Implementado estado de seeking en el estado global del player:
  - `PlayerContext.state.isSeeking`
- Se activa en `seek(...)` y tambien cuando el engine emite `statechange: 'seeking'`.
- Se desactiva en `playing/paused/ended/error` y por timeout de seguridad (20s), emulando el comportamiento defensivo del legacy (`seek-end` forzado).

### 9.2 Timeupdate optimizado para TV
- Implementado throttling en `WebEngine` para reducir frecuencia de `timeupdate` hacia React (250ms).
- Objetivo: bajar renders y consumo de CPU sin perder UX perceptible.

### 9.3 Overlays de carga durante seek
- Los overlays de player ahora se muestran tambien en seeking:
  - `BouquetPage`
  - `VodPage`
  - `EpgCardsPage`
  - `CatchupPage`
- Condicion efectiva: `isLoading || isSeeking`.

### 9.4 Ajuste de estado loaded en WebEngine
- `statechange: 'loaded'` pasa a emitirse cuando `canplay` ocurre (antes se emitia inmediatamente despues de `load()`).
- Mejora coherencia entre estado reportado y estado real del video.

---

## 10) Pendiente proxima fase
- Definir contrato final de engine para adapters nativos (LG/Samsung):
  - [x] eventos estandar obligatorios
  - [x] comandos obligatorios
  - [x] parametros `mediaOption` y `drmConfig`
- Implementar semantica opcional explicita `seek-start/seek-end` (hoy se cubre con `isSeeking` + timeout).
- Diseñar y documentar adapters nativos con la interfaz comun (sin acoplar UI a APIs de device).

## 11) Avance adicional en modo agente

- Se agrego documento de contrato final: `src/docs/PLAYER_ENGINE_CONTRATO_FINAL.md`.
- Se crearon stubs de adapters:
  - `src/player/engines/lg/LgEngine.js`
  - `src/player/engines/samsung/SamsungEngine.js`
- `createEngine` ya selecciona engine por heuristica de TV/user-agent con fallback seguro.
- Se centralizo resolver de plataforma en `resolveEnginePlatform` con override de QA:
  - `?engine=web|lg|samsung`
  - persistencia en `localStorage['player.engine']`.
- `PlayerContext.play(...)` ya acepta y transporta `mediaOption` y `drmConfig` al engine.
- `WebEngine` incluye comandos de contrato (`forward`, `backward`, `setPlaybackRate`, `setDimensions`, `show/hide`, `mute/unmute`) y eventos `seek-start`/`seek-end`.

## 12) Avance adapters TV (estructura nativa preparada)

- Se agrego `src/player/engines/tv/BaseTvEngine.js`:
  - fallback transparente a `WebEngine` para evitar regresiones
  - hooks de ciclo de vida (`visibilitychange`, `pagehide`, `pageshow`) para paridad futura de hide/resume
  - interfaz de metodos nativos (`nativeLoad`, `nativePlay`, `nativePause`, `nativeSeek`, etc.) para encapsular diferencias por plataforma
- `LgEngine` y `SamsungEngine` ahora extienden `BaseTvEngine`:
  - deteccion inicial de runtime nativo (LG webOS/PalmSystem, Samsung tizen/webapis)
  - placeholders documentados para wiring de DRM y mapeo de eventos nativos
  - decision actual de seguridad: mantener fallback web activo hasta completar validacion en dispositivos reales

### Pendiente inmediato (siguiente iteracion tecnica)
- LG:
  - conectar eventos nativos reales al contrato unificado (`statechange/timeupdate/error/seek-*`)
  - implementar control de area/visibilidad nativo
  - aplicar `drmConfig` real
- Samsung:
  - mapear `OnEvent` de AVPlay/SEF al contrato
  - implementar `SetDisplayArea` y control de estado
  - incorporar semantica `isTimeshiftedLive` en `mediaOption`

## 13) Control de rollout por marca (implementado)

- Se incorporo configuracion `player` por marca en `src/config/brands.js`:
  - `player.nativeAdaptersEnabled` (default `false`)
  - `player.enginePolicy` (default `'auto'`)
- `createEngine` ahora combina `deviceInfo` + configuracion de marca activa para resolver plataforma.
- `resolveEnginePlatform` respeta este orden:
  1) override QA `?engine=web|lg|samsung`
  2) policy de marca (`force-web|force-lg|force-samsung|auto`)
  3) autodeteccion por user-agent (solo si `nativeAdaptersEnabled=true`)

Resultado:
- Se habilita despliegue gradual por cliente/marca.
- Se evita activar adapters nativos accidentalmente en producción antes de pruebas en hardware real.

## 14) Bridge nativo inicial (implementado)

- `BaseTvEngine` ahora soporta fallback automático cuando un método nativo no está manejado (`native* -> false`).
- `SamsungEngine`:
  - conexión inicial a `webapis.avplay` con mapeo de eventos de buffering/time/error al contrato unificado.
  - wrappers de comandos base (`load/play/pause/seek/setDimensions/destroy`).
  - soporte de adapter inyectado para QA: `window.__SAMSUNG_PLAYER_ADAPTER__`.
  - aplicación inicial de `mediaOption` y `drmConfig` en `nativeLoad`.
  - detección de capacidades por API en runtime para mejorar compatibilidad por modelo (matriz `detectCapabilities`).
- `LgEngine`:
  - wrappers de comandos base sobre adapter inyectado.
  - soporte de adapter inyectado para QA: `window.__LG_PLAYER_ADAPTER__`.
  - en webOS/PalmSystem sin adapter validado, mantiene fallback web seguro.
  - contrato inicial `setDrmConfig(...)` para adapters LG inyectados.

### Pendiente siguiente (ya acotado)
- Completar wiring DRM real por plataforma en hardware (validar comandos efectivos por modelo/version).
- Homologar `hide/show` nativo Samsung según API real de modelo.
- Implementar adapter LG real (webOS/media pipeline) y activar `isNativeActive` en QA de hardware.
- Consolidar tabla real de compatibilidad por firmware/modelo Samsung tras pruebas en dispositivos.

## 15) Tabla tecnica de compatibilidad (QA hardware/emulador)

Estado sugerido por celda:
- `OK`: funciona estable
- `PARCIAL`: funciona con limitaciones
- `FALLBACK`: no nativo, cae a WebEngine
- `N/A`: no aplica
- `PENDIENTE`: no probado

| Plataforma | Modelo TV / Emulador | Firmware / Version | Engine elegido | Fuente (live/vod/catchup) | Play/Pause | Seek | Timeupdate | SetDisplayArea/Dimensions | DRM PlayReady | DRM Widevine | Hide/Resume app | Error handling | Resultado |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Samsung |  |  |  |  | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| Samsung |  |  |  |  | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| LG |  |  |  |  | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| LG |  |  |  |  | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |

### Registro de evidencias por prueba

| Fecha | Plataforma | Entorno | Comando/URL de prueba | Evidencia (video/log) | Observaciones |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

