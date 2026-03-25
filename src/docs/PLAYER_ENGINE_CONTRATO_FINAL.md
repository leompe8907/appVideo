# Player Engine: Contrato Final (Web / LG / Samsung)

## Objetivo
Definir un contrato unico y estricto entre UI y engines para asegurar paridad funcional con legacy, desacoplar la UI de APIs nativas y habilitar adapters por plataforma sin romper modulos (`bouquets`, `vod`, `epg`, `catchup`).

## 1) Comandos obligatorios

Todos los engines deben implementar:

- `init(container)`
- `load(url, options)`
- `play()`
- `pause()`
- `seek(seconds)`
- `forward(seconds?)`
- `backward(seconds?)`
- `setPlaybackRate(rate)`
- `setDimensions({ width, height, left, top })`
- `show()`
- `hide()`
- `mute()`
- `unmute()`
- `destroy()`

## 2) Eventos obligatorios

Todos los engines deben emitir:

- `statechange` con `state` en: `loading`, `loaded`, `playing`, `paused`, `seeking`, `seeked`, `ended`
- `timeupdate` con `currentTime`, `duration`
- `durationchange` con `duration`
- `ended`
- `error`
- `seek-start` (paridad con legacy)
- `seek-end` (paridad con legacy)

## 3) Payload recomendado para `load(url, options)`

```js
{
  type: 'service' | 'vod' | 'catchup',
  autoPlay: true,
  mediaOption: {
    isLive: boolean,
    isTimeshiftedLive: boolean,
    profile: 'default' | 'low-latency' | 'tv-safe'
  },
  drmConfig: {
    type: 'none' | 'widevine' | 'playready' | 'verimatrix',
    licenseUrl: string,
    headers: Record<string, string>,
    certificateUrl?: string,
    customData?: string
  }
}
```

Notas:
- `mediaOption` y `drmConfig` ya pueden viajar desde la app, aunque su aplicacion nativa se completa en adapters LG/Samsung.
- En Web actual se aceptan como contrato y se ignoran si no aplican.

## 4) Estado de implementacion en este repo

- `WebEngine`: implementado y operativo.
- `BaseTvEngine`: base comun para adapters TV con:
  - fallback transparente a `WebEngine`
  - hooks de ciclo de vida (`visibilitychange`, `pagehide`, `pageshow`)
  - interfaz de metodos nativos (`nativeLoad/play/pause/seek/...`)
- `LgEngine`: adapter inicial sobre `BaseTvEngine`, con deteccion de entorno LG y placeholders de integracion nativa.
- `SamsungEngine`: adapter inicial sobre `BaseTvEngine`, con deteccion de entorno Tizen/WebAPI y placeholders de integracion nativa.
- `createEngine(deviceInfo)`: seleccion inicial por heuristica de TV + user-agent.
- Selector de engine con override de QA:
  - URL: `?engine=web|lg|samsung`
  - Persistencia: `localStorage['player.engine']`

## 5) Matriz de paridad actual

- `Web`:
  - Comandos base: OK
  - Eventos base: OK
  - `seek-start/seek-end`: OK
  - `mediaOption/drmConfig`: contrato aceptado, aplicacion parcial
- `LG`:
  - Contrato: OK (por `BaseTvEngine` + fallback seguro)
  - Integracion API nativa: EN CURSO (estructura lista, pendiente wiring real)
- `Samsung`:
  - Contrato: OK (por `BaseTvEngine` + fallback seguro)
  - Integracion API nativa: EN CURSO (estructura lista, pendiente wiring real)

## 6) Reglas de compatibilidad

- La UI NO debe llamar APIs nativas ni depender de nombres de plataforma.
- Todo flujo de reproduccion debe pasar por `PlayerContext`.
- Cualquier extension de platform-specific behavior debe mantenerse dentro del engine correspondiente.

## 7) Proximos entregables tecnicos

1. Implementar adapter nativo LG:
   - [ ] mapeo de eventos nativos -> contrato comun
   - [ ] `setDimensions/show/hide` por API real
   - [ ] handshake DRM (Widevine/PlayReady si aplica)
2. Implementar adapter nativo Samsung (Tizen/SEF):
   - [ ] mapeo `OnEvent` -> contrato comun
   - [ ] `SetDisplayArea` + control de estado
   - [ ] soporte timeshifted live
3. QA tecnica por escenario:
   - [ ] live / vod / catchup
   - [ ] seek corto/largo
   - [ ] pause/play/background-resume
   - [ ] error network/stream/drm

## 8) Notas de prueba rapida

- Forzar web: `?engine=web`
- Forzar lg: `?engine=lg`
- Forzar samsung: `?engine=samsung`
- Limpiar override:
  - `localStorage.removeItem('player.engine')`

## 9) Activacion controlada por marca

Se agrego configuracion `player` en `brands.js`:

```js
player: {
  nativeAdaptersEnabled: false,
  enginePolicy: 'auto'
}
```

Semantica:
- `nativeAdaptersEnabled`:
  - `false`: fuerza flujo seguro (WebEngine), aunque el dispositivo sea TV.
  - `true`: permite auto-deteccion LG/Samsung por user-agent.
- `enginePolicy`:
  - `'auto'`: usa deteccion normal.
  - `'force-web'`: fuerza `WebEngine`.
  - `'force-lg'`: fuerza `LgEngine`.
  - `'force-samsung'`: fuerza `SamsungEngine`.

Prioridad de seleccion:
1. override de QA por URL/localStorage (`?engine=...`)
2. politica por marca (`player.enginePolicy`)
3. auto-deteccion por dispositivo (solo si `nativeAdaptersEnabled=true`)

## 10) Adapter bridge (iteracion actual)

Se implemento bridge inicial para comenzar wiring nativo sin romper compatibilidad:

- `BaseTvEngine`:
  - ahora interpreta `native*` methods con retorno `false` como "no manejado" y hace fallback a WebEngine.
  - helpers de mapeo/listado de eventos nativos ya disponibles:
    - `emitNativeState(...)`
    - `emitNativeTime(...)`
    - `emitNativeDuration(...)`
    - `emitNativeError(...)`

- `SamsungEngine`:
  - soporte de adapter inyectado para QA: `window.__SAMSUNG_PLAYER_ADAPTER__`
  - integración inicial con `window.webapis.avplay` cuando está disponible:
    - `open`, `prepare/prepareAsync`, `play`, `pause`, `seekTo`, `setDisplayRect`, `stop`, `close`
    - mapeo de callbacks (`onbufferingstart`, `onbufferingcomplete`, `oncurrentplaytime`, `onstreamcompleted`, `onerror`) al contrato común.
  - aplicación inicial de `mediaOption`:
    - `isTimeshiftedLive` -> `setStreamingProperty('IS_LIVE', 'true')`
    - `profile='low-latency'` -> `setStreamingProperty('ADAPTIVE_INFO', 'STARTBITRATE=HIGHEST')`
  - aplicación inicial de `drmConfig` con tolerancia a variantes de API:
    - `setDrm(...)`
    - `setDrmProperty(...)`
    - fallback `setStreamingProperty('LICENSE_SERVER', ...)`
  - matriz de capacidades detectada en runtime (`detectCapabilities(api)`) para adaptar llamadas por modelo/version:
    - listener/prepare
    - play/pause/seek
    - display rect/method
    - DRM (`setDrm` / `setDrmProperty`)
    - stop/close

- `LgEngine`:
  - soporte de adapter inyectado para QA: `window.__LG_PLAYER_ADAPTER__`
  - wrapper seguro (`load/play/pause/seek/setDimensions/show/hide/destroy`) sobre adapter inyectado.
  - para entorno webOS/PalmSystem sin adapter validado, mantiene fallback web por seguridad.
  - contrato inicial DRM para adapter inyectado:
    - `api.setDrmConfig({ type, licenseUrl, headers, customData, certificateUrl })`

## 11) Tabla rapida de compatibilidad por capacidades (runtime)

Matriz para completar durante QA por modelo:

| Plataforma | open | prepareAsync/prepare | setListener | play/pause | seekTo | setDisplayRect | setDisplayMethod | setDrm | setDrmProperty | setStreamingProperty | stop/close |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Samsung (modelo A) |  |  |  |  |  |  |  |  |  |  |  |
| Samsung (modelo B) |  |  |  |  |  |  |  |  |  |  |  |
| LG (adapter inyectado) |  | N/A | N/A |  |  |  |  |  |  |  |  |

