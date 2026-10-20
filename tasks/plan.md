# Plan de implementación: paridad web / LG / Samsung / Fire TV (Vega)

Fecha: 2026-10-20 · Rama base: `vega/core`
Detalle de cada tarea (criterios de aceptación, verificación, archivos): [todo.md](todo.md).

## Resumen

Web, LG y Samsung comparten el mismo código (`src/`). A LG y Samsung les falta la
integración con cada televisor: teclas del control, empaquetado y el reproductor nativo.
Vega (`apps/vega`) es una app aparte en React Native que comparte `packages/core`; le
faltan pantallas y funciones enteras.

El orden va de mayor a menor impacto. Para medir el impacto se tuvo en cuenta:

1. **A cuántos usuarios afecta hoy.** Una falla en una plataforma ya publicada pesa más
   que una función nueva.
2. **Qué marcas usan la función**, según `packages/core/src/config/brands/*.js`:

| Flag | Marcas que lo tienen activo |
|---|---|
| `login.udid.enabled` (login con código) | bromteck, cableatlantico, multiplustv, sattv |
| `features.osms` | bromteck, cableatlantico, wind |
| `login.telemetry.enabled` ("Más vistos" + telemetría) | wind |
| `features.profiles` | **ninguna** |
| `player.showPlaybackButtonsOnLive` / `showSeekbarOnLive` | **ninguna** |
| `player.nativeAdaptersEnabled` | **ninguna** (LG y Samsung usan el reproductor web) |

3. **Si desbloquea otras tareas.** Por ejemplo, el empaquetado es necesario para poder
   probar en un televisor real.

Por eso perfiles y los botones de reproducción en vivo de Vega quedan al final: hoy
ninguna marca los activa.

## Decisiones de arquitectura

- **La lógica se comparte en `packages/core`.** Si una función existe en la web y hay
  que portarla a Vega, la lógica que no depende de la interfaz (flujo UDID, inactividad,
  sondeo de OSMS) se mueve primero a `@appvideo/core`, con tests. Después cada app hace
  su propia pantalla. Así no queda la lógica duplicada en dos sitios.
- **LG y Samsung siguen con el reproductor web** hasta que se tome la decisión D3. El
  código nativo (`LgEngine`, `SamsungEngine`) no se toca en las fases 1 a 4.
- **Las teclas de TV se traducen en un solo lugar.** Toda tecla nueva entra por
  `src/utils/tvRemote.js` (`TV_ACTION`) y se reparte desde `NavigationRouter`. No se
  agregan listeners de `keydown` sueltos.
- **Cada tarea deja la app funcionando** y se puede revisar y mergear por separado.

## Decisiones pendientes (bloquean fases)

| # | Pregunta | Bloquea |
|---|---|---|
| D1 | En LG y Samsung, ¿la app va **empaquetada** (IPK/WGT con archivos locales) o es un **lanzador de URL** que abre la web publicada? | Tareas 5–7 |
| D2 | ¿Alguna marca necesita **DRM** (Widevine/PlayReady) en alguna plataforma? | Fase 6 |
| D3 | En LG y Samsung, ¿se **arregla el reproductor nativo** o se queda el web y se elimina el código nativo? | Fase 6 |
| D4 | ¿Qué marcas se publican en Fire TV y cuándo? (hoy: intv y multiplustv) | Prioridad dentro de las fases 3 y 4 |
| D5 | Para reanudar VOD, ¿el backend guarda la posición o queda sólo en el dispositivo? | Tarea 23 |

## Lista de tareas (orden de impacto)

### Fase 1: control remoto en LG y Samsung
Afecta hoy a todos los usuarios de TV y cuesta poco.
- [ ] 1. Samsung: registrar las teclas del control (`tizen.tvinputdevice`)
- [ ] 2. LG: mapear CH± (33/34) y agregar tests de `tvRemote`
- [ ] 3. LG y Samsung: teclas de media (play/pausa/stop/FF/RW) en el reproductor

**Checkpoint 1:** tests y build en verde; en un Samsung y un LG reales funcionan
CH± y Play/Pausa.

### Fase 2: empaquetado de LG y Samsung (depende de D1)
Sin esto no se puede publicar en las tiendas de LG y Samsung.
- [ ] 4. Samsung: `config.xml` por marca, permisos y script para armar el `.wgt`
- [ ] 5. LG: `appinfo.json` por marca y script para armar el `.ipk`
- [ ] 6. (Sólo si D1 = empaquetado) Que la app arranque desde `file://`: rutas relativas y router
- [ ] 7. LG y Samsung: salvapantallas del sistema, salida de la app y modelo/ID real del aparato

**Checkpoint 2:** el `.wgt` y el `.ipk` de una marca se instalan, inician sesión
y reproducen en el televisor.

### Fase 3: Vega, brechas que afectan a las marcas publicadas
- [ ] 8. Vega: ErrorBoundary y aviso de "sin conexión"
- [ ] 9. Core: mover el flujo de login con código (UDID) a `@appvideo/core`
- [ ] 10. Vega: pantalla de login con código (UDID) y QR
- [ ] 11. Vega: el buscador abre los resultados de Catchup y Guía
- [ ] 12. Core + Vega: inactividad ("¿Sigues ahí?" y salvapantallas)

**Checkpoint 3:** build Release de multiplustv en el stick; login con código,
buscador e inactividad probados en el aparato.

### Fase 4: Vega, paridad para las marcas que activan cada función
- [ ] 13. Vega: telemetría de reproducción (Wind)
- [ ] 14. Vega: OSMS, sondeo y aviso de mensaje nuevo
- [ ] 15. Vega: OSMS, página de mensajes en Mi Cuenta
- [ ] 16. Vega: controles de media del sistema y pausa en segundo plano
- [ ] 17. Vega: banners de video y banners con `catchup_id`
- [ ] 18. Vega: recordar audio y subtítulos por canal
- [ ] 19. Vega: textos traducidos (sin textos fijos) e idioma del dispositivo
- [ ] 20. Vega: subcabecera de Inicio

**Checkpoint 4:** los tests de core pasan; Vega con wind y con bromteck
(OSMS, telemetría) probado en el stick.

### Fase 5: funciones nuevas en todas las plataformas
Impacto medio. Son mejoras visibles y aplican a todas las marcas.
- [ ] 21. Zapping escribiendo el número del canal (web/TV y Vega)
- [ ] 22. Selector de temporada en series (web y Vega)
- [ ] 23. Reanudar VOD donde quedó (web y Vega)
- [ ] 24. Calidad manual en el reproductor (pendiente de Wind)

**Checkpoint 5:** las cuatro funciones andan en la web, en un TV y en Vega.

### Fase 6: reproductor nativo de TV y DRM (depende de D2 y D3)
- [ ] 25. Decidir y documentar el reproductor de LG/Samsung (ADR); si se descarta, eliminar el código nativo
- [ ] 26. (Si se arregla) Samsung AVPlay: detener al cerrar, orden de la DRM, eventos, `forward`/`backward`, pistas
- [ ] 27. (Si se arregla) LG: escapar el XML de DRM, LOADED diferido y carrera entre carga y cierre
- [ ] 28. (Si D2 = sí) DRM: pasar `drmConfig` desde la configuración de la marca hasta el reproductor

**Checkpoint 6:** si se activó el nativo, contenido con DRM probado en LG y Samsung reales.

### Fase 7: bajo impacto (ninguna marca lo activa hoy)
- [ ] 29. Vega: perfiles (cuando alguna marca active `features.profiles`)
- [ ] 30. Vega: "Ir al vivo" y botones de reproducción en vivo (cuando alguna marca active `showPlaybackButtonsOnLive`)
- [ ] 31. Vega: catchup "legacy" y detalle VOD "classic" (sólo si alguna marca los configura)
- [ ] 32. Limpieza: quitar los módulos que nadie importa (12 en `src/` y `FocusButton` en Vega)

Quedan fuera de este plan (cada una necesita su propio spec): favoritos, "Seguir
viendo", guía con línea de tiempo, grabaciones y siguiente episodio.

## Paralelización

- Las fases 1–2 (`src/`, `packaging/`, `scripts/`) y las fases 3–4 (`apps/vega`) tocan
  archivos distintos: pueden avanzar en paralelo, en dos sesiones o con dos personas.
- Las tareas 9 y 12 (core) deben estar mergeadas antes de las tareas 10 y 12 de Vega.
  Cambiar `packages/core` también cambia la web: hay que correr los tests de ambas.
- Las tareas 14–15 (OSMS) y 13 (telemetría) son independientes entre sí.

## Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| No hay LG ni Samsung reales para probar | Alto | Conseguirlos antes de la fase 1; sin aparato, las fases 1, 2 y 6 no se pueden dar por cerradas |
| Cambiar `packages/core` rompe la web | Alto | Tests de core primero; correr `vitest` y `build:intv` en cada tarea de core |
| Vega no tiene una API de red equivalente a NetInfo | Medio | Tarea 8 empieza con una prueba corta; si no existe, se detecta la falta de red por errores de fetch |
| `$WEBAPIS` no carga desde un `<script>` inyectado en Tizen | Medio | Verificarlo en la tarea 1; si falla, poner el `<script>` fijo en el `index.html` del paquete Tizen |
| En Debug, Vega se cierra a los ~7,5 min reproduciendo | Bajo | Probar inactividad y telemetría en Release |

## Notas

- `graphify-out/` no existe y la CLI `graphify` no está instalada: este plan sale de
  leer el código directamente.
- Corrección a la auditoría: no existe ningún `scaleFit` en `src/` ni en core, así que
  ese punto no es una brecha.
