# appVideo para Fire TV (Vega OS)

App React Native 0.83 / SDK Vega 0.24 que reutiliza `@appvideo/core`
(servicios de Panaccess, stores, marcas, i18n). Plan completo:
[docs/PLAN_VEGA.md](../../docs/PLAN_VEGA.md).

Hoy hace: splash → login (o sesión guardada) → home con bouquets y canales →
vivo a pantalla completa con zapping (▲▼), reintento (OK) y Atrás al home.

## Requisitos

- SDK Vega en `~/vega` (`source ~/vega/env`) y Node 20 en `/usr/local/opt/node@20/bin`.
- Fire TV en modo desarrollador en la misma red.
- `npm install` en esta carpeta (usa `package-lock.json`). Ojo: `~/Desktop/VegaPruebaRN/node_modules`
  es un enlace a este `node_modules`.

## Compilar e instalar

```bash
cd apps/vega
./scripts/build.sh              # Debug (Release: ./scripts/build.sh Release)
./scripts/run-on-device.sh      # IP por defecto 192.168.4.218
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

## Pendiente

- EPG, catchup, VOD, búsqueda, cuenta, control parental (Fase 4).
- Contrato completo de motor (`src/player/engines/contracts.js` de la web),
  calidad de Wind, "licencia en uso" (Fase 3).
- Logos y colores para las demás marcas (`src/theme.js`).
