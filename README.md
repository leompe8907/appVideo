# Proyecto OTT Multi-Cliente

Aplicación base para múltiples clientes OTT compatible con TVs LG y Samsung 2016.

## 🚀 Uso Rápido

### Variables de entorno

Vite **solo** carga `.env.local` (no `.env.example`).

```bash
cp .env.example .env.local
```

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `VITE_SECRET_KEY` | Sí (prod) | Cifrado de credenciales y `sessionId` en localStorage |
| `VITE_BRAND_TOKEN_<MARCA>` | Sí | Token API Panaccess por marca (ej. `VITE_BRAND_TOKEN_WIND`) |
| `VITE_TV_PLATFORM` | No | Fuerza bootstrap TV: `tizen`, `webos`, `lg`, `samsung` |
| `VITE_TV_DEPLOY` | No | `true` activa engines nativos Samsung/LG en build TV (Etapa 2) |
| `VITE_ERROR_REPORT_URL` | No | Endpoint HTTP donde se envían los errores capturados (`src/utils/errorReporting.js`). Sin definir, solo se guardan localmente (localStorage) |
| `VITE_APP_LOGS_INGEST_KEY` | No | Secreto compartido (`X-App-Log-Key`) para reportar errores al backend Wind (`POST /api/v1/logs/`, `src/utils/errorReporting.js`). Sin definir, ese destino se omite -- pedir el valor al equipo de backend, ver `docs/GUIA_INTEGRACION_UNIFICADA.md` (Back-Wind-V2) sección 7 |
| `VITE_RECAPTCHA_SITE_KEY_<MARCA>` | No | Site key pública de reCAPTCHA v3 por marca (`src/services/recaptchaService.js` + `resolveRecaptchaSiteKey()` en `src/config/resolveBrandToken.js`, mismo esquema que `VITE_BRAND_TOKEN_<MARCA>`) -- usada por "olvidé mi contraseña" y "eliminar cuenta" (solo en brands con `login.deviceSession.enabled: true`, hoy solo `wind`). `VITE_RECAPTCHA_SITE_KEY` (sin sufijo de marca) sirve de fallback en builds de una sola marca. Sin ninguna de las dos, no se genera token y esas llamadas se mandan sin `recaptcha_token` (el backend Wind decide si lo exige según tenga `RECAPTCHA_SECRET_KEY` configurado) |

Los tokens **no** van en `src/config/brands.js`. El CI falla si detecta tokens hardcodeados (`pnpm run check:secrets`).

### Desarrollo
```bash
pnpm run dev

# http://localhost:3000
# Cambiar cliente: http://localhost:3000?brand=bromteck
```

### Builds

```bash
# Build universal (todos los clientes incluidos)
npm run build

# Build para cliente específico
npm run build:telecable
npm run build:bromteck
npm run build:intv
npm run build:gigmax

# Build de todos los clientes a la vez
pnpm run build:all

# Verificar compatibilidad ES5 TV (Chrome 53) tras build
pnpm run check:es-compat dist/wind
```

## Smart TV (Tizen / webOS)

- Bootstrap nativo: `public/tv-platform-bootstrap.js` (webapis / webOSTV.js).
- Empaquetado: ver `packaging/tizen/` y `packaging/webos/`.
- Build producción genera solo chunks **legacy** compatibles con TV 2019.

## Assets en build

Vite por defecto copia **toda** `public/` al `dist`. Este proyecto usa el plugin `vite/brandPublicAssets.js`:

| Comando | Qué entra en `dist` |
|---------|-------------------|
| `build:wind` (con `VITE_BRAND`) | Solo `public/wind/` + `public/shared/` |
| `build` (sin marca) | Toda `public/` (modo universal con `?brand=`) |

Así un despliegue por cliente no expone logos ni claves de otras marcas.

## 📁 Estructura

```
public/
├── telecable/
│   ├── logo.png              # Logo principal
│   ├── logo-white.png        # Logo versión blanca
│   ├── background.jpg        # Fondo principal
│   ├── favicon.ico           # Favicon
│   ├── splash.jpg            # Splash screen
│   ├── images/               # Imágenes adicionales
│   │   ├── banner.jpg
│   │   └── placeholder.png
│   └── fonts/                # Fuentes custom
│       └── custom-font.woff2
│
├── bromteck/
│   └── ... (misma estructura)
│
├── intv/
│   └── ...
│
├── gigmax/
│   └── ...
│
└── shared/                   # Assets compartidos
    ├── icons/
    │   ├── play.svg
    │   ├── pause.svg
    │   └── stop.svg
    └── placeholders/
        └── no-image.png
```

## Uso en Código

```jsx
// Acceso automático con brandConfig
const { assets } = brandConfig;

<img src={assets.logo} />
<img src={assets.background} />

// Asset custom
<img src={assets.get('images/banner.jpg')} />

// Asset compartido
import { getSharedAsset } from '../utils/assetLoader';
<img src={getSharedAsset('icons/play.svg')} />
```

## Formatos Recomendados para TVs 2016

- **Logos**: PNG (transparencia) < 100KB
- **Backgrounds**: JPG optimizados < 500KB
- **Icons**: SVG o PNG pequeños < 20KB
- **Fuentes**: WOFF2 (mejor soporte)

## Optimización

- Comprime imágenes antes de subir
- Usa dimensiones apropiadas (no más de 1920x1080)
- Evita GIFs animados pesados
- Prefiere JPG para fotos, PNG para logos/iconos


## 🎯 Modos de Uso

### 1. Build Universal + Query Params
```bash
npm run build
# Desplegar dist/
# Acceso: https://tudominio.com?brand=bromteck
```

### 2. Builds Individuales
```bash
npm run build:telecable
# Desplegar dist/telecable/ en https://telecable.tudominio.com
# Solo se empaquetan public/telecable/ y public/shared/ (no otras marcas).
```

### 3. Builds Separados
```bash
npm run build:all
# Desplegar cada carpeta dist/{brand}/ por separado
```

## ➕ Agregar Nuevo Cliente

1. Editar `src/config/brands.js`
2. Agregar script en `package.json`:
```json
"build:nuevocliente": "cross-env VITE_BRAND=nuevocliente VITE_DEFAULT_BRAND=nuevocliente vite build"
```

## 🔧 Optimizaciones para TVs 2016

- Target ES2015
- CSS compatible con Chrome 61
- Minificación agresiva
- Code splitting de vendors
- Drop console en producción

## 🎛️ Sistema de Configuración

Configuración organizada en 3 secciones:

### 🎨 UI (Colores, Temas, Posiciones)
```jsx
import { getUIConfig } from './utils/config'
const color = getUIConfig(brandConfig, 'primaryColor', '#000')
```

### ⚙️ Limits (Números, Restricciones)
```jsx
import { getLimit } from './utils/config'
const maxProfiles = getLimit(brandConfig, 'maxProfiles', 5)
```

### 🎛️ Features (Banderas Booleanas)
```jsx
import { isFeatureEnabled } from './utils/features'
{isFeatureEnabled(brandConfig, 'miniPlayer') && <MiniPlayer />}
```

**Documentación completa:**
- [`CONFIG.md`](./CONFIG.md) - UI y Límites
- [`FEATURES.md`](./FEATURES.md) - Sistema de Features
- [`PANACCESS.md`](./PANACCESS.md) - Conexión con Panaccess
- [`STYLES.md`](./STYLES.md) - Sistema SCSS + Bootstrap
- [`ROUTING.md`](./ROUTING.md) - React Router DOM
