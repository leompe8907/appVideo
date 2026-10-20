# Tareas: paridad web / LG / Samsung / Fire TV (Vega)

Plan, decisiones y riesgos: [plan.md](plan.md). Las tareas están ordenadas de mayor a menor impacto.

**Comandos de verificación** (Node 20):
- Tests: `PATH="/usr/local/opt/node@20/bin:$PATH" npx vitest run`
- Lint: `corepack pnpm run lint`
- Build web/TV: `corepack pnpm run build:intv` (o la marca que corresponda)
- Build Vega: `cd apps/vega && VEGA_BRAND=<marca> ./scripts/build.sh Release` y `./scripts/run-on-device.sh 192.168.4.218 Release`
- Después de cambiar código: `/ponytail-review` y `/review` (y además `security-and-hardening` si toca login, tokens o datos del usuario).

**Definición de terminado (vale para todas las tareas):** los tests pasan, el lint no tiene
errores, el build funciona, no se rompió ninguna función que ya andaba y la prueba
manual quedó anotada en el PR.

---

## Fase 1: control remoto en LG y Samsung

### Tarea 1: Samsung, registrar las teclas del control
**Descripción:** Tizen sólo envía las teclas básicas (flechas, OK, Return) si la app no
registra las demás. Hay que registrar con `tizen.tvinputdevice.registerKey` CH±, las
teclas de media, los números y los colores al arrancar en Samsung, y agregar el permiso a
`config.xml`. Sin esto, hoy en Samsung no funcionan CH± ni Play/Pausa.

**Criterios de aceptación:**
- [x] En Samsung, al arrancar la app se registran ChannelUp/Down, MediaPlay, MediaPause, MediaPlayPause, MediaStop, MediaFastForward, MediaRewind, los números 0–9 y ColorF0–F3. Si una tecla no existe en el modelo, se registra el resto igual (cada `registerKey` va en su propio try/catch).
- [x] En navegador y en LG no se hace nada.
- [x] `packaging/tizen/config.xml` tiene el permiso `http://tizen.org/privilege/tv.inputdevice`.

**Verificación:**
- [x] Un test unitario con un `tizen` simulado confirma qué teclas se registran y que un error en una no corta el resto.
- [x] Tests y build en verde.
- [ ] En un Samsung real, CH+ y CH− cambian de canal dentro del reproductor.

**Dependencias:** ninguna
**Archivos probables:** `src/utils/tvNavigation/registerTvKeys.js` (nuevo), `src/main.jsx`, `packaging/tizen/config.xml`, `src/utils/__tests__/registerTvKeys.test.js`
**Tamaño:** S

### Tarea 2: LG, mapear CH± y agregar tests del control
**Descripción:** En LG, CH+ y CH− llegan como los códigos 33 y 34 (PageUp/PageDown),
que no están mapeados en `getTvActionFromKeyEvent`. Además, `tvRemote` no tiene tests.

**Criterios de aceptación:**
- [x] 33/`PageUp` → `CHANNEL_UP` y 34/`PageDown` → `CHANNEL_DOWN`, siempre que el foco no esté en un campo de texto editable.
- [x] Hay tests para 461 y 10009 (Atrás), 427 y 428, 33 y 34, flechas y Enter.

**Verificación:**
- [x] `npx vitest run src/utils` en verde.
- [ ] En un LG real, CH± cambia de canal.

**Dependencias:** ninguna
**Archivos probables:** `src/utils/tvRemote.js`, `src/utils/__tests__/tvRemote.test.js`
**Tamaño:** XS

### Tarea 3: LG y Samsung, teclas de media en el reproductor
**Descripción:** Agregar a `TV_ACTION` las acciones de media (PLAY, PAUSE, PLAY_PAUSE,
STOP, FAST_FORWARD, REWIND) con los códigos de LG (415, 19, 413, 417, 412) y de Tizen
(los mismos más 10252 para PlayPause) y conectarlas al reproductor mediante
`NavigationRouter` y la navegación del HUD. En vivo, FF y RW no hacen nada porque ninguna
marca tiene activo `showPlaybackButtonsOnLive`.

**Criterios de aceptación:**
- [x] En VOD y catchup: Play/Pausa alterna, Stop cierra el reproductor y FF/RW mueven ±10 s, igual que los botones del HUD.
- [x] En vivo: Pausa y Stop siguen las mismas reglas que el HUD (sin pausa en vivo si la marca no la permite).
- [x] Fuera del reproductor, las teclas de media no hacen nada.

**Verificación:**
- [x] Tests de mapeo en `tvRemote.test.js` y un test del reparto en `NavigationRouter`.
- [ ] Probado en LG y Samsung reales con una película.

**Dependencias:** 1 (en Samsung las teclas tienen que estar registradas), 2
**Archivos probables:** `src/utils/tvRemote.js`, `src/navigation/NavigationRouter.js`, `src/hooks/usePlayerHudTvNavigation.js`, `src/navigation/__tests__/NavigationRouter.test.js`
**Tamaño:** M

### Checkpoint 1
- [ ] Tests, lint y build en verde.
- [ ] En un Samsung y un LG reales funcionan CH± y Play/Pausa.
- [ ] Revisión con el equipo antes de seguir.

---

## Fase 2: empaquetado de LG y Samsung (necesita la decisión D1)

### Tarea 4: Samsung, `config.xml` por marca y script de paquete
**Descripción:** Hoy `config.xml` es una plantilla con `YOUR_APP_ID` y sirve para todas
las marcas. Hay que generarlo por marca (id, nombre, ícono y, si D1 es "lanzador de URL",
la URL de contenido) y agregar un script que arme el `.wgt` con la CLI `tizen`.

**Criterios de aceptación:**
- [ ] `pnpm package:tizen <marca>` genera `dist/<marca>/tizen/config.xml` con los datos de la marca, `<access origin="*" subdomains="true"/>`, los permisos `internet`, `tv.inputdevice` y `avplay`, y `tizen:profile name="tv"`.
- [ ] Ya no quedan `contextmenu="enable"` ni `YOUR_*` en el paquete que se genera.
- [ ] Si no está la CLI `tizen` o falta el certificado, el script falla con un mensaje claro.

**Verificación:**
- [ ] El `.wgt` de intv se instala en un Samsung real (Device Manager o `sdb`) y abre el login.

**Dependencias:** D1
**Archivos probables:** `packaging/tizen/config.xml` (pasa a ser plantilla), `scripts/package-tizen.js` (nuevo), `package.json`, `packaging/tizen/README.md`
**Tamaño:** M

### Tarea 5: LG, `appinfo.json` por marca y script de paquete
**Descripción:** `appinfo.json` no existe. Hay que generarlo por marca (id, título,
íconos, `resolution: "1920x1080"`, `disableBackHistoryAPI: true`), copiar `webOSTV.js`
y armar el `.ipk` con `ares-package`.

**Criterios de aceptación:**
- [ ] `pnpm package:webos <marca>` genera el `.ipk` en `dist/<marca>/webos/`.
- [ ] Se copia `webOSTV.js` al paquete; si no se encuentra, el script falla con un mensaje claro.
- [ ] Atrás (461) llega a la app y no lo toma el historial del sistema.

**Verificación:**
- [ ] `ares-install` en un LG real; la app abre y Atrás funciona.

**Dependencias:** D1
**Archivos probables:** `packaging/webos/appinfo.template.json` (nuevo), `scripts/package-webos.js` (nuevo), `package.json`, `packaging/webos/README.md`
**Tamaño:** M

### Tarea 6: que la app arranque desde `file://` (sólo si D1 = empaquetado)
**Descripción:** Con `base: '/'`, `BrowserRouter` y las rutas absolutas del splash en
`index.html`, la app no arranca dentro de un IPK o WGT. Hay que agregar una variante de
build para TV con `base: './'` y un router que funcione con `file://`.

**Criterios de aceptación:**
- [ ] Con `VITE_TV_PACKAGED=true`, el build usa rutas relativas y `HashRouter`. El build web no cambia.
- [ ] El splash y los assets de la marca cargan desde el paquete.
- [ ] Recargar la página (o volver de segundo plano) no deja la pantalla en blanco.

**Verificación:**
- [ ] Abrir `dist/<marca>/index.html` directamente con `file://` en Chrome: llega al login.
- [ ] El build web genera los mismos archivos que antes (comparar con `diff`).

**Dependencias:** 4, 5
**Archivos probables:** `vite.config.js`, `src/main.jsx`, `index.html`
**Tamaño:** M

### Tarea 7: LG y Samsung, integración con el sistema
**Descripción:**
- Samsung: apagar el salvapantallas del sistema mientras se reproduce (`webapis.appcommon.setScreenSaver`).
- LG: salir con `webOS.platformBack()` cuando exista.
- Ambos: leer el modelo y el ID real del aparato (`webapis.productinfo`, `webOS.deviceInfo`) para la sesión de dispositivo, en lugar de "LG webOS TV" y "Samsung Tizen TV" fijos.

**Criterios de aceptación:**
- [ ] En Samsung, durante una reproducción larga no aparece el salvapantallas del televisor y vuelve a activarse al cerrar el reproductor.
- [ ] "Salir" en Mi Cuenta cierra la app en LG.
- [ ] En "Dispositivos vinculados" se ve el modelo real. Si la API falla, se muestra el texto genérico de antes.

**Verificación:**
- [ ] Tests con APIs simuladas para el modelo y la salida.
- [ ] Prueba en LG y Samsung reales.

**Dependencias:** 4, 5
**Archivos probables:** `packages/core/src/utils/tvPlatformApis.js`, `packages/core/src/services/deviceSessionService.js`, `src/utils/tvNavigation/backLongPress.js`, `src/contexts/PlayerContext.jsx`
**Tamaño:** M

### Checkpoint 2
- [ ] El `.wgt` y el `.ipk` de una marca se instalan, inician sesión y reproducen en el televisor.
- [ ] El build web no cambió.
- [ ] Revisión con el equipo.

---

## Fase 3: Vega, brechas que afectan a las marcas publicadas

### Tarea 33: Vega, que una marca con perfiles externos no entre al home sin licencia
**Descripción:** Con `profilesSource: 'externo'` (hoy wind), `resolvePostLoginRoute`
devuelve `/profile`, porque la licencia la elige el perfil. Vega manda `/profile` al home
(`apps/vega/src/routes.js`), así que entraría sin licencia activa. Mientras no exista la
pantalla de perfiles (tarea 34), Vega tiene que cortar ese camino de forma clara.

**Criterios de aceptación:**
- [ ] Con `usesExternalProfiles(marca)` y sin pantalla de perfiles, Vega no navega al home: muestra un mensaje ("Esta cuenta usa perfiles; todavía no están disponibles en esta app") con "Cerrar sesión".
- [ ] Las marcas con `profilesSource: 'panaccess'` (o sin perfiles) siguen igual que hoy.
- [ ] `screenForWebRoute('/profile')` deja de devolver `'home'` en silencio.

**Verificación:**
- [ ] Test de la decisión de ruta (función pura, en core o en Vega con vitest).
- [ ] Lint en verde. Prueba en el stick con wind la hace el equipo que compila Vega.

**Dependencias:** ninguna
**Archivos probables:** `apps/vega/src/routes.js`, `apps/vega/src/screens/SplashScreen.jsx`, `apps/vega/src/screens/LoginScreen.jsx`
**Tamaño:** S

### Tarea 34: Vega, pantalla de perfiles externos
**Descripción:** Portar a Vega la parte de selección de `ExternalProfilePage` de la web,
usando la lógica que ya está en core (`externalProfilesService`, `externalProfileSession`,
`activeProfileStore`): lista de perfiles, PIN del perfil si lo tiene, licencia elegida
por el perfil (con préstamo si la suya está en uso) y "continuar aquí" si están todas en
uso. Crear, editar y borrar perfiles queda para una tarea aparte.

**Criterios de aceptación:**
- [ ] Después del login de wind aparece la lista de perfiles; al elegir uno, entra al home con la licencia que eligió el perfil.
- [ ] Un perfil con PIN pide el PIN (teclado numérico del sistema) y un PIN incorrecto muestra el error del servidor.
- [ ] Al abrir la app vuelve a entrar sola al último perfil si no tiene PIN (igual que la web).
- [ ] Si la cuenta tiene `profiles_disabled` o no hay sesión con el backend, sigue el flujo de siempre (smartcard/home).
- [ ] La edad máxima del perfil bloquea lo que la supera (lo hace `parentalGateStore` de core: verificar que Vega lo respeta).

**Verificación:**
- [ ] Lint en verde; tests de core sin cambios en verde.
- [ ] En el stick con wind: elegir perfil, reproducir, cerrar y volver a abrir la app.

**Dependencias:** 33; piloto web probado; backend `leompe8907/panaccess_wind_integration#27`; D4 (que wind vaya a Fire TV)
**Archivos probables:** `apps/vega/src/screens/ProfileScreen.jsx` (nuevo), `apps/vega/src/App.jsx`, `apps/vega/src/routes.js`, `apps/vega/src/account/AccountPage.jsx` ("Cambiar perfil")
**Tamaño:** M–L (si crece, separar "Cambiar perfil" en Mi Cuenta)

### Tarea 8: Vega, ErrorBoundary y aviso de "sin conexión"
**Descripción:** Hoy, un error de render en Vega deja la pantalla en blanco o cierra la app,
e `isOnline()` siempre devuelve verdadero. Hay que agregar un ErrorBoundary con "Reintentar"
y una detección de red real (empezar con una prueba corta para ver qué API ofrece Vega).

**Criterios de aceptación:**
- [x] Un error al renderizar una pantalla muestra un mensaje con "Reintentar" y "Salir", no una pantalla en blanco. (Falta probarlo en el stick.)
- [ ] Sin red, la app muestra "Sin conexión" y se recupera sola al volver la red. **Bloqueado:** Vega no trae una API de red; la opción es `@amazon-devices/keplerscript-netmgr-lib` (dependencia nativa nueva, a decidir).
- [ ] `isOnline` del runtime de Vega devuelve el estado real.

**Verificación:**
- [ ] Build Release en el stick: forzar un error (en Debug) y desconectar el Wi-Fi.

**Dependencias:** ninguna
**Archivos probables:** `apps/vega/src/components/ErrorBoundary.jsx` (nuevo), `apps/vega/src/App.jsx`, `apps/vega/src/bootstrap.js`
**Tamaño:** S–M

### Tarea 9: core, mover el flujo de login con código (UDID) a `@appvideo/core`
**Descripción:** `src/hooks/useUdidLoginFlow.js` (636 líneas) mezcla el flujo (pedir el
código, WebSocket con reintentos, descifrar con la clave efímera, estados 429, vencido y
error) con React. Hay que sacar el flujo a una máquina de estados en core, sin React y con
tests, y dejar el hook web como un envoltorio delgado.

**Criterios de aceptación:**
- [x] `packages/core/src/services/udidLoginFlow.js` expone `start/cancel/retry` y `subscribe(state)`, y no depende de DOM ni de React.
- [x] El hook web usa ese flujo; el login con código de la web se comporta igual que antes.
- [x] Hay tests de los estados: código recibido, vencido, 429 con espera, WebSocket que se corta y se reconecta, credenciales recibidas.

**Verificación:**
- [x] `npx vitest run packages/core` en verde.
- [ ] Login con código en la web con multiplustv o bromteck, de punta a punta.

**Dependencias:** ninguna
**Archivos probables:** `packages/core/src/services/udidLoginFlow.js` (nuevo), `packages/core/src/services/__tests__/udidLoginFlow.test.js`, `src/hooks/useUdidLoginFlow.js`
**Tamaño:** M
**Nota:** toca el login y las credenciales: correr `security-and-hardening`.

### Tarea 10: Vega, pantalla de login con código (UDID) y QR
**Descripción:** Agregar "Iniciar con código" al login de Vega usando el flujo de la
tarea 9: muestra el código, el QR, la cuenta regresiva y los estados de error. Afecta a
multiplustv, que ya está instalada en el stick.

**Criterios de aceptación:**
- [ ] Sólo aparece si `login.udid.enabled` está activo.
- [ ] Al aprobar el código desde el teléfono, Vega entra a la smartcard o al home igual que con usuario y contraseña.
- [ ] Atrás cancela el flujo y cierra el WebSocket.

**Verificación:**
- [ ] Release de multiplustv en el stick: login con código completo, y también con el código vencido.

**Dependencias:** 9
**Bloqueo detectado (2026-10-20):** ninguna marca tiene hoy el login por código usable. multiplustv y sattv tienen `login.udid.enabled: true` pero `baseUrl`/`requestPath`/`wsUrl` vacíos (la web muestra "La configuración de UDID no está disponible"); bromteck y cableatlantico apuntan a `127.0.0.1`. Además, falta confirmar que el WebCrypto de Vega soporte RSA-OAEP para descifrar las credenciales.
**Archivos probables:** `apps/vega/src/screens/LoginScreen.jsx`, `apps/vega/src/screens/UdidLoginPanel.jsx` (nuevo)
**Tamaño:** M

### Tarea 11: Vega, el buscador abre los resultados de Catchup y Guía
**Descripción:** Hoy, al elegir un resultado de Catchup o de la Guía en el buscador no
pasa nada (TODO en `SearchPage.jsx:205`). Tienen que abrir `EpgEventModal` en el
contexto que corresponda.

**Criterios de aceptación:**
- [ ] Un resultado de la Guía abre el modal con "Reproducir canal", "Recordarme" o "Ver (Catchup)", según el horario.
- [ ] Un resultado de Catchup abre el modal en contexto catchup y reproduce con el control parental.
- [ ] Al cerrar el modal, el foco vuelve al resultado.

**Verificación:**
- [ ] En el stick, con una marca que tenga catchup.

**Dependencias:** ninguna
**Archivos probables:** `apps/vega/src/search/SearchPage.jsx`
**Tamaño:** S

### Tarea 12: core + Vega, inactividad
**Descripción:** El tiempo de inactividad viene del cliente
(`X_INACTIVITY_TIMEOUT_SEC`), así que aplica a todas las marcas. Vega no lo tiene: un
televisor puede quedar transmitiendo toda la noche. Hay que pasar la lógica de
`InactivityHost` y `inactivityConfig` a core (si no está toda en `inactivityStore`) y
hacer la pantalla en Vega.

**Criterios de aceptación:**
- [ ] Mientras se reproduce y no se toca el control durante el tiempo configurado, aparece "¿Sigues ahí?" con la cuenta regresiva.
- [ ] Si se acaba la cuenta, se cierra el reproductor y se muestra el salvapantallas; cualquier tecla lo quita.
- [ ] La lógica compartida tiene tests en core y la web se sigue comportando igual.

**Verificación:**
- [ ] Tests de core en verde.
- [ ] En el stick, en Release, con el tiempo de prueba bajo.

**Dependencias:** ninguna
**Archivos probables:** `packages/core/src/store/inactivityStore.js`, `src/utils/inactivityConfig.js` (a core), `apps/vega/src/components/InactivityHost.jsx` (nuevo), `apps/vega/src/App.jsx`
**Tamaño:** M

### Checkpoint 3
- [ ] Tests de core y de la web en verde; `build:intv` en verde.
- [ ] Release de multiplustv en el stick: login con código, buscador e inactividad.
- [ ] Revisión con el equipo.

---

## Fase 4: Vega, paridad para las marcas que activan cada función

### Tarea 13: Vega, telemetría de reproducción
**Descripción:** Conectar `telemetryService` al reproductor de vivo y al de VOD de
Vega, como en `PlayerContext` de la web: cambio de contenido, inicio y fin. Hoy sólo
Wind la tiene activa, y de esos datos sale "Más vistos".

**Criterios de aceptación:**
- [ ] Con `player.telemetryEnabled` se envían los mismos registros que en la web (con el mismo umbral anti-zapping).
- [ ] La cola se guarda y se envía al volver de segundo plano.
- [ ] Con la telemetría desactivada no se hace ninguna llamada.

**Verificación:**
- [ ] Ver en los logs de Debug el envío a PanAccess con la marca wind.

**Dependencias:** ninguna
**Archivos probables:** `apps/vega/src/screens/PlayerScreen.jsx`, `apps/vega/src/screens/VodPlayerScreen.jsx`, `apps/vega/src/playerTelemetry.js` (nuevo)
**Tamaño:** M

### Tarea 14: Vega, OSMS, sondeo y aviso de mensaje nuevo
**Descripción:** Para bromteck, cableatlantico y wind. Usar `osmsStore` con sondeo cada
2 min y al volver al frente (lo que hoy hace `useOsmsPolling` en la web) y mostrar un aviso
con "Ver" y "Descartar".

**Criterios de aceptación:**
- [ ] Sólo funciona si `features.osms` está activo.
- [ ] Cuando llega un mensaje nuevo aparece el aviso; si estaba en el reproductor, el reproductor sigue.
- [ ] El menú lateral muestra el contador de no leídos.

**Verificación:**
- [ ] En el stick con wind o bromteck, enviando un mensaje de prueba desde el backend.

**Dependencias:** ninguna
**Archivos probables:** `apps/vega/src/osms/useOsmsPolling.js` (nuevo), `apps/vega/src/osms/OsmsNotificationHost.jsx` (nuevo), `apps/vega/src/App.jsx`, `apps/vega/src/home/Sidebar.jsx`
**Tamaño:** M

### Tarea 15: Vega, OSMS, página de mensajes en Mi Cuenta
**Descripción:** Lista de mensajes agrupada por día con el detalle al lado, marcas de no
leído y "marcar como visto". Va dentro de Mi Cuenta (`osmsInline`).

**Criterios de aceptación:**
- [ ] "Ver" en el aviso de la tarea 14 abre directamente ese mensaje.
- [ ] Al abrir un mensaje queda como visto y el contador baja.

**Verificación:**
- [ ] En el stick, navegando sólo con el control.

**Dependencias:** 14
**Archivos probables:** `apps/vega/src/osms/OsmsPage.jsx` (nuevo), `apps/vega/src/account/AccountPage.jsx`
**Tamaño:** M

### Tarea 16: Vega, controles de media del sistema y segundo plano
**Descripción:** `kepler_media_controls` está declarado en `manifest.toml` pero no se usa.
Hay que conectarlo para que las teclas de media del control de Fire TV y los comandos del
sistema funcionen, y pausar VOD y catchup al pasar a segundo plano (como en la web).

**Criterios de aceptación:**
- [ ] Play/Pausa, FF y RW del control de Fire TV funcionan en VOD sin tener el foco en el botón.
- [ ] Al salir a la pantalla de inicio de Fire TV, el VOD se pausa y al volver sigue desde donde estaba.

**Verificación:**
- [ ] En el stick, en Release.

**Dependencias:** ninguna
**Archivos probables:** `apps/vega/src/player/mediaControls.js` (nuevo), `apps/vega/src/screens/VodPlayerScreen.jsx`, `apps/vega/src/screens/PlayerScreen.jsx`
**Tamaño:** M

### Tarea 17: Vega, banners de video y banners con `catchup_id`
**Descripción:** `AdZone` de Vega omite los banners de video y no abre `catchup_id`.

**Criterios de aceptación:**
- [ ] Los banners de video se reproducen en silencio y en bucle y se detienen al salir de Inicio o al abrir el reproductor.
- [ ] `catchup_id=N` abre el catchup con el control parental.
- [ ] Si el video falla, se muestra la imagen del banner o se pasa al siguiente.

**Verificación:**
- [ ] En el stick, con una marca que tenga `homeShell.ads.inicio` y un banner de video.

**Dependencias:** ninguna
**Archivos probables:** `apps/vega/src/home/AdZone.jsx`
**Tamaño:** S–M

### Tarea 18: Vega, recordar audio y subtítulos por canal
**Descripción:** En la web se recuerda la pista elegida por canal (`playerTrackPreferences`
con `userPreferences` de core). En Vega no se recuerda.

**Criterios de aceptación:**
- [ ] Si se elige un audio o subtítulo en un canal, al volver a ese canal se aplica solo (buscando por etiqueta).
- [ ] La preferencia usa la misma clave que la web, para que la sincronización sirva en los dos lados.

**Verificación:**
- [ ] Test de la función de preferencia (si se mueve a core) y prueba en el stick.

**Dependencias:** ninguna
**Archivos probables:** `src/utils/playerTrackPreferences.js` (a core), `apps/vega/src/screens/PlayerScreen.jsx`, `apps/vega/src/player/TracksPanel.jsx`
**Tamaño:** S–M

### Tarea 19: Vega, textos traducidos e idioma del dispositivo
**Descripción:** Pasar a i18n los textos escritos en el código (HUD del reproductor,
StatsPanel, "Próximamente", "Episode N", el badge "Catchup") y tomar el idioma del
dispositivo en lugar de fijar `es`.

**Criterios de aceptación:**
- [ ] `grep` de los textos fijos que se conocen en `apps/vega/src` no devuelve nada.
- [ ] Las claves nuevas están en es, en y pt.
- [ ] Con el Fire TV en inglés, la app aparece en inglés.

**Verificación:**
- [ ] Tests de core (los JSON de locales); prueba en el stick con el idioma cambiado.

**Dependencias:** ninguna
**Archivos probables:** `apps/vega/src/bootstrap.js`, `apps/vega/src/screens/PlayerScreen.jsx`, `apps/vega/src/player/StatsPanel.jsx`, `packages/core/src/locales/*.json`
**Tamaño:** M

### Tarea 20: Vega, subcabecera de Inicio
**Descripción:** Mostrar `header.subheader` como en la web: LCN y nombre del canal con
foco, y Ahora/Siguiente con el horario.

**Criterios de aceptación:**
- [ ] Sólo aparece si la marca la configura.
- [ ] Se actualiza al mover el foco sin causar tirones; si hace falta, se le aplica un debounce.

**Verificación:**
- [ ] En el stick, con una marca que tenga subcabecera.

**Dependencias:** ninguna
**Archivos probables:** `apps/vega/src/home/InicioHeader.jsx`, `apps/vega/src/home/BouquetWall.jsx`
**Tamaño:** S

### Checkpoint 4
- [ ] Tests de core, de la web y build en verde.
- [ ] Vega con wind (telemetría, OSMS) y con bromteck probados en el stick.
- [ ] Revisión con el equipo.

---

## Fase 5: funciones nuevas en todas las plataformas

### Tarea 21: zapping escribiendo el número del canal
**Descripción:** En el reproductor de vivo, escribir números (0–9) arma el LCN y, después
de una pausa corta (~1,5 s) o al presionar OK, cambia a ese canal. Se hace en web/TV y en
Vega, con la lógica de búsqueda por LCN en core.

**Criterios de aceptación:**
- [ ] Al escribir se ve el número en pantalla; si el LCN no existe, aparece un aviso y el canal no cambia.
- [ ] El cambio pasa por el control parental.
- [ ] En Samsung funciona porque las teclas ya están registradas (tarea 1).

**Verificación:**
- [ ] Test de la función que resuelve el LCN en core; prueba en LG, Samsung y el stick.

**Dependencias:** 1, 2
**Archivos probables:** `packages/core/src/utils/channelZappingList.js`, `src/utils/tvRemote.js`, `src/hooks/usePlayerChannelZapping.js`, `apps/vega/src/screens/PlayerScreen.jsx`
**Tamaño:** M

### Tarea 22: selector de temporada en series
**Descripción:** Hoy los episodios de todas las temporadas aparecen en una sola fila.
Hay que agregar pestañas o selector de temporada en el detalle de la web (hero y classic)
y de Vega.

**Criterios de aceptación:**
- [ ] Una serie con más de una temporada muestra el selector; con una sola, no.
- [ ] Al cambiar de temporada, la fila de episodios cambia y el foco queda en el selector.

**Verificación:**
- [ ] Prueba en la web y en el stick con una serie de varias temporadas.

**Dependencias:** ninguna
**Archivos probables:** `src/components/vod/VodDetailModal.jsx`, `src/components/vod/VodDetailModalClassic.jsx`, `apps/vega/src/vod/VodDetail.jsx`
**Tamaño:** M

### Tarea 23: reanudar el VOD donde quedó
**Descripción:** Guardar la posición del VOD y del catchup (cada X s y al cerrar) y
ofrecer "Reanudar" o "Desde el principio" al volver a abrirlo. Primero hay que confirmar
si el backend la guarda o si queda sólo en el dispositivo (decisión D5 del plan).

**Criterios de aceptación:**
- [ ] Si se cierra a mitad de una película, al volver a abrirla aparece "Reanudar desde mm:ss".
- [ ] Si faltaban menos de 2 min para el final, se toma como vista y no se ofrece reanudar.

**Verificación:**
- [ ] Tests de la función de posición en core; prueba en la web y en el stick.

**Dependencias:** ninguna
**Archivos probables:** `packages/core/src/utils/userPreferences.js`, `src/contexts/PlayerContext.jsx`, `apps/vega/src/screens/VodPlayerScreen.jsx`
**Tamaño:** M

### Tarea 24: calidad manual en el reproductor
**Descripción:** Pendiente de Wind. Agregar "Calidad" (Automática + niveles) en el
reproductor web (hls.js `currentLevel`) y en Vega (Shaka `selectVariantTrack`). Hay que
cuidar no romper el bloqueo de nivel que ya tiene Wind (`windLevelSelect`).

**Criterios de aceptación:**
- [ ] Sólo aparece si la marca lo activa.
- [ ] Elegir un nivel lo fija; "Automática" devuelve el ABR.

**Verificación:**
- [ ] Panel de estadísticas: ver el nivel fijado en la web y en el stick.

**Dependencias:** ninguna
**Archivos probables:** `src/player/engines/web/WebEngine.js`, `src/components/player/PlayerHud.jsx`, `apps/vega/src/player/VegaHlsPlayer.js`, `apps/vega/src/player/TracksPanel.jsx`
**Tamaño:** M

### Checkpoint 5
- [ ] Las cuatro funciones andan en la web, en un TV y en Vega.
- [ ] Revisión con el equipo.

---

## Fase 6: reproductor nativo de TV y DRM (necesita las decisiones D2 y D3)

### Tarea 25: decidir el reproductor de LG y Samsung (ADR)
**Descripción:** Escribir un ADR que explique si se sigue con el reproductor web en LG y
Samsung o si se arregla el nativo. Si se descarta, eliminar `LgEngine`, `SamsungEngine`,
`BaseTvEngine`, la política `VITE_TV_DEPLOY` y sus tests.
**Criterios de aceptación:** [ ] El ADR queda en `docs/`. [ ] Si se descarta, nadie importa el código eliminado y la web reproduce igual.
**Verificación:** [ ] Tests y build en verde; reproducir en LG y Samsung.
**Dependencias:** D2, D3
**Tamaño:** S (ADR) / M (eliminación)

### Tarea 26: Samsung AVPlay (si se arregla)
**Criterios de aceptación:**
- [ ] Al cerrar el reproductor, AVPlay se detiene (`reset`/`stop`).
- [ ] La DRM se configura después de `open()`.
- [ ] Se envían los eventos de duración y de fin.
- [ ] `forward`/`backward` usan la posición de AVPlay.
- [ ] Las pistas se avisan apenas se prepara el video.
- [ ] Pausa con `suspend` y vuelve con `restore` en segundo plano.

**Verificación:** [ ] Tests con AVPlay simulado; Samsung real.
**Dependencias:** 25
**Archivos probables:** `src/player/engines/samsung/SamsungEngine.js`, su test
**Tamaño:** M

### Tarea 27: LG Luna (si se arregla)
**Criterios de aceptación:**
- [ ] El XML de DRM sale escapado.
- [ ] LOADED y PLAYING se avisan recién cuando termina la DRM.
- [ ] Una carga vieja que termina después de cerrar el reproductor no vuelve a poner el `<source>`.

**Verificación:** [ ] Tests; LG real.
**Dependencias:** 25
**Archivos probables:** `src/player/engines/lg/LgEngine.js`, su test
**Tamaño:** M

### Tarea 28: DRM de punta a punta (si D2 = sí)
**Descripción:** Hoy nadie le pasa `drmConfig` al reproductor (siempre `{}`) y Vega usa
`drm_scheme: ''`. Hay que leer la DRM desde la configuración de la marca o del contenido
y conectarla: EME en la web, Shaka en Vega y los motores nativos si se mantienen.
**Verificación:** [ ] Un contenido Widevine de prueba se reproduce en la web y en el stick.
**Dependencias:** 25, D2 · **Tamaño:** L, partirla en subtareas cuando se decida

### Checkpoint 6
- [ ] Si se activó el nativo o la DRM, quedó probado en LG, Samsung y el stick reales.

---

## Fase 7: bajo impacto (ninguna marca lo activa hoy)

- [ ] **Tarea 29:** Vega, perfiles de PanAccess (`profilesSource: 'panaccess'`: elegir, crear, editar, borrar, avatares). Hacerla cuando alguna marca los active. Los perfiles externos (wind) están en las tareas 33 y 34. Tamaño L: partirla en elegir / crear / editar-borrar.
- [ ] **Tarea 30:** Vega, "Ir al vivo", retroceder dentro del vivo y botones de reproducción en vivo. Hacerla cuando alguna marca active `showPlaybackButtonsOnLive`.
- [ ] **Tarea 31:** Vega, catchup "legacy" y detalle VOD "classic". Sólo si alguna marca los configura.
- [ ] **Tarea 32:** limpieza: quitar los 12 módulos sin uso de `src/` (lista en la auditoría) y `apps/vega/src/components/FocusButton.jsx`. Verificar con `grep` y build.
