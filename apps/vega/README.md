# appVideo para Fire TV (Vega OS)

App React Native 0.83 / SDK Vega 0.24 que reutiliza `@appvideo/core`
(servicios de Panaccess, stores, marcas, i18n). Plan completo:
[docs/PLAN_VEGA.md](../../docs/PLAN_VEGA.md).

Pantallas con el diseño de appVideo (ver docs/VEGA_DESIGN_SPEC*.md):
splash → login → smartcard → home (menú lateral, Inicio con bouquets y
banners, Canales) → vivo con HUD (zapping por LCN, listado de canales, info);
Películas (filas por género, "Ver más", detalle hero, episodios, reproductor
VOD con ±10 s y progreso); Buscador; Mi Cuenta (QR, Acerca de, Refrescar,
Cerrar sesión, Salir).

## Requisitos

- SDK Vega en `~/vega` (`source ~/vega/env`) y Node 20 en `/usr/local/opt/node@20/bin`.
- Fire TV en modo desarrollador en la misma red.
- `npm install` en esta carpeta (usa `package-lock.json`). Ojo: `~/Desktop/VegaPruebaRN/node_modules`
  es un enlace a este `node_modules`.

## Compilar e instalar

```bash
cd apps/vega
./scripts/build.sh              # Debug (Release: ./scripts/build.sh Release)
./scripts/run-on-device.sh      # IP por defecto 192.168.4.218 (Release: ./scripts/run-on-device.sh 192.168.4.218 Release)
```

`VEGA_BRAND=intv` (por defecto) elige la marca. El token y la URL del
middleware salen de las `VITE_BRAND_TOKEN_*` / `VITE_BRAND_DRM_*` del
`.env.local` de la raíz, igual que en la web (plugin `babel/importMetaEnv.js`).

## Logs de desarrollo

El journal del dispositivo recorta los logs de la app; en Debug, `devLog()`
los manda a la Mac por un túnel que abre `run-on-device.sh`:

```bash
python3 scripts/logserver.py /tmp/vega-app.log
```

Captura de pantalla y teclas del control desde la Mac (útil para probar sin
tocar el control):

```bash
vda -s 192.168.4.218:5555 shell "gwsi-tool-screenshooter /tmp/s.png" && vda -s 192.168.4.218:5555 pull /tmp/s.png .
vda -s 192.168.4.218:5555 shell "inputd-cli button_press KEY_DOWN"   # KEY_UP/LEFT/RIGHT/ENTER/BACK
```

(`vda` está en `~/vega/sdk/vega-sdk/main/<versión>/bin/tools/vda`.)

## Sesión de desarrollo

Si existe `dev-session.local.json` (ignorado por git), los builds Debug
precargan esas claves de almacenamiento: los mismos valores que la web guarda en
`localStorage` (`intv.sessionId`, `intv.udid`, `intv.username`, todos cifrados
como en la web). Sirve para entrar sin escribir usuario y contraseña.

## Cómo se integra `@appvideo/core`

- `metro.config.js` resuelve `@appvideo/core/*` a `packages/core/src` y obliga
  a que `react`, `react-native` y `@amazon-devices/*` salgan de esta app (una
  sola copia de React). Además repite el renombre
  `react-native` → `@amazon-devices/react-native-kepler`, que la CLI pierde
  cuando el proyecto define su propio `resolveRequest`.
- `src/bootstrap.js` registra el almacenamiento (AsyncStorage de Amazon,
  persistente) y el runtime de Vega antes de cargar el resto.
- Navegación: stack de React Navigation de Amazon en `App.jsx` (sin encabezado
  ni animaciones, como vega-video-sample).
- Los estilos se escriben en píxeles de 1920×1080 y `src/scaledStyles.js` los
  lleva al ancho lógico real (960×540 en el stick).

## Particularidades de Vega (aprendidas en el stick)

- `react-native-svg` hace caer la app: íconos PNG (`node scripts/gen-icons.js`,
  desde HomeNavIcon.jsx / AppIcon.jsx de la web), QR dibujado con Views y
  degradados con `@amazon-devices/react-linear-gradient`.
- Imágenes a pantalla completa: ancho/alto explícitos (`FullScreenImage`); con
  `absoluteFill` se dibujan a su tamaño en píxeles. Splash y fondo en JPG 1920×1080.
- Teclado en pantalla: `com.amazon.inputmethod.service` en `[wants]` del manifiesto.
- `crypto.getRandomValues` no existe: polyfill con `WebCrypto.randomUUID()` nativo.
- AsyncStorage: `@amazon-devices/react-native-async-storage__async-storage`
  (el heredado no persiste).
- Pantallas montadas debajo de otra (stack) no deben manejar Atrás: usar
  `useIsFocused`.
- El protector de pantalla de Fire TV pausa la app: al probar con teclas
  simuladas, despertarlo antes.
- **Builds Debug: la app se cierra a los ~7,5 min de reproducir video**
  (cualquier canal y marca; `SIGABRT` por "Too many open files" en el log
  del stick). Es del runtime de desarrollo de Vega: en **Release** no pasa
  (probado 12+ min). No es de React DevTools, ni de Shaka (fetch o XHR), ni
  del descifrado de keys, ni de `timeupdate`, ni del manifiesto: se probó
  cada cosa por separado (07-10-2026). Para pruebas largas de reproducción
  usar Release: `./scripts/build.sh Release` y
  `./scripts/run-on-device.sh 192.168.4.218 Release` (sin logs a la Mac).
- Imágenes remotas: siempre con `RemoteImage` / `remoteImage.js` (URLs vacías,
  sin id o caídas del operador provocaban cierres al rearmar el home).

## Pendiente

- Catchup y Guía EPG (la cuenta de prueba de INTV no tiene catchup y la guía
  está apagada por marca), control parental (PIN y bloqueo), perfiles, OSMS.
- Pistas de audio/subtítulos, calidad de Wind, telemetría de reproducción.
- Banners de video (los de imagen están; sin datos de prueba en INTV).
- Logos y colores para las demás marcas (`src/theme.js`).
